import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { FlexLayoutNextClientProvider } from "../providers/FlexLayoutNextClientProvider";
import type {
	FlexLayoutNextCookieOptions,
	FlexLayoutNextPageResolver,
	FlexLayoutNextRenderRequest,
	FlexLayoutNextRenderedPane,
	FlexLayoutNextSplitScreenPersistenceOptions,
} from "../types";
import { renderResolvedPage } from "./renderResolvedPage";
import { requestFlexLayoutNextRender } from "./requestFlexLayoutNextRender";

function normalizeProviderId(providerId?: string) {
	const normalized = (providerId ?? "default")
		.replace(/[^A-Za-z0-9._-]/g, "_")
		.slice(0, 80);

	return normalized || "default";
}

function getCookieName(providerId?: string) {
	return `__flex_layout_next_${normalizeProviderId(providerId)}`;
}

function readRenderRequest(value?: string) {
	if (!value) return undefined;

	try {
		const request = JSON.parse(
			decodeURIComponent(value),
		) as FlexLayoutNextRenderRequest;

		if (
			typeof request.requestId !== "string" ||
			typeof request.screenKey !== "string" ||
			typeof request.url !== "string"
		) {
			return undefined;
		}

		return request;
	} catch {
		return undefined;
	}
}

function defaultNotFoundContent(url: string) {
	return (
		<div
			role="alert"
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				width: "100%",
				height: "100%",
				minHeight: "8rem",
				padding: "1rem",
				boxSizing: "border-box",
				textAlign: "center",
			}}
		>
			<div>
				<div>Page not found.</div>
				<small style={{ overflowWrap: "anywhere" }}>{url}</small>
			</div>
		</div>
	);
}

function defaultImportErrorContent(url: string) {
	return (
		<div
			role="alert"
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				width: "100%",
				height: "100%",
				minHeight: "8rem",
				padding: "1rem",
				boxSizing: "border-box",
				textAlign: "center",
			}}
		>
			<div>
				<div>Unable to load the requested page module.</div>
				<small style={{ overflowWrap: "anywhere" }}>{url}</small>
			</div>
		</div>
	);
}

async function renderRequestedPane({
	request,
	resolvePage,
	renderNotFound,
	renderImportError,
}: {
	request: FlexLayoutNextRenderRequest;
	resolvePage: FlexLayoutNextPageResolver;
	renderNotFound?: (url: string) => ReactNode | Promise<ReactNode>;
	renderImportError?: (
		error: unknown,
		url: string,
	) => ReactNode | Promise<ReactNode>;
}): Promise<FlexLayoutNextRenderedPane> {
	try {
		const resolvedPage = await resolvePage(request.url);

		if (!resolvedPage) {
			return {
				...request,
				content: renderNotFound
					? await renderNotFound(request.url)
					: defaultNotFoundContent(request.url),
			};
		}

		return {
			...request,
			content: await renderResolvedPage(resolvedPage),
		};
	} catch (error) {
		console.error(
			"[FlexLayoutNextSplitScreen] Failed to resolve or render a generated page entry.",
			error,
		);

		return {
			...request,
			content: renderImportError
				? await renderImportError(error, request.url)
				: defaultImportErrorContent(request.url),
		};
	}
}

export interface FlexLayoutNextSplitScreenProps {
	children: ReactNode;
	resolvePage: FlexLayoutNextPageResolver;
	providerId?: string;
	cookieOptions?: FlexLayoutNextCookieOptions;
	renderNotFound?: (url: string) => ReactNode | Promise<ReactNode>;
	renderImportError?: (
		error: unknown,
		url: string,
	) => ReactNode | Promise<ReactNode>;
	persistence?: FlexLayoutNextSplitScreenPersistenceOptions;
}

export async function FlexLayoutNextSplitScreen({
	children,
	resolvePage,
	providerId,
	cookieOptions = {},
	renderNotFound,
	renderImportError,
	persistence,
}: FlexLayoutNextSplitScreenProps) {
	const cookieName = getCookieName(providerId);
	const request = readRenderRequest((await cookies()).get(cookieName)?.value);

	return (
		<FlexLayoutNextClientProvider
			providerId={normalizeProviderId(providerId)}
			persistence={persistence}
			requestRenderAction={requestFlexLayoutNextRender.bind(
				null,
				cookieName,
				cookieOptions,
			)}
			renderedPane={
				request
					? await renderRequestedPane({
							request,
							resolvePage,
							renderNotFound,
							renderImportError,
						})
					: undefined
			}
		>
			{children}
		</FlexLayoutNextClientProvider>
	);
}

export type CreateFlexLayoutNextSplitScreenOptions = Omit<
	FlexLayoutNextSplitScreenProps,
	"children"
>;

export function createFlexLayoutNextSplitScreen(
	options: CreateFlexLayoutNextSplitScreenOptions,
) {
	return async function GeneratedFlexLayoutNextSplitScreen({
		children,
		persistence = options.persistence,
	}: {
		children: ReactNode;
		persistence?: FlexLayoutNextSplitScreenPersistenceOptions;
	}) {
		return (
			<FlexLayoutNextSplitScreen {...options} persistence={persistence}>
				{children}
			</FlexLayoutNextSplitScreen>
		);
	};
}
