"use client";

import {
	mathGrow,
	resize,
	useDecompositionLayout,
} from "@byeolnaerim/flex-layout";

import {
	createRxStateTuple,
	type RxStateStorageOptions,
} from "@byeolnaerim/global-rx-state";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { animationFrameScheduler, auditTime, fromEvent } from "rxjs";
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

type UseHeaderLayoutControlParams = {
	/**
	 * Current route pathname.
	 *
	 * Used to detect route changes and preserve the current header visibility
	 * ratio across pages.
	 */
	pathname: string;

	/**
	 * Indicates that the header visibility is controlled by an external
	 * route/layout condition.
	 *
	 * When true, this hook disables scroll-based header hiding and restores any
	 * header state that was previously hidden by scroll. The actual hidden state
	 * is expected to be handled outside of this hook.
	 */
	hideHeader: boolean;

	/**
	 * Enables automatic header hiding while scrolling.
	 *
	 * When true, the header hides on downward scroll and reappears on upward
	 * scroll or when the page returns to the top. This option has no effect when
	 * `hideHeader` is true.
	 */
	enableScrollHideOnScroll: boolean;

	/**
	 * Named key used by global-rx-state to store the measured header height.
	 *
	 * This is useful when multiple layouts or applications use the same hook and
	 * need independent header-height stores. The default key intentionally uses a
	 * double-underscore prefix to reduce collisions with application-level state.
	 *
	 * @default "__headerHeight"
	 */
	headerHeightKeyName?: string;

	/**
	 * Storage options passed to global-rx-state.
	 *
	 * When omitted, global-rx-state uses its default in-memory storage behavior.
	 */
	headerHeightStorageOptions?: RxStateStorageOptions;
};

export default function useHeaderLayoutControl({
	pathname,
	hideHeader,
	enableScrollHideOnScroll,
	headerHeightKeyName = "__headerHeight",
	headerHeightStorageOptions,
}: UseHeaderLayoutControlParams) {
	const appBarRef = useRef<HTMLDivElement | null>(null);
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
	const headerHiddenByScrollRef = useRef(false);
	const lastScrollYRef = useRef(0);
	const scrollPivotYRef = useRef(0);
	const lastScrollDirectionRef = useRef<-1 | 0 | 1>(0);

	const transitionCleanupRef = useRef<(() => void) | null>(null);

	const [setHeaderHeight] = createRxStateTuple(
		0,
		headerHeightKeyName,
		headerHeightStorageOptions,
	);

	const { layout: containers, container } = useDecompositionLayout({
		layoutName: "root",
		containerName: "head",
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
		if (!container || headerHiddenByScrollRef.current) return;

		const currentGrow = readCurrentGrow();

		if (currentGrow > 0) {
			lastExpandedGrowRef.current = currentGrow;
		}

		headerHiddenByScrollRef.current = true;

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

			headerHiddenByScrollRef.current = false;

			applyContainerGrow(nextGrow, {
				animate,
				rememberExpandedGrow: true,
			});
		},
		[applyContainerGrow, container, containers],
	);

	const getVisibleHeight = useCallback(() => {
		const target = container ?? appBarRef.current;
		if (!target) return 0;

		return Math.max(0, Math.ceil(target.getBoundingClientRect().height));
	}, [container]);

	const getContentHeight = useCallback(() => {
		const appBar = appBarRef.current;
		if (!appBar) return 0;

		return Math.max(
			0,
			Math.ceil(
				Math.max(
					appBar.scrollHeight || 0,
					appBar.offsetHeight || 0,
					appBar.getBoundingClientRect().height || 0,
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

		if (headerHiddenByScrollRef.current) {
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
		const target = container ?? appBarRef.current;
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

			setHeaderHeight(visibleHeight);
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

		if (appBarRef.current && appBarRef.current !== target) {
			resizeObserver.observe(appBarRef.current);
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
		startRouteSync,
	]);

	useEffect(() => {
		if (hideHeader || !enableScrollHideOnScroll) {
			lastScrollYRef.current = window.scrollY;
			scrollPivotYRef.current = window.scrollY;
			lastScrollDirectionRef.current = 0;

			if (headerHiddenByScrollRef.current) {
				showByScroll(false);
			}
			return;
		}

		lastScrollYRef.current = window.scrollY;
		scrollPivotYRef.current = window.scrollY;
		lastScrollDirectionRef.current = 0;

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
					!headerHiddenByScrollRef.current &&
					accumulatedDiff >= SCROLL_HIDE_THRESHOLD
				) {
					hideByScroll();
					scrollPivotYRef.current = nextScrollY;
				}

				if (
					nextDirection < 0 &&
					headerHiddenByScrollRef.current &&
					accumulatedDiff <= -SCROLL_SHOW_THRESHOLD
				) {
					showByScroll(true);
					scrollPivotYRef.current = nextScrollY;
				}

				lastScrollYRef.current = nextScrollY;
			});

		return () => {
			scrollSubscription.unsubscribe();

			if (headerHiddenByScrollRef.current) {
				showByScroll(false);
			}
		};
	}, [enableScrollHideOnScroll, hideByScroll, hideHeader, showByScroll]);

	useEffect(() => {
		return () => {
			stopRouteSync();
			clearFlexTransition();
		};
	}, [clearFlexTransition, stopRouteSync]);

	return {
		appBarRef,
	};
}
