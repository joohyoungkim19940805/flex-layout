"use client";

import { createRxStateTuple } from "@byeolnaerim/global-rx-state";
import equal from "fast-deep-equal/react";
import { usePathname, useSearchParams } from "next/navigation";
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
import type { DropTargetComponent } from "../../flex-layout/hooks/useDrag";
import { FlexLayoutSplitScreenRuntimeProvider } from "../../flex-layout/providers/FlexLayoutSplitScreenRuntimeContext";
import {
	getLayoutSplitScreenStore,
	layoutSplitScreenStore,
	setLayoutSplitScreenStore,
	type LayoutSplitScreenState,
} from "../../flex-layout/store/FlexLayoutContainerStore";
import {
	EMPTY_FLEX_LAYOUT_NEXT_PERSISTED_STATE,
	restoreFlexLayoutNextRoot,
	serializeFlexLayoutNextRoot,
	type FlexLayoutNextPersistedSnapshot,
	type FlexLayoutNextPersistedState,
} from "../persistence/FlexLayoutNextPersistence";
import type {
	FlexLayoutNextRenderedPane,
	FlexLayoutNextRenderRequest,
	FlexLayoutNextRequestRenderAction,
	FlexLayoutNextSplitScreenPersistenceOptions,
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
	providerId: string;
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

function normalizePersistedState(value: FlexLayoutNextPersistedState) {
	return value?.version === 4
		? value
		: EMPTY_FLEX_LAYOUT_NEXT_PERSISTED_STATE;
}

export interface FlexLayoutNextClientProviderProps {
	children: ReactNode;
	providerId: string;
	requestRenderAction: FlexLayoutNextRequestRenderAction;
	renderedPane?: FlexLayoutNextRenderedPane;
	persistence?: FlexLayoutNextSplitScreenPersistenceOptions;
}

export function FlexLayoutNextClientProvider({
	children,
	providerId,
	requestRenderAction,
	renderedPane,
	persistence,
}: FlexLayoutNextClientProviderProps) {
	const paneStateRef = useRef<FlexLayoutNextPaneStateMap>({});
	const releaseTimerRef = useRef<Record<string, number | undefined>>({});
	const renderQueueRef = useRef<FlexLayoutNextRenderRequest[]>([]);
	const activeRenderRequestRef = useRef<FlexLayoutNextRenderRequest | undefined>(
		undefined,
	);
	const activeRenderTimeoutRef = useRef<number | undefined>(undefined);
	const processRenderQueueRef = useRef<() => void>(() => {});
	const [panes, setPanes] = useState<FlexLayoutNextPaneStateMap>({});
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const browserUrlKey = `${pathname ?? ""}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
	const persistenceEnabled = Boolean(
		persistence && (persistence.restoreOnReload ?? true),
	);
	const syncWithBrowserUrl = Boolean(
		persistenceEnabled && persistence?.syncWithBrowserUrl,
	);
	const persistenceEntry = useMemo(() => {
		if (!persistenceEnabled || !persistence) return undefined;

		return createRxStateTuple<FlexLayoutNextPersistedState>(
			EMPTY_FLEX_LAYOUT_NEXT_PERSISTED_STATE,
			persistence.keyName ?? `__flexLayoutNextSplitScreen:${providerId}`,
			{
				storage: persistence.storage,
				name: persistence.name,
				storeName: persistence.storeName,
				keyPrefix: persistence.keyPrefix,
			},
		);
	}, [
		persistenceEnabled,
		persistence?.keyName,
		persistence?.storage,
		persistence?.name,
		persistence?.storeName,
		persistence?.keyPrefix,
		providerId,
	]);
	const [readyPersistenceEntry, setReadyPersistenceEntry] = useState<
		typeof persistenceEntry
	>(undefined);
	const isPersistenceReady =
		!persistenceEntry || readyPersistenceEntry === persistenceEntry;
	const registeredRootResolversRef = useRef(
		new Map<string, () => DropTargetComponent>(),
	);
	const restoringRootsRef = useRef(new Set<string>());
	const persistedStateRef = useRef<FlexLayoutNextPersistedState>(
		EMPTY_FLEX_LAYOUT_NEXT_PERSISTED_STATE,
	);
	const currentUrlKeyRef = useRef(browserUrlKey);
	const hydratedRef = useRef(!persistenceEntry);
	const isApplyingRestoreRef = useRef(false);
	const restoreReleaseFrameRef = useRef<number | undefined>(undefined);
	const snapshotSaveTimerRef = useRef<number | undefined>(undefined);
	const persistenceWriteTimerRef = useRef<number | undefined>(undefined);

	const replacePaneState = useCallback(
		(screenKey: string, state: FlexLayoutNextPaneState) => {
			paneStateRef.current = {
				...paneStateRef.current,
				[screenKey]: state,
			};
			setPanes(paneStateRef.current);
		},
		[],
	);

	const finishActiveRenderRequest = useCallback((requestId: string) => {
		if (activeRenderRequestRef.current?.requestId !== requestId) return;
		if (activeRenderTimeoutRef.current !== undefined) {
			window.clearTimeout(activeRenderTimeoutRef.current);
			activeRenderTimeoutRef.current = undefined;
		}
		activeRenderRequestRef.current = undefined;
		queueMicrotask(() => processRenderQueueRef.current());
	}, []);

	const processRenderQueue = useCallback(() => {
		if (activeRenderRequestRef.current) return;
		const next = renderQueueRef.current.shift();
		if (!next) return;

		activeRenderRequestRef.current = next;
		activeRenderTimeoutRef.current = window.setTimeout(() => {
			if (activeRenderRequestRef.current?.requestId !== next.requestId) return;
			const current = paneStateRef.current[next.screenKey];
			if (current?.requestId === next.requestId) {
				replacePaneState(next.screenKey, {
					...current,
					status: "error",
					error: "Timed out while requesting server rendering.",
				});
			}
			finishActiveRenderRequest(next.requestId);
		}, 15000);

		void requestRenderAction(next)
			.then((result) => {
				if (result.ok) return;
				const current = paneStateRef.current[next.screenKey];
				if (current?.requestId === next.requestId) {
					replacePaneState(next.screenKey, {
						...current,
						status: "error",
						error:
							result.message ?? "Unable to request server rendering.",
					});
				}
				finishActiveRenderRequest(next.requestId);
			})
			.catch((error) => {
				const current = paneStateRef.current[next.screenKey];
				if (current?.requestId === next.requestId) {
					replacePaneState(next.screenKey, {
						...current,
						status: "error",
						error:
							error instanceof Error
								? error.message
								: "Unable to request server rendering.",
					});
				}
				finishActiveRenderRequest(next.requestId);
			});
	}, [finishActiveRenderRequest, replacePaneState, requestRenderAction]);

	processRenderQueueRef.current = processRenderQueue;

	useEffect(() => {
		if (!renderedPane) return;

		const current = paneStateRef.current[renderedPane.screenKey];
		if (
			current?.requestId === renderedPane.requestId &&
			current.url === renderedPane.url
		) {
			replacePaneState(renderedPane.screenKey, {
				url: renderedPane.url,
				requestId: renderedPane.requestId,
				status: "ready",
				content: renderedPane.content,
			});
		}

		finishActiveRenderRequest(renderedPane.requestId);
	}, [renderedPane, finishActiveRenderRequest, replacePaneState]);

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
			renderQueueRef.current = renderQueueRef.current.filter(
				(item) => item.screenKey !== screenKey,
			);
			renderQueueRef.current.push({ requestId, screenKey, url });
			processRenderQueueRef.current();
		},
		[replacePaneState],
	);

	const releasePane = useCallback((screenKey: string) => {
		renderQueueRef.current = renderQueueRef.current.filter(
			(item) => item.screenKey !== screenKey,
		);
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

	const flushPersistedState = useCallback(() => {
		if (!persistenceEntry) return;
		if (persistenceWriteTimerRef.current !== undefined) {
			window.clearTimeout(persistenceWriteTimerRef.current);
			persistenceWriteTimerRef.current = undefined;
		}
		if (!equal(persistenceEntry[1](), persistedStateRef.current)) {
			persistenceEntry[0](persistedStateRef.current);
		}
	}, [persistenceEntry]);

	const writePersistedState = useCallback(
		(next: FlexLayoutNextPersistedState, flush = false) => {
			if (!persistenceEntry || equal(persistedStateRef.current, next)) return;
			persistedStateRef.current = next;
			if (persistenceWriteTimerRef.current !== undefined) {
				window.clearTimeout(persistenceWriteTimerRef.current);
			}
			if (flush) {
				persistenceWriteTimerRef.current = undefined;
				persistenceEntry[0](next);
				return;
			}
			persistenceWriteTimerRef.current = window.setTimeout(() => {
				persistenceWriteTimerRef.current = undefined;
				persistenceEntry[0](persistedStateRef.current);
			}, 80);
		},
		[persistenceEntry],
	);

	const saveRegisteredRoots = useCallback(
		(
			state: LayoutSplitScreenState,
			urlKey = currentUrlKeyRef.current,
			flush = false,
		) => {
			if (!persistenceEnabled || !hydratedRef.current) return;

			const currentPersisted = persistedStateRef.current;
			const currentSnapshot = syncWithBrowserUrl
				? currentPersisted.byUrl?.[urlKey]
				: currentPersisted.latest;
			const nextSnapshot: FlexLayoutNextPersistedSnapshot = {
				version: 1,
				roots: { ...currentSnapshot?.roots },
			};

			registeredRootResolversRef.current.forEach((_, rootName) => {
				const serialized = serializeFlexLayoutNextRoot(
					state,
					rootName,
					providerId,
				);
				if (serialized) nextSnapshot.roots[rootName] = serialized;
			});

			writePersistedState(
				syncWithBrowserUrl
					? {
							...currentPersisted,
							version: 4,
							byUrl: {
								...currentPersisted.byUrl,
								[urlKey]: nextSnapshot,
							},
						}
					: {
							...currentPersisted,
							version: 4,
							latest: nextSnapshot,
						},
				flush,
			);
		},
		[persistenceEnabled, providerId, syncWithBrowserUrl, writePersistedState],
	);

	const releaseRestoreGuard = useCallback(() => {
		if (restoreReleaseFrameRef.current !== undefined) {
			window.cancelAnimationFrame(restoreReleaseFrameRef.current);
		}
		restoreReleaseFrameRef.current = window.requestAnimationFrame(() => {
			restoreReleaseFrameRef.current = window.requestAnimationFrame(() => {
				restoreReleaseFrameRef.current = undefined;
				isApplyingRestoreRef.current = false;
				restoringRootsRef.current.clear();
			});
		});
	}, []);

	const applyPersistedSnapshot = useCallback(
		(snapshot: FlexLayoutNextPersistedSnapshot | undefined, onlyRootName?: string) => {
			if (!snapshot) return false;

			let nextState = getLayoutSplitScreenStore();
			let changed = false;
			registeredRootResolversRef.current.forEach(
				(getRootComponent, rootName) => {
					if (onlyRootName && rootName !== onlyRootName) return;
					const persistedRoot = snapshot.roots[rootName];
					if (!persistedRoot) return;

					const restoredLayouts = restoreFlexLayoutNextRoot({
						rootName,
						providerId,
						persistedRoot,
						rootComponent: getRootComponent(),
					});
					if (Object.keys(restoredLayouts).length === 0) return;

					nextState = {
						...nextState,
						[rootName]: restoredLayouts,
					};
					restoringRootsRef.current.add(rootName);
					changed = true;
				},
			);

			if (!changed) return false;
			isApplyingRestoreRef.current = true;
			setLayoutSplitScreenStore(nextState);
			releaseRestoreGuard();
			return true;
		},
		[providerId, releaseRestoreGuard],
	);

	const registerRoot = useCallback(
		(layoutName: string, getRootComponent: () => DropTargetComponent) => {
			registeredRootResolversRef.current.set(layoutName, getRootComponent);

			if (persistenceEnabled && hydratedRef.current) {
				const snapshot = syncWithBrowserUrl
					? persistedStateRef.current.byUrl?.[currentUrlKeyRef.current]
					: persistedStateRef.current.latest;
				applyPersistedSnapshot(snapshot, layoutName);
			}

			return () => {
				registeredRootResolversRef.current.delete(layoutName);
				restoringRootsRef.current.delete(layoutName);
			};
		},
		[persistenceEnabled, syncWithBrowserUrl, applyPersistedSnapshot],
	);

	useEffect(() => {
		if (!persistenceEntry) {
			hydratedRef.current = true;
			persistedStateRef.current = EMPTY_FLEX_LAYOUT_NEXT_PERSISTED_STATE;
			setReadyPersistenceEntry(undefined);
			return;
		}

		let canceled = false;
		hydratedRef.current = false;
		void persistenceEntry[4].then(() => {
			if (canceled) return;
			persistedStateRef.current = normalizePersistedState(persistenceEntry[1]());
			hydratedRef.current = true;
			setReadyPersistenceEntry(persistenceEntry);
		});

		return () => {
			canceled = true;
		};
	}, [persistenceEntry]);

	useEffect(() => {
		if (!persistenceEnabled || !isPersistenceReady || !syncWithBrowserUrl) {
			currentUrlKeyRef.current = browserUrlKey;
			return;
		}
		if (currentUrlKeyRef.current === browserUrlKey) return;

		if (snapshotSaveTimerRef.current !== undefined) {
			window.clearTimeout(snapshotSaveTimerRef.current);
			snapshotSaveTimerRef.current = undefined;
		}

		const previousUrlKey = currentUrlKeyRef.current;
		saveRegisteredRoots(getLayoutSplitScreenStore(), previousUrlKey, true);
		currentUrlKeyRef.current = browserUrlKey;

		if (
			!applyPersistedSnapshot(
				persistedStateRef.current.byUrl?.[browserUrlKey],
			)
		) {
			saveRegisteredRoots(getLayoutSplitScreenStore(), browserUrlKey, true);
		}
	}, [
		browserUrlKey,
		persistenceEnabled,
		isPersistenceReady,
		syncWithBrowserUrl,
		applyPersistedSnapshot,
		saveRegisteredRoots,
	]);

	useEffect(() => {
		if (!persistenceEnabled || !isPersistenceReady) return;

		const subscription = layoutSplitScreenStore.subscribe((state) => {
			if (!hydratedRef.current || isApplyingRestoreRef.current) return;
			if (snapshotSaveTimerRef.current !== undefined) {
				window.clearTimeout(snapshotSaveTimerRef.current);
			}
			const urlKeyAtChange = currentUrlKeyRef.current;
			snapshotSaveTimerRef.current = window.setTimeout(() => {
				snapshotSaveTimerRef.current = undefined;
				saveRegisteredRoots(state, urlKeyAtChange);
			}, 30);
		});

		return () => subscription.unsubscribe();
	}, [persistenceEnabled, isPersistenceReady, saveRegisteredRoots]);

	const flushCurrentSnapshot = useCallback(() => {
		if (!persistenceEnabled || !hydratedRef.current) return;
		if (snapshotSaveTimerRef.current !== undefined) {
			window.clearTimeout(snapshotSaveTimerRef.current);
			snapshotSaveTimerRef.current = undefined;
		}
		saveRegisteredRoots(
			getLayoutSplitScreenStore(),
			currentUrlKeyRef.current,
			true,
		);
		flushPersistedState();
	}, [persistenceEnabled, saveRegisteredRoots, flushPersistedState]);

	useEffect(() => {
		if (!persistenceEnabled || !isPersistenceReady) return;

		const handleVisibilityChange = () => {
			if (document.visibilityState === "hidden") flushCurrentSnapshot();
		};
		window.addEventListener("pagehide", flushCurrentSnapshot);
		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			window.removeEventListener("pagehide", flushCurrentSnapshot);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [persistenceEnabled, isPersistenceReady, flushCurrentSnapshot]);

	useEffect(() => {
		return () => {
			Object.values(releaseTimerRef.current).forEach((timer) => {
				if (timer !== undefined) window.clearTimeout(timer);
			});
			if (activeRenderTimeoutRef.current !== undefined) {
				window.clearTimeout(activeRenderTimeoutRef.current);
			}
			if (restoreReleaseFrameRef.current !== undefined) {
				window.cancelAnimationFrame(restoreReleaseFrameRef.current);
			}
			if (snapshotSaveTimerRef.current !== undefined) {
				window.clearTimeout(snapshotSaveTimerRef.current);
			}
			flushCurrentSnapshot();
		};
	}, [flushCurrentSnapshot]);

	const contextValue = useMemo(
		() => ({ providerId, panes, requestRender, releasePane }),
		[providerId, panes, releasePane, requestRender],
	);
	const splitScreenRuntimeValue = useMemo(
		() => ({
			registerRoot,
			isRestoringRoot: (rootName: string) =>
				restoringRootsRef.current.has(rootName),
		}),
		[registerRoot],
	);

	if (persistenceEnabled && !isPersistenceReady) return null;

	return (
		<FlexLayoutSplitScreenRuntimeProvider value={splitScreenRuntimeValue}>
			<FlexLayoutNextContext.Provider value={contextValue}>
				{children}
			</FlexLayoutNextContext.Provider>
		</FlexLayoutSplitScreenRuntimeProvider>
	);
}

export function useFlexLayoutNextContext() {
	return useContext(FlexLayoutNextContext);
}
