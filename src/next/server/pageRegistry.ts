import type {
	FlexLayoutNextPageRegistry,
	FlexLayoutNextPageRegistryEntry,
	FlexLayoutNextParams,
	FlexLayoutNextResolvedPage,
	FlexLayoutNextSearchParams,
} from "../types";

export type ResolveFlexLayoutNextPageOptions = {
	basePath?: string;
};

const sortedRegistryCache = new WeakMap<
	FlexLayoutNextPageRegistry,
	readonly FlexLayoutNextPageRegistryEntry[]
>();

function decodeSegment(segment: string) {
	try {
		return decodeURIComponent(segment);
	} catch {
		return segment;
	}
}

function normalizeBasePath(basePath?: string) {
	if (!basePath) return "";
	return `/${basePath.replace(/^\/+|\/+$/g, "")}`;
}

function normalizeUrl(url: string, basePath?: string) {
	const parsed = new URL(url, "http://flex-layout.local");
	const normalizedBasePath = normalizeBasePath(basePath);
	let pathname = parsed.pathname;

	if (
		normalizedBasePath &&
		(pathname === normalizedBasePath ||
			pathname.startsWith(`${normalizedBasePath}/`))
	) {
		pathname = pathname.slice(normalizedBasePath.length) || "/";
	}

	const searchParams: FlexLayoutNextSearchParams = {};
	for (const [key, value] of parsed.searchParams.entries()) {
		const current = searchParams[key];
		if (current === undefined) {
			searchParams[key] = value;
		} else if (Array.isArray(current)) {
			searchParams[key] = [...current, value];
		} else {
			searchParams[key] = [current, value];
		}
	}

	return {
		url: `${parsed.pathname}${parsed.search}`,
		pathname: pathname.replace(/^\/+|\/+$/g, ""),
		searchParams,
	};
}

function getSegmentRank(segment: string) {
	if (/^\[\[\.\.\..+\]\]$/.test(segment)) return 0;
	if (/^\[\.\.\..+\]$/.test(segment)) return 1;
	if (/^\[.+\]$/.test(segment)) return 2;
	return 3;
}

function compareRegistryEntries(
	left: FlexLayoutNextPageRegistryEntry,
	right: FlexLayoutNextPageRegistryEntry,
) {
	const leftSegments = left.pattern.split("/").filter(Boolean);
	const rightSegments = right.pattern.split("/").filter(Boolean);
	const maxLength = Math.max(leftSegments.length, rightSegments.length);

	for (let index = 0; index < maxLength; index += 1) {
		const leftSegment = leftSegments[index];
		const rightSegment = rightSegments[index];

		if (leftSegment === undefined || rightSegment === undefined) {
			if (leftSegment === undefined && rightSegment === undefined) return 0;

			const remainingSegments = (
				leftSegment === undefined ? rightSegments : leftSegments
			).slice(index);
			const remainingAreOptional = remainingSegments.every((segment) =>
				/^\[\[\.\.\..+\]\]$/.test(segment),
			);

			if (remainingAreOptional) {
				return leftSegment === undefined ? -1 : 1;
			}
			return leftSegment === undefined ? 1 : -1;
		}

		const rankDifference =
			getSegmentRank(rightSegment) - getSegmentRank(leftSegment);
		if (rankDifference !== 0) return rankDifference;
	}

	return left.pattern.localeCompare(right.pattern);
}

function matchRegistryEntry(
	entry: FlexLayoutNextPageRegistryEntry,
	pathname: string,
): FlexLayoutNextParams | undefined {
	const patternSegments = entry.pattern.split("/").filter(Boolean);
	const routeSegments = pathname.split("/").filter(Boolean);
	const params: FlexLayoutNextParams = {};
	let routeIndex = 0;

	for (const patternSegment of patternSegments) {
		const optionalCatchAll = patternSegment.match(
			/^\[\[\.\.\.(.+)\]\]$/,
		);
		if (optionalCatchAll) {
			params[optionalCatchAll[1]] =
				routeIndex < routeSegments.length
					? routeSegments.slice(routeIndex).map(decodeSegment)
					: undefined;
			return params;
		}

		const catchAll = patternSegment.match(/^\[\.\.\.(.+)\]$/);
		if (catchAll) {
			if (routeIndex >= routeSegments.length) return undefined;
			params[catchAll[1]] = routeSegments
				.slice(routeIndex)
				.map(decodeSegment);
			return params;
		}

		if (routeIndex >= routeSegments.length) return undefined;

		const dynamic = patternSegment.match(/^\[(.+)\]$/);
		if (dynamic) {
			params[dynamic[1]] = decodeSegment(routeSegments[routeIndex]);
			routeIndex += 1;
			continue;
		}

		if (patternSegment !== routeSegments[routeIndex]) return undefined;
		routeIndex += 1;
	}

	return routeIndex === routeSegments.length ? params : undefined;
}

export function resolvePageFromRegistry(
	registry: FlexLayoutNextPageRegistry,
	url: string,
	options: ResolveFlexLayoutNextPageOptions = {},
): FlexLayoutNextResolvedPage | undefined {
	const normalized = normalizeUrl(url, options.basePath);

	let sortedRegistry = sortedRegistryCache.get(registry);
	if (!sortedRegistry) {
		sortedRegistry = [...registry].sort(compareRegistryEntries);
		sortedRegistryCache.set(registry, sortedRegistry);
	}

	for (const entry of sortedRegistry) {
		const params = matchRegistryEntry(entry, normalized.pathname);
		if (params === undefined) continue;

		return {
			url: normalized.url,
			pathname: normalized.pathname,
			pattern: entry.pattern,
			page: entry.page,
			layouts: entry.layouts ?? [],
			params,
			searchParams: normalized.searchParams,
		};
	}

	return undefined;
}
