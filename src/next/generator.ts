import * as fs from "node:fs";
import * as path from "node:path";
import type { FlexLayoutNextCookieOptions } from "./types";

const PAGE_FILE_PATTERN = /^page\.(?:ts|tsx|js|jsx)$/;
const LAYOUT_FILE_NAMES = [
	"layout.tsx",
	"layout.ts",
	"layout.jsx",
	"layout.js",
] as const;

export interface GenerateFlexLayoutSplitScreenPageRegistryConfig {
	appDir: string;
	outFile: string;
	excludedRoutes?: readonly string[];
	includeLayouts?: boolean;
	excludeRootLayout?: boolean;
	excludedLayouts?: readonly string[];
	basePath?: string;
	providerId?: string;
	cookieOptions?: FlexLayoutNextCookieOptions;
}

export type GenerateFlexLayoutSplitScreenPageRegistryResult = {
	appDir: string;
	outFile: string;
	pageCount: number;
};

type PageEntry = {
	file: string;
	route: string;
	layouts: string[];
};

function getCurrentWorkingDirectory() {
	return (
		globalThis as typeof globalThis & {
			process?: { cwd(): string };
		}
	).process?.cwd() ?? ".";
}

function toPosix(value: string) {
	return value.split(path.sep).join("/");
}

function normalizeRoute(value: string) {
	return value.replace(/^\/+|\/+$/g, "");
}

function normalizeRelativeFile(value: string) {
	return toPosix(value)
		.replace(/^\.\//, "")
		.replace(/\.(?:ts|tsx|js|jsx)$/, "");
}

function isRouteGroup(segment: string) {
	return /^\([^)]*\)$/.test(segment);
}

function shouldSkipDirectory(name: string) {
	return (
		name === "node_modules" ||
		name === ".next" ||
		name.startsWith(".") ||
		name.startsWith("_") ||
		name.startsWith("@") ||
		/^\(\.{1,3}\)/.test(name)
	);
}

function walkPageFiles(directory: string): string[] {
	const files: string[] = [];

	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (shouldSkipDirectory(entry.name)) continue;
			files.push(...walkPageFiles(path.join(directory, entry.name)));
			continue;
		}

		if (entry.isFile() && PAGE_FILE_PATTERN.test(entry.name)) {
			files.push(path.join(directory, entry.name));
		}
	}

	return files;
}

function findLayoutFile(directory: string) {
	for (const fileName of LAYOUT_FILE_NAMES) {
		const file = path.join(directory, fileName);
		if (fs.existsSync(file)) return file;
	}
	return undefined;
}

function collectLayouts({
	appDir,
	pageDirectory,
	excludeRootLayout,
	excludedLayouts,
}: {
	appDir: string;
	pageDirectory: string;
	excludeRootLayout: boolean;
	excludedLayouts: Set<string>;
}) {
	const directories: string[] = [];
	let current = pageDirectory;

	while (current.startsWith(appDir)) {
		directories.push(current);
		if (current === appDir) break;
		const parent = path.dirname(current);
		if (parent === current) break;
		current = parent;
	}

	return directories
		.reverse()
		.flatMap((directory) => {
			if (excludeRootLayout && directory === appDir) return [];
			const layout = findLayoutFile(directory);
			if (!layout) return [];

			const relativeLayout = normalizeRelativeFile(
				path.relative(appDir, layout),
			);
			return excludedLayouts.has(relativeLayout) ? [] : [layout];
		});
}

function createProviderId(value: string) {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return `registry_${(hash >>> 0).toString(36)}`;
}

function createImportPath(outFile: string, targetFile: string) {
	let importPath = path.relative(path.dirname(outFile), targetFile);
	importPath = importPath.replace(/\.(?:ts|tsx|js|jsx)$/, "");
	if (!importPath.startsWith(".")) importPath = `./${importPath}`;
	return toPosix(importPath);
}

export function generateFlexLayoutSplitScreenPageRegistry({
	appDir,
	outFile,
	excludedRoutes = [],
	includeLayouts = false,
	excludeRootLayout = true,
	excludedLayouts = [],
	basePath,
	providerId,
	cookieOptions = {},
}: GenerateFlexLayoutSplitScreenPageRegistryConfig): GenerateFlexLayoutSplitScreenPageRegistryResult {
	const currentWorkingDirectory = getCurrentWorkingDirectory();
	const resolvedAppDir = path.resolve(currentWorkingDirectory, appDir);
	const resolvedOutFile = path.resolve(currentWorkingDirectory, outFile);

	if (!fs.existsSync(resolvedAppDir)) {
		throw new Error(`App directory not found: ${resolvedAppDir}`);
	}

	const excludedRouteSet = new Set(excludedRoutes.map(normalizeRoute));
	const excludedLayoutSet = new Set(
		excludedLayouts.map(normalizeRelativeFile),
	);
	const duplicateRoutes = new Map<string, string>();
	const pages: PageEntry[] = walkPageFiles(resolvedAppDir)
		.map((file) => {
			const pageDirectory = path.dirname(file);
			const route = toPosix(path.relative(resolvedAppDir, pageDirectory))
				.split("/")
				.filter(Boolean)
				.filter((segment) => !isRouteGroup(segment))
				.join("/");

			return {
				file,
				route,
				layouts: includeLayouts
					? collectLayouts({
							appDir: resolvedAppDir,
							pageDirectory,
							excludeRootLayout,
							excludedLayouts: excludedLayoutSet,
						})
					: [],
			};
		})
		.filter(({ route }) => !excludedRouteSet.has(route))
		.sort((left, right) => left.route.localeCompare(right.route));

	for (const page of pages) {
		const existing = duplicateRoutes.get(page.route);
		if (existing) {
			throw new Error(
				`Duplicate generated route "${page.route}": ${existing}, ${page.file}`,
			);
		}
		duplicateRoutes.set(page.route, page.file);
	}

	const moduleVariables = new Map<string, string>();
	const importLines: string[] = [];
	let pageIndex = 0;
	let layoutIndex = 0;

	const registerModule = (file: string, type: "Page" | "Layout") => {
		const existing = moduleVariables.get(file);
		if (existing) return existing;

		const variableName =
			type === "Page" ? `Page_${pageIndex++}` : `Layout_${layoutIndex++}`;
		moduleVariables.set(file, variableName);
		importLines.push(
			`const ${variableName}: FlexLayoutNextPageImporter = () => import(${JSON.stringify(
				createImportPath(resolvedOutFile, file),
			)});`,
		);
		return variableName;
	};

	const registryLines = pages.map((page) => {
		const pageVariable = registerModule(page.file, "Page");
		const layoutVariables = page.layouts.map((layout) =>
			registerModule(layout, "Layout"),
		);

		return [
			"\t{",
			`\t\tpattern: ${JSON.stringify(page.route)},`,
			`\t\tpage: ${pageVariable},`,
			...(layoutVariables.length > 0
				? [`\t\tlayouts: [${layoutVariables.join(", ")}],`]
				: []),
			"\t},",
		].join("\n");
	});

	const generatedProviderId =
		providerId ?? createProviderId(`${toPosix(appDir)}:${toPosix(outFile)}`);
	const content = `/* AUTO-GENERATED FILE. DO NOT EDIT. */

import {
\tcreateFlexLayoutNextProvider,
\tresolvePageFromRegistry,
\ttype FlexLayoutNextPageImporter,
\ttype FlexLayoutNextPageRegistry,
} from "@byeolnaerim/flex-layout/next/server";

${importLines.join("\n")}

export const pageRegistry: FlexLayoutNextPageRegistry = [
${registryLines.join("\n")}
];

export function resolvePage(url: string) {
\treturn resolvePageFromRegistry(pageRegistry, url, {
\t\tbasePath: ${JSON.stringify(basePath ?? "")},
\t});
}

export const FlexLayoutNextProvider = createFlexLayoutNextProvider({
\tresolvePage,
\tproviderId: ${JSON.stringify(generatedProviderId)},
\tcookieOptions: ${JSON.stringify(cookieOptions)},
});

export default FlexLayoutNextProvider;
`;

	fs.mkdirSync(path.dirname(resolvedOutFile), { recursive: true });
	fs.writeFileSync(resolvedOutFile, content, "utf8");

	console.log(
		"[generateFlexLayoutSplitScreenPageRegistry] generated:",
		resolvedOutFile,
		"entries:",
		pages.length,
	);

	return {
		appDir: resolvedAppDir,
		outFile: resolvedOutFile,
		pageCount: pages.length,
	};
}
