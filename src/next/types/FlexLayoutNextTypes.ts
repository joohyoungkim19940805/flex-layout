import type { RxStateStorageOptions } from "@byeolnaerim/global-rx-state";
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


export type FlexLayoutNextSplitScreenPersistenceOptions = Omit<
	RxStateStorageOptions,
	"storage"
> & {
	/** Persistent storage backend. `in-memory` is intentionally not supported. */
	storage: Exclude<NonNullable<RxStateStorageOptions["storage"]>, "in-memory">;

	/**
	 * Stable global-rx-state key.
	 * Defaults to `__flexLayoutNextSplitScreen:${providerId}`.
	 */
	keyName?: string;

	/**
	 * Restore persisted URL-backed split panes after a full browser reload.
	 * When false, split-screen persistence is disabled.
	 * default = true
	 */
	restoreOnReload?: boolean;

	/**
	 * Keep a separate split-screen snapshot for each pathname + search URL.
	 * Navigating back/forward or revisiting a URL restores that URL's workspace.
	 * Full browser reload restores the snapshot for the current URL.
	 * Requires `restoreOnReload` to be enabled.
	 * default = false
	 */
	syncWithBrowserUrl?: boolean;
};
