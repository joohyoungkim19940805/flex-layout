"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSize } from "../hooks/useSizes";
import { useFlexLayoutContext } from "../providers/FlexLayoutContext";
import { setContainerRef } from "../store/FlexLayoutContainerStore";
import styles from "../styles/FlexLayout.module.css";
import { FlexContainerProps } from "../types/FlexLayoutTypes";
import { getGrow, mathWeight } from "../utils/FlexLayoutUtils";
import FlexLayoutResizePanel from "./FlexLayoutResizePanel";

export default function FlexLayoutContainer({
	isFitContent,
	isFitResize,
	containerName,
	grow: initialGrow,
	prevGrow: initialPrevGrow,
	isInitialResizable,
	isResizePanel,
	stickyMode,
	children,
	className,
	panelMode,
}: FlexContainerProps) {
	const {
		direction,
		panelMovementMode,
		panelClassName,
		layoutName,
		fitContent,
		containerCount,
	} = useFlexLayoutContext();

	const { ref, size } =
		// isFitContent && fitContent
		//?
		useSize(fitContent);
	//: { ref: null, size: null };
	// 콜백 ref에서 접근하기 위한 내부 ref 생성
	const flexContainerNodeRef = useRef<HTMLDivElement | null>(null);
	const isUserResizingRef = useRef(false);

	// isFitContent 에서 최초 1회만 grow 맞춤
	const didFitContentResizeOnceRef = useRef(false);

	const handleResizingChange = useCallback((v: boolean) => {
		isUserResizingRef.current = v;
	}, []);

	// 콜백 ref 정의
	const flexContainerRef = useCallback(
		(node: HTMLDivElement | null) => {
			flexContainerNodeRef.current = node;

			// 마운트: 저장 / 언마운트: 삭제
			if (node) {
				setContainerRef(
					layoutName,
					containerName,
					flexContainerNodeRef,
				);
			} else {
				setContainerRef(layoutName, containerName, null);
			}
		},
		[layoutName, containerName],
	);

	// 초기 SSR 시점에는 sessionStorage를 사용할 수 없으므로 일단 initialGrow를 사용
	const [growState, _setGrowState] = useState<number | undefined>(
		initialGrow,
	);

	const [prevGrowState, setPrevGrowState] = useState<number | undefined>(
		initialPrevGrow,
	);

	useEffect(() => {
		_setGrowState(initialGrow);
	}, [initialGrow]);

	useEffect(() => {
		setPrevGrowState(initialPrevGrow);
	}, [initialPrevGrow]);

	const setGrowState = useCallback(
		(
			nextGrow: number | undefined,
			prevGrowOverride?: number | undefined,
		) => {
			if (typeof nextGrow === "number" && Number.isNaN(nextGrow)) return;

			_setGrowState((prevGrow) => {
				const isSame =
					typeof nextGrow === "number" && typeof prevGrow === "number"
						? Math.abs(nextGrow - prevGrow) < 0.001
						: Object.is(nextGrow, prevGrow);

				if (isSame) return prevGrow;

				setPrevGrowState(prevGrowOverride ?? prevGrow);
				return nextGrow;
			});
		},
		[],
	);

	// 클라이언트 마운트 후 sessionStorage에서 grow값을 가져와 state 업데이트 (SSR/Hydration 안정화)
	useEffect(() => {
		if (
			typeof window == "undefined" ||
			flexContainerNodeRef.current === null
		) {
			return;
		}

		const storedGrow = sessionStorage.getItem(containerName);
		if (storedGrow !== null) {
			const parsed = parseFloat(storedGrow);
			if (!isNaN(parsed)) {
				flexContainerNodeRef.current.style.flex = `${parsed} 1 0%`;
				setGrowState(parsed);
			}
		}
	}, [containerName, setGrowState]);

	// 스타일 변경 감지를 위한 MutationObserver
	useEffect(() => {
		if (!flexContainerNodeRef.current) return;

		const targetNode = flexContainerNodeRef.current;

		const parseOldGrowFromStyleAttr = (styleAttr: string | null) => {
			if (!styleAttr) return undefined;
			// style attribute string에서 "flex: X 1 0%" 형태를 찾아 X 파싱
			const m = styleAttr.match(/flex\s*:\s*([^;]+)/);
			if (!m) return undefined;
			const n = parseFloat(m[1].trim().split(/\s+/)[0]);
			return Number.isNaN(n) ? undefined : n;
		};

		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (
					mutation.type === "attributes" &&
					mutation.attributeName === "style" &&
					targetNode.style.flex
				) {
					// style.flex = "X 1 0%" 형태이므로 X를 파싱
					const flexValue = targetNode.style.flex;
					const parsedGrow = parseFloat(flexValue.split(" ")[0]);
					if (!isNaN(parsedGrow)) {
						const oldGrow = parseOldGrowFromStyleAttr(
							mutation.oldValue,
						);
						// sessionStorage에 저장
						// sessionStorage.setItem(
						//     containerName,
						//     parsedGrow.toString()
						// );
						// state 업데이트
						setGrowState(parsedGrow, oldGrow);
					}
				}
			}
		});

		observer.observe(targetNode, {
			attributes: true,
			attributeFilter: ["style"],
			attributeOldValue: true,
		});

		return () => {
			observer.disconnect();
		};
	}, [containerName, setGrowState]);

	useEffect(() => {
		const containerEl = flexContainerNodeRef.current;
		if (!containerEl || !fitContent) return;

		const sizeName =
			fitContent.charAt(0).toUpperCase() + fitContent.substring(1);

		const maxSizeStyleName = ("max" + sizeName) as "maxWidth" | "maxHeight";
		const parentSizeStyleName = ("client" + sizeName) as
			| "clientWidth"
			| "clientHeight";

		if (!isFitContent) {
			if (containerEl.style[maxSizeStyleName]) {
				containerEl.style[maxSizeStyleName] = "";
			}
			didFitContentResizeOnceRef.current = false;
			return;
		}

		if (!ref?.current || typeof size !== "number") return;

		let rafId = requestAnimationFrame(() => {
			const el = flexContainerNodeRef.current;
			if (!el) return;

			const parent = el.parentElement;
			if (!parent) return;

			// size 변화마다 max size는 계속 갱신
			const px = `${size}px`;
			if (el.style[maxSizeStyleName] !== px) {
				el.style[maxSizeStyleName] = px;
			}

			const containers = [...(parent.children || [])].filter((child) => {
				const item = child as HTMLElement;
				return (
					item.hasAttribute("data-container_name") &&
					!item.classList.contains(styles["flex-resize-panel"])
				);
			}) as HTMLElement[];

			const totalGrow = containers.length || containerCount;
			if (!totalGrow || totalGrow <= 0) return;

			// 초기 기본 grow 분배가 아직 안 끝난 상태면 기다렸다가 growState 갱신 후 다시 진입
			const hasResolvedGrow =
				typeof growState === "number" ||
				!!el.style.flex ||
				el.hasAttribute("data-grow");

			if (!hasResolvedGrow) return;

			const currentGrow = getGrow(el);

			// 실제 close 상태인 컨테이너는 자동으로 다시 열지 않음
			if (currentGrow === 0) return;

			const parentSize = (parent[parentSizeStyleName] as number) || 0;
			if (!parentSize) return;

			// 드래그 리사이즈 계산과 동일하게 parentSize - 1 기준 사용
			const normalizedParentSize = Math.max(parentSize - 1, 1);

			const maxGrowRaw = totalGrow * (size / normalizedParentSize);
			const maxGrow = Math.min(totalGrow, Math.max(0, maxGrowRaw));

			const applyGrowAndRedistribute = (nextGrow: number) => {
				const latestCurrentGrow = getGrow(el);

				if (Math.abs(nextGrow - latestCurrentGrow) < 0.001) return;

				setGrowState(nextGrow);

				const siblings = containers.filter(
					(c) => c !== (el as HTMLElement),
				);

				const adjustable = siblings.filter((c) => getGrow(c) > 0);

				const remaining = totalGrow - nextGrow;
				if (remaining <= 0 || adjustable.length === 0) return;

				const oldSum = adjustable.reduce(
					(sum, c) => sum + getGrow(c),
					0,
				);

				if (oldSum <= 0) {
					const each = remaining / adjustable.length;
					adjustable.forEach((c) => {
						c.dataset.grow = each.toString();
						c.style.flex = `${each} 1 0%`;
					});
					return;
				}

				adjustable.forEach((c) => {
					const g = getGrow(c);
					const scaled = remaining * (g / oldSum);
					c.dataset.grow = scaled.toString();
					c.style.flex = `${scaled} 1 0%`;
				});
			};

			// isFitContent: 최초 1회만 max size 기준 grow 보정
			if (!didFitContentResizeOnceRef.current) {
				didFitContentResizeOnceRef.current = true;
				applyGrowAndRedistribute(maxGrow);
				return;
			}

			// isFitResize: 이후 size 변화 시 자동 grow 조절
			if (!isFitResize) return;
			if (isUserResizingRef.current) return;

			const latestCurrentGrow = getGrow(el);
			const isExpand = maxGrow > latestCurrentGrow;
			const canAutoExpand = latestCurrentGrow >= maxGrow * 0.95;

			// 사용자가 줄여둔 상태면 자동 확장은 막음
			if (isExpand && !canAutoExpand) return;

			applyGrowAndRedistribute(maxGrow);
		});

		return () => cancelAnimationFrame(rafId);
	}, [
		size,
		isFitContent,
		isFitResize,
		fitContent,
		containerCount,
		ref,
		growState,
		setGrowState,
	]);

	useEffect(() => {
		if (!flexContainerNodeRef.current) return;

		let notGrowList: Array<HTMLElement> = [];
		let containerList = [
			...(flexContainerNodeRef.current.parentElement?.children || []),
		].filter((e) => e.hasAttribute("data-container_name"));
		let remainingGrow = containerList.reduce((t, e, i) => {
			let item = e as HTMLElement;

			if (item.classList.contains(styles["flex-resize-panel"])) return t;

			if (
				e.hasAttribute("data-grow") == false ||
				e.getAttribute("data-is_resize") === "true"
			) {
				notGrowList.push(item);
				return t;
			}

			let grow = parseFloat(item.dataset.grow || "");
			item.style.flex = `${grow} 1 0%`;
			t -= grow;
			return t;
		}, containerList.length);

		if (notGrowList.length != 0) {
			let resizeWeight = mathWeight(notGrowList.length, remainingGrow);
			notGrowList.forEach((e) => {
				e.dataset.grow = resizeWeight.toString();
				e.style.flex = `${resizeWeight} 1 0%`;
			});
		}
	}, []);

	useEffect(() => {
		if (!stickyMode) return;
		if (!isResizePanel) return;

		const stickyResizePanel = stickyMode.stickyResizePanel ?? true;
		if (!stickyResizePanel) return;

		const containerEl = flexContainerNodeRef.current;
		if (!containerEl) return;

		const nextPanel = containerEl.nextElementSibling as HTMLElement | null;
		const prevPanel =
			containerEl.previousElementSibling as HTMLElement | null;

		const isPanel = (el: HTMLElement | null) =>
			!!el && el.classList.contains(styles["flex-resize-panel"]);

		const panelEl =
			stickyMode.position === "top"
				? isPanel(nextPanel)
					? nextPanel
					: null
				: isPanel(prevPanel)
					? prevPanel
					: null;

		if (!panelEl) return;

		const prev = {
			position: panelEl.style.position,
			top: panelEl.style.top,
			bottom: panelEl.style.bottom,
		};

		const offsetPx = stickyMode.offsetPx ?? 0;

		let rafId = 0;

		const apply = () => {
			if (!containerEl.isConnected || !panelEl.isConnected) return;

			const h = containerEl.offsetHeight;

			panelEl.style.position = "sticky";

			if (direction === "row") {
				if (stickyMode.position === "top") {
					panelEl.style.top = `${offsetPx}px`;
					panelEl.style.bottom = "auto";
				} else {
					panelEl.style.bottom = `${offsetPx}px`;
					panelEl.style.top = "auto";
				}
				return;
			}

			if (stickyMode.position === "top") {
				panelEl.style.top = `${offsetPx + h}px`;
				panelEl.style.bottom = "auto";
			} else {
				panelEl.style.bottom = `${offsetPx + h}px`;
				panelEl.style.top = "auto";
			}
		};

		const schedule = () => {
			if (rafId) cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(apply);
		};

		apply();

		const ro =
			typeof ResizeObserver !== "undefined"
				? new ResizeObserver(schedule)
				: null;

		ro?.observe(containerEl);

		return () => {
			if (rafId) cancelAnimationFrame(rafId);
			ro?.disconnect();

			panelEl.style.position = prev.position;
			panelEl.style.top = prev.top;
			panelEl.style.bottom = prev.bottom;
		};
	}, [stickyMode, isResizePanel, direction]);

	const offsetPx = stickyMode?.offsetPx ?? 0;

	const stickyContainerStyle =
		stickyMode && stickyMode.position === "top"
			? {
					position: "sticky" as const,
					top: offsetPx,
					bottom: "auto",
				}
			: stickyMode && stickyMode.position === "bottom"
				? {
						position: "sticky" as const,
						bottom: offsetPx,
						top: "auto",
					}
				: {};

	return (
		<>
			<div
				id={containerName}
				data-container_name={containerName}
				data-is_sticky={stickyMode ? "true" : "false"}
				ref={flexContainerRef}
				className={`${styles["flex-container"]} ${className && className !== "" ? className : ""}`}
				{...(growState !== undefined
					? { ["data-grow"]: growState }
					: {})}
				{...(prevGrowState != undefined
					? { ["data-prev_grow"]: prevGrowState }
					: {})}
				data-is_resize={isInitialResizable}
				data-is_resize_panel={isResizePanel}
				style={{
					...(growState !== undefined
						? { flex: `${growState} 1 0%` }
						: {}),
					...stickyContainerStyle,
				}}
			>
				{(isFitContent && (
					<div
						className={`${styles["flex-content-fit-wrapper"]}`}
						ref={ref}
					>
						{children}
					</div>
				)) ||
					children}
			</div>
			{isResizePanel && (
				<FlexLayoutResizePanel
					containerName={containerName}
					layoutName={layoutName}
					direction={direction}
					containerCount={containerCount}
					panelMode={panelMode}
					panelClassName={panelClassName}
					panelMovementMode={panelMovementMode}
					onResizingChange={handleResizingChange}
				/>
			)}
		</>
	);
}
