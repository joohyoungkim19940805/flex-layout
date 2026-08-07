import type { ReactNode } from "react";

export type FlexLayoutNextRouteValue =
	| string
	| string[]
	| undefined;

export type FlexLayoutNextParams = Record<
	string,
	FlexLayoutNextRouteValue
>;

export type FlexLayoutNextSearchParams = Record<
	string,
	FlexLayoutNextRouteValue
>;

export type FlexLayoutNextPageModule = {
	default: unknown;
};

export type FlexLayoutNextPageImporter = () => Promise<FlexLayoutNextPageModule>;

export type FlexLayoutNextPageRegistryEntry = {
	pattern: string;
	page: FlexLayoutNextPageImporter;
	layouts?: readonly FlexLayoutNextPageImporter[];
};

export type FlexLayoutNextPageRegistry =
	readonly FlexLayoutNextPageRegistryEntry[];

export type FlexLayoutNextResolvedPage = {
	url: string;
	pathname: string;
	pattern: string;
	page: FlexLayoutNextPageImporter;
	layouts: readonly FlexLayoutNextPageImporter[];
	params: FlexLayoutNextParams;
	searchParams: FlexLayoutNextSearchParams;
};

export type FlexLayoutNextPageResolver = (
	url: string,
) =>
	| FlexLayoutNextResolvedPage
	| undefined
	| Promise<FlexLayoutNextResolvedPage | undefined>;

export type FlexLayoutNextRenderRequest = {
	requestId: string;
	screenKey: string;
	url: string;
};

export type FlexLayoutNextRenderRequestResult = {
	ok: boolean;
	message?: string;
};

export type FlexLayoutNextRequestRenderAction = (
	request: FlexLayoutNextRenderRequest,
) => Promise<FlexLayoutNextRenderRequestResult>;

export type FlexLayoutNextRenderedPane = FlexLayoutNextRenderRequest & {
	content: ReactNode;
};

export type FlexLayoutNextCookieOptions = {
	path?: string;
	domain?: string;
	httpOnly?: boolean;
	secure?: boolean;
	sameSite?: "lax" | "strict" | "none";
	maxAge?: number;
};
