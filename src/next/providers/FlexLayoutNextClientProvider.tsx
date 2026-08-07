"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type {
	FlexLayoutNextRenderedPane,
	FlexLayoutNextRequestRenderAction,
} from "../types";

export type FlexLayoutNextPaneState = {
	url: string;
	requestId: string;
	status: "loading" | "ready" | "error";
	content?: ReactNode;
	error?: string;
};

type FlexLayoutNextPaneStateMap = Record<
	string,
	FlexLayoutNextPaneState | undefined
>;

interface FlexLayoutNextContextValue {
	panes: FlexLayoutNextPaneStateMap;
	requestRender: (screenKey: string, url: string) => Promise<void>;
	releasePane: (screenKey: string) => void;
}

const FlexLayoutNextContext = createContext<FlexLayoutNextContextValue | null>(
	null,
);

function createRequestId() {
	const crypto = globalThis.crypto as Crypto | undefined;

	if (crypto?.randomUUID) return crypto.randomUUID();

	if (crypto?.getRandomValues) {
		return Array.from(crypto.getRandomValues(new Uint32Array(8)), (value) =>
			value.toString(32).padStart(2, "0"),
		).join("");
	}

	return `${Date.now().toString(32)}-${Math.random().toString(32).slice(2)}`;
}

export interface FlexLayoutNextClientProviderProps {
	children: ReactNode;
	requestRenderAction: FlexLayoutNextRequestRenderAction;
	renderedPane?: FlexLayoutNextRenderedPane;
}

export function FlexLayoutNextClientProvider({
	children,
	requestRenderAction,
	renderedPane,
}: FlexLayoutNextClientProviderProps) {
	const paneStateRef = useRef<FlexLayoutNextPaneStateMap>({});
	const releaseTimerRef = useRef<Record<string, number | undefined>>({});
	const [panes, setPanes] = useState<FlexLayoutNextPaneStateMap>({});

	const replacePaneState = useCallback(
		(
			screenKey: string,
			state: FlexLayoutNextPaneState,
		) => {
			paneStateRef.current = {
				...paneStateRef.current,
				[screenKey]: state,
			};
			setPanes(paneStateRef.current);
		},
		[],
	);

	const releasePane = useCallback((screenKey: string) => {
		if (paneStateRef.current[screenKey] === undefined) return;

		const currentTimer = releaseTimerRef.current[screenKey];
		if (currentTimer !== undefined) window.clearTimeout(currentTimer);

		releaseTimerRef.current[screenKey] = window.setTimeout(() => {
			delete releaseTimerRef.current[screenKey];
			if (paneStateRef.current[screenKey] === undefined) return;

			const nextPanes = { ...paneStateRef.current };
			delete nextPanes[screenKey];
			paneStateRef.current = nextPanes;
			setPanes(nextPanes);
		}, 0);
	}, []);

	useEffect(() => {
		return () => {
			Object.values(releaseTimerRef.current).forEach((timer) => {
				if (timer !== undefined) window.clearTimeout(timer);
			});
		};
	}, []);

	useEffect(() => {
		if (!renderedPane) return;

		const current = paneStateRef.current[renderedPane.screenKey];
		if (
			!current ||
			current.requestId !== renderedPane.requestId ||
			current.url !== renderedPane.url
		) {
			return;
		}

		replacePaneState(renderedPane.screenKey, {
			url: renderedPane.url,
			requestId: renderedPane.requestId,
			status: "ready",
			content: renderedPane.content,
		});
	}, [renderedPane, replacePaneState]);

	const requestRender = useCallback(
		async (screenKey: string, url: string) => {
			const releaseTimer = releaseTimerRef.current[screenKey];
			if (releaseTimer !== undefined) {
				window.clearTimeout(releaseTimer);
				delete releaseTimerRef.current[screenKey];
			}

			const current = paneStateRef.current[screenKey];
			if (
				current?.url === url &&
				(current.status === "loading" || current.status === "ready")
			) {
				return;
			}

			const requestId = createRequestId();
			replacePaneState(screenKey, {
				url,
				requestId,
				status: "loading",
			});

			try {
				const result = await requestRenderAction({
					requestId,
					screenKey,
					url,
				});

				if (result.ok) return;

				const latest = paneStateRef.current[screenKey];
				if (latest?.requestId !== requestId) return;

				replacePaneState(screenKey, {
					url,
					requestId,
					status: "error",
					error:
						result.message ??
						"Unable to request server rendering.",
				});
			} catch (error) {
				const latest = paneStateRef.current[screenKey];
				if (latest?.requestId !== requestId) return;

				replacePaneState(screenKey, {
					url,
					requestId,
					status: "error",
					error:
						error instanceof Error
							? error.message
							: "Unable to request server rendering.",
				});
			}
		},
		[replacePaneState, requestRenderAction],
	);

	const contextValue = useMemo(
		() => ({ panes, requestRender, releasePane }),
		[panes, releasePane, requestRender],
	);

	return (
		<FlexLayoutNextContext.Provider value={contextValue}>
			{children}
		</FlexLayoutNextContext.Provider>
	);
}

export function useFlexLayoutNextContext() {
	return useContext(FlexLayoutNextContext);
}
