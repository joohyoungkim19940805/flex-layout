"use client";

import {
	createRxStateTuple,
	type RxStateStorageOptions,
} from "@byeolnaerim/global-rx-state";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { animationFrameScheduler, auditTime, fromEvent } from "rxjs";
import { useDecompositionLayout } from "../providers";
import { mathGrow, resize } from "../utils";

const ROUTE_RATIO_EPSILON = 0.02;
const ROUTE_SYNC_MAX_FRAMES = 24;
const ROUTE_SYNC_REQUIRED_STABLE_FRAMES = 3;

const FLEX_TRANSITION = "flex 0.2s ease";
const FLEX_TRANSITION_FALLBACK_MS = 320;
const SCROLL_DIRECTION_DELTA = 4;
const SCROLL_EVENT_AUDIT_MS = 80;
const SCROLL_HIDE_THRESHOLD = 24;
const SCROLL_SHOW_THRESHOLD = 16;

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

export type UseFlexLayoutControlParams = {
	/**
	 * Decomposition layout name containing the target flex container.
	 */
	layoutName: string;

	/**
	 * Decomposition container name to control by flex-grow.
	 *
	 * The target container is expected to be a direct child of a flex layout
	 * parent that provides `data-direction="row"` or `data-direction="column"`.
	 */
	containerName: string;

	/**
	 * Current route pathname.
	 *
	 * Used to detect route changes and preserve the current main-axis size ratio
	 * across pages.
	 */
	pathname: string;

	/**
	 * Explicitly controls whether the target container is hidden or shown.
	 *
	 * - `true`: collapses the target container to flex-grow 0 and disables
	 *   scroll-based automatic hide/show.
	 * - `false`: restores the target container and disables scroll-based
	 *   automatic hide/show.
	 * - `null` or `undefined`: does not explicitly control visibility. In this
	 *   state, `enableScrollHideOnScroll` controls whether scroll-based
	 *   automatic hide/show is enabled.
	 */
	hideContainer?: boolean | null;

	/**
	 * Enables automatic container collapsing while scrolling.
	 *
	 * When true and `hideContainer` is `null` or `undefined`, the target
	 * container collapses on downward scroll and expands on upward scroll or
	 * when the page returns to the top. This is implemented by changing the
	 * container's flex-grow value, not by directly setting height, width,
	 * display, or visibility.
	 *
	 * This option has no effect when `hideContainer` is explicitly `true` or
	 * `false`.
	 */
	enableScrollHideOnScroll: boolean;

	/**
	 * Named key used by global-rx-state to store the measured main-axis size of
	 * the target container.
	 *
	 * The measured axis is resolved from the parent flex layout direction:
	 * - `data-direction="column"` stores height.
	 * - `data-direction="row"` stores width.
	 *
	 * When omitted, the key is derived from `layoutName` and `containerName`.
	 *
	 * @default `__${layoutName}_${containerName}Size`
	 */
	containerSizeKeyName?: string;

	/**
	 * Storage options passed to global-rx-state.
	 *
	 * When omitted, global-rx-state uses its default in-memory storage behavior.
	 */
	containerSizeStorageOptions?: RxStateStorageOptions;
};

export function useFlexLayoutControl({
	layoutName,
	containerName,
	pathname,
	hideContainer,
	enableScrollHideOnScroll,
	containerSizeKeyName = `__${layoutName}_${containerName}Size`,
	containerSizeStorageOptions,
}: UseFlexLayoutControlParams) {
	const contentRef = useRef<HTMLDivElement | null>(null);
	const lastPathnameRef = useRef<string>(pathname);

	const routeSyncRafRef = useRef<number>(0);
	const routeSyncFrameCountRef = useRef(0);
	const routeSyncStableCountRef = useRef(0);
	const preservedRatioOnRouteChangeRef = useRef<number | null>(null);
	const pendingRoutePathRef = useRef<string | null>(null);

	const currentVisibleHeightRef = useRef(0);
	const currentContentHeightRef = useRef(0);
	const currentRatioRef = useRef(1);

	const currentGrowRef = useRef(0);
	const lastExpandedGrowRef = useRef(0);
	const containerHiddenByScrollRef = useRef(false);
	const lastScrollYRef = useRef(0);
	const scrollPivotYRef = useRef(0);
	const lastScrollDirectionRef = useRef<-1 | 0 | 1>(0);

	const transitionCleanupRef = useRef<(() => void) | null>(null);

	const [setContainerSize] = createRxStateTuple(
		0,
		containerSizeKeyName,
		containerSizeStorageOptions,
	);

	const { layout: containers, container } = useDecompositionLayout({
		layoutName,
		containerName,
	});

	const clearFlexTransition = useCallback(() => {
		if (transitionCleanupRef.current) {
			transitionCleanupRef.current();
			transitionCleanupRef.current = null;
		}
	}, []);

	const prepareFlexTransition = useCallback(
		(target: HTMLElement) => {
			clearFlexTransition();

			target.style.transition = FLEX_TRANSITION;

			let timeoutId = 0;

			const cleanup = () => {
				target.removeEventListener(
					"transitionend",
					handleTransitionEnd,
				);
				window.clearTimeout(timeoutId);
				target.style.transition = "";

				if (transitionCleanupRef.current === cleanup) {
					transitionCleanupRef.current = null;
				}
			};

			const handleTransitionEnd = (event: TransitionEvent) => {
				if (event.target !== target) return;
				if (
					event.propertyName !== "flex" &&
					event.propertyName !== "flex-grow" &&
					event.propertyName !== "flex-basis"
				) {
					return;
				}

				cleanup();
			};

			timeoutId = window.setTimeout(cleanup, FLEX_TRANSITION_FALLBACK_MS);

			target.addEventListener("transitionend", handleTransitionEnd);
			transitionCleanupRef.current = cleanup;
		},
		[clearFlexTransition],
	);

	const applyContainerGrow = useCallback(
		(
			newGrow: number,
			options?: {
				animate?: boolean;
				rememberExpandedGrow?: boolean;
			},
		) => {
			if (!container || !containers || containers.length === 0) {
				return false;
			}

			if (options?.animate) {
				prepareFlexTransition(container);
			} else {
				clearFlexTransition();
			}

			container.dataset.grow = String(newGrow);
			container.style.flex = `${newGrow} 1 0%`;

			currentGrowRef.current = newGrow;

			if (options?.rememberExpandedGrow ?? newGrow > 0) {
				lastExpandedGrowRef.current = newGrow;
			}

			let notGrowList: Array<HTMLElement> = [];

			const totalGrow = containers
				.filter((element) => element !== container)
				.reduce((remainingGrow, element) => {
					if (element.hasAttribute("data-grow") === false) {
						notGrowList.push(element);
						return remainingGrow;
					}

					const grow = parseFloat(element.dataset.grow || "");
					element.style.flex = `${grow} 1 0%`;
					return remainingGrow - grow;
				}, containers.length - newGrow);

			if (notGrowList.length !== 0) {
				resize(notGrowList, totalGrow);
			}

			return true;
		},
		[clearFlexTransition, container, containers, prepareFlexTransition],
	);

	const readCurrentGrow = useCallback(() => {
		if (!container) {
			return (
				lastExpandedGrowRef.current ||
				currentGrowRef.current ||
				containers?.length ||
				1
			);
		}

		const datasetGrow = parseFloat(container.dataset.grow || "");
		if (Number.isFinite(datasetGrow)) {
			return datasetGrow;
		}

		const inlineFlexGrow = parseFloat(container.style.flexGrow || "");
		if (Number.isFinite(inlineFlexGrow)) {
			return inlineFlexGrow;
		}

		const computedFlexGrow = parseFloat(
			window.getComputedStyle(container).flexGrow || "",
		);
		if (Number.isFinite(computedFlexGrow)) {
			return computedFlexGrow;
		}

		return (
			lastExpandedGrowRef.current ||
			currentGrowRef.current ||
			containers?.length ||
			1
		);
	}, [container, containers]);

	const hideByScroll = useCallback(() => {
		if (!container || containerHiddenByScrollRef.current) return;

		const currentGrow = readCurrentGrow();

		if (currentGrow > 0) {
			lastExpandedGrowRef.current = currentGrow;
		}

		containerHiddenByScrollRef.current = true;

		applyContainerGrow(0, {
			animate: true,
			rememberExpandedGrow: false,
		});
	}, [applyContainerGrow, container, readCurrentGrow]);

	const showByScroll = useCallback(
		(animate: boolean) => {
			if (!container) return;

			const nextGrow =
				lastExpandedGrowRef.current > 0
					? lastExpandedGrowRef.current
					: containers?.length || 1;

			containerHiddenByScrollRef.current = false;

			applyContainerGrow(nextGrow, {
				animate,
				rememberExpandedGrow: true,
			});
		},
		[applyContainerGrow, container, containers],
	);

	const getVisibleHeight = useCallback(() => {
		const target = container ?? contentRef.current;
		if (!target) return 0;

		return Math.max(0, Math.ceil(target.getBoundingClientRect().height));
	}, [container]);

	const getContentHeight = useCallback(() => {
		const content = contentRef.current;
		if (!content) return 0;

		return Math.max(
			0,
			Math.ceil(
				Math.max(
					content.scrollHeight || 0,
					content.offsetHeight || 0,
					content.getBoundingClientRect().height || 0,
				),
			),
		);
	}, []);

	const getParentHeight = useCallback(() => {
		if (!container?.parentElement) return 0;

		return Math.max(
			0,
			Math.ceil(container.parentElement.getBoundingClientRect().height),
		);
	}, [container]);

	const applyGrowByPreservedRatio = useCallback(() => {
		if (!container || !containers || containers.length === 0) return false;

		const preservedRatio = preservedRatioOnRouteChangeRef.current;
		if (preservedRatio == null) return false;

		const parentHeight = getParentHeight();
		const contentHeight = getContentHeight();

		if (parentHeight === 0 || contentHeight === 0) return false;

		const desiredRatio = clamp(preservedRatio, 0, 1);
		const desiredVisibleHeight = contentHeight * desiredRatio;
		const newGrow = mathGrow(
			desiredVisibleHeight,
			parentHeight,
			containers.length,
		);

		if (containerHiddenByScrollRef.current) {
			lastExpandedGrowRef.current = newGrow;
			return true;
		}

		return applyContainerGrow(newGrow);
	}, [
		applyContainerGrow,
		container,
		containers,
		getContentHeight,
		getParentHeight,
	]);

	const stopRouteSync = useCallback(() => {
		if (routeSyncRafRef.current) {
			cancelAnimationFrame(routeSyncRafRef.current);
			routeSyncRafRef.current = 0;
		}

		routeSyncFrameCountRef.current = 0;
		routeSyncStableCountRef.current = 0;
		preservedRatioOnRouteChangeRef.current = null;
		pendingRoutePathRef.current = null;
	}, []);

	const runRouteSync = useCallback(() => {
		routeSyncRafRef.current = 0;

		const pendingPath = pendingRoutePathRef.current;
		const preservedRatio = preservedRatioOnRouteChangeRef.current;

		if (pendingPath !== pathname || preservedRatio == null) {
			stopRouteSync();
			return;
		}

		applyGrowByPreservedRatio();

		const visibleHeight = getVisibleHeight();
		const contentHeight = getContentHeight();
		const actualRatio =
			contentHeight > 0 ? clamp(visibleHeight / contentHeight, 0, 1) : 1;

		const diff = Math.abs(actualRatio - preservedRatio);

		if (diff <= ROUTE_RATIO_EPSILON) {
			routeSyncStableCountRef.current += 1;
		} else {
			routeSyncStableCountRef.current = 0;
		}

		routeSyncFrameCountRef.current += 1;

		if (
			routeSyncStableCountRef.current >=
				ROUTE_SYNC_REQUIRED_STABLE_FRAMES ||
			routeSyncFrameCountRef.current >= ROUTE_SYNC_MAX_FRAMES
		) {
			stopRouteSync();
			return;
		}

		routeSyncRafRef.current = requestAnimationFrame(runRouteSync);
	}, [
		applyGrowByPreservedRatio,
		getContentHeight,
		getVisibleHeight,
		pathname,
		stopRouteSync,
	]);

	const startRouteSync = useCallback(() => {
		if (routeSyncRafRef.current) return;
		routeSyncRafRef.current = requestAnimationFrame(runRouteSync);
	}, [runRouteSync]);

	useEffect(() => {
		const currentGrow = readCurrentGrow();

		if (currentGrow > 0) {
			currentGrowRef.current = currentGrow;
			lastExpandedGrowRef.current = currentGrow;
		}
	}, [readCurrentGrow]);

	useLayoutEffect(() => {
		const previousPathname = lastPathnameRef.current;

		if (previousPathname !== pathname) {
			const ratioToPreserve =
				currentContentHeightRef.current > 0
					? currentVisibleHeightRef.current /
						currentContentHeightRef.current
					: currentRatioRef.current || 1;

			preservedRatioOnRouteChangeRef.current = clamp(
				ratioToPreserve,
				0,
				1,
			);
			pendingRoutePathRef.current = pathname;
			routeSyncFrameCountRef.current = 0;
			routeSyncStableCountRef.current = 0;

			startRouteSync();
		}

		lastPathnameRef.current = pathname;
	}, [pathname, startRouteSync]);

	useEffect(() => {
		const target = container ?? contentRef.current;
		const parent = container?.parentElement ?? null;

		if (!target) return;

		let measureRaf = 0;

		const commitMeasure = () => {
			measureRaf = 0;

			const visibleHeight = getVisibleHeight();
			const contentHeight = getContentHeight();
			const ratio =
				contentHeight > 0
					? clamp(visibleHeight / contentHeight, 0, 1)
					: 1;

			currentVisibleHeightRef.current = visibleHeight;
			currentContentHeightRef.current = contentHeight;
			currentRatioRef.current = ratio;

			setContainerSize(visibleHeight);
		};

		const scheduleMeasure = () => {
			if (measureRaf) return;
			measureRaf = requestAnimationFrame(commitMeasure);
		};

		scheduleMeasure();

		const resizeObserver = new ResizeObserver(() => {
			scheduleMeasure();

			if (pendingRoutePathRef.current === pathname) {
				startRouteSync();
			}
		});

		resizeObserver.observe(target);

		if (contentRef.current && contentRef.current !== target) {
			resizeObserver.observe(contentRef.current);
		}

		if (parent && parent !== target) {
			resizeObserver.observe(parent);
		}

		const handleWindowResize = () => {
			scheduleMeasure();

			if (pendingRoutePathRef.current === pathname) {
				startRouteSync();
			}
		};

		const handleViewportResize = () => {
			scheduleMeasure();

			if (pendingRoutePathRef.current === pathname) {
				startRouteSync();
			}
		};

		window.addEventListener("resize", handleWindowResize);
		window.visualViewport?.addEventListener("resize", handleViewportResize);

		return () => {
			if (measureRaf) cancelAnimationFrame(measureRaf);
			resizeObserver.disconnect();
			window.removeEventListener("resize", handleWindowResize);
			window.visualViewport?.removeEventListener(
				"resize",
				handleViewportResize,
			);
		};
	}, [
		pathname,
		container,
		getContentHeight,
		getVisibleHeight,
		setContainerSize,
		startRouteSync,
	]);

	useEffect(() => {
		lastScrollYRef.current = window.scrollY;
		scrollPivotYRef.current = window.scrollY;
		lastScrollDirectionRef.current = 0;

		if (hideContainer === true) {
			hideByScroll();
			return;
		}

		if (hideContainer === false || !enableScrollHideOnScroll) {
			if (containerHiddenByScrollRef.current) {
				showByScroll(false);
			}
			return;
		}

		const scrollSubscription = fromEvent(window, "scroll", {
			passive: true,
		})
			.pipe(auditTime(SCROLL_EVENT_AUDIT_MS, animationFrameScheduler))
			.subscribe(() => {
				const nextScrollY = window.scrollY;
				const diff = nextScrollY - lastScrollYRef.current;

				if (Math.abs(diff) < SCROLL_DIRECTION_DELTA) {
					lastScrollYRef.current = nextScrollY;
					return;
				}

				if (nextScrollY <= 0) {
					showByScroll(true);
					lastScrollYRef.current = nextScrollY;
					scrollPivotYRef.current = nextScrollY;
					lastScrollDirectionRef.current = 0;
					return;
				}

				const nextDirection: -1 | 1 = diff > 0 ? 1 : -1;

				if (lastScrollDirectionRef.current !== nextDirection) {
					lastScrollDirectionRef.current = nextDirection;
					scrollPivotYRef.current = nextScrollY;
					lastScrollYRef.current = nextScrollY;
					return;
				}

				const accumulatedDiff = nextScrollY - scrollPivotYRef.current;

				if (
					nextDirection > 0 &&
					!containerHiddenByScrollRef.current &&
					accumulatedDiff >= SCROLL_HIDE_THRESHOLD
				) {
					hideByScroll();
					scrollPivotYRef.current = nextScrollY;
				}

				if (
					nextDirection < 0 &&
					containerHiddenByScrollRef.current &&
					accumulatedDiff <= -SCROLL_SHOW_THRESHOLD
				) {
					showByScroll(true);
					scrollPivotYRef.current = nextScrollY;
				}

				lastScrollYRef.current = nextScrollY;
			});

		return () => {
			scrollSubscription.unsubscribe();

			if (containerHiddenByScrollRef.current) {
				showByScroll(false);
			}
		};
	}, [enableScrollHideOnScroll, hideByScroll, hideContainer, showByScroll]);

	useEffect(() => {
		return () => {
			stopRouteSync();
			clearFlexTransition();
		};
	}, [clearFlexTransition, stopRouteSync]);

	return {
		contentRef,
	};
}

export type CreateContainerSizeStateParams = {
	/**
	 * Named key used by global-rx-state to access the container size store.
	 *
	 * Use the same value as `containerSizeKeyName` passed to
	 * `useFlexLayoutControl`.
	 *
	 * @example "__main_sidebarSize"
	 */
	containerSizeKeyName: string;

	/**
	 * Storage options passed to global-rx-state.
	 *
	 * Use the same value as `containerSizeStorageOptions` passed to
	 * `useFlexLayoutControl`. The storage option is part of the named store
	 * identity, so changing it can point to a different store.
	 */
	containerSizeStorageOptions?: RxStateStorageOptions;
};

/**
 * Creates or retrieves the global-rx-state tuple used by flex-layout to store
 * a measured container size.
 *
 * If the consuming project directly depends on
 * `@byeolnaerim/global-rx-state`, it may call `createRxStateTuple` with the
 * same `containerSizeKeyName` and `containerSizeStorageOptions`.
 *
 * If the consuming project does not directly depend on
 * `@byeolnaerim/global-rx-state`, use this helper instead. It exposes the same
 * container size state through flex-layout without requiring consumers to import
 * `@byeolnaerim/global-rx-state` directly.
 *
 * The returned tuple is:
 *
 * - `setContainerSize`
 * - `getContainerSize`
 * - `useContainerSize`
 * - `containerSizeSubject`
 * - `containerSizeReady`
 */
export function createContainerSizeState({
	containerSizeKeyName,
	containerSizeStorageOptions,
}: CreateContainerSizeStateParams) {
	return createRxStateTuple(
		0,
		containerSizeKeyName,
		containerSizeStorageOptions,
	);
}
