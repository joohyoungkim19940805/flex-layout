"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSize } from "../hooks/useSizes";
import { useFlexLayoutContext } from "../providers/FlexLayoutContext";
import { setContainerRef } from "../store/FlexLayoutContainerStore";
import styles from "../styles/FlexLayout.module.css";
import { FlexContainerProps } from "../types/FlexLayoutTypes";
import { getGrow, mathGrow, mathWeight } from "../utils/FlexLayoutUtils";
import FlexLayoutResizePanel from "./FlexLayoutResizePanel";

export default function FlexLayoutContainer({
	isFitContent,
	isFitResize,
	// fitContent,
	// containerCount,
	// layoutName,
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

	const lastSize = useRef<number | null>(null);
	// const lastContainerCount = useRef<number | null>();

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
	const [isFirstLoad, setIsFirstLoad] = useState<boolean>(true);

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
		)
			return;

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
		// 컴포넌트 크기 및 설정값에 따른 사이즈 재조정
		if (
			!flexContainerNodeRef.current ||
			!ref ||
			!ref.current ||
			!size ||
			lastSize.current === size ||
			// getGrow(flexContainerNodeRef.current) == 0 ||
			isUserResizingRef.current // 사용자가 직접 사이즈 조정 중일 때는 자동 조정 방지
		)
			return;
		lastSize.current = size;
		requestAnimationFrame(() => {
			if (!flexContainerNodeRef.current) return;
			const sizeName = `${fitContent.charAt(0).toUpperCase() + fitContent.substring(1)}`;
			const parentSize =
				(flexContainerNodeRef.current.parentElement &&
					flexContainerNodeRef.current.parentElement[
						("client" + sizeName) as "clientWidth" | "clientHeight"
					]) ||
				0;
			if (isFitContent) {
				flexContainerNodeRef.current.style[
					("max" + sizeName) as "maxWidth" | "maxHeight"
				] = size + "px";
			}
			if (!isFitResize && isFirstLoad) {
				setIsFirstLoad(false);
				return;
			}

			if (getGrow(flexContainerNodeRef.current) != 0 && isFitResize) {
				const newGrow = mathGrow(size, parentSize, containerCount);
				setGrowState(newGrow);
				// flexContainerNodeRef.current.dataset.prev_grow =
				//     flexContainerNodeRef.current.dataset.grow;
				// flexContainerNodeRef.current.dataset.grow = newGrow.toString();
				// flexContainerNodeRef.current.style.flex = `${newGrow} 1 0%`;
			}
		});
	}, [
		size,
		containerCount,
		isFitResize,
		children,
		fitContent,
		isFitContent,
		growState,
		isFirstLoad,
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
		if (
			!flexContainerNodeRef.current ||
			!isFitContent ||
			!fitContent ||
			!size ||
			lastSize.current === size ||
			getGrow(flexContainerNodeRef.current) == 0 ||
			isUserResizingRef.current
		)
			return;

		const parent = flexContainerNodeRef.current.parentElement;
		if (!parent) return;

		const sizeName =
			fitContent.charAt(0).toUpperCase() + fitContent.substring(1);
		const parentSize =
			(parent[
				("client" + sizeName) as "clientWidth" | "clientHeight"
			] as number) || 0;

		if (!parentSize || containerCount <= 0) return;

		// 내 grow 재계산 (0 ~ containerCount로 클램프)
		const nextGrowRaw = mathGrow(size, parentSize, containerCount);
		const nextGrow = Math.min(containerCount, Math.max(0, nextGrowRaw));
		const currentGrow = getGrow(flexContainerNodeRef.current);

		// 미세 변화로 루프 도는 것 방지
		if (Math.abs(nextGrow - currentGrow) < 0.001) return;

		setGrowState(nextGrow);

		// 형제 컨테이너 grow 재분배
		const containers = [...(parent.children || [])].filter((el) => {
			const item = el as HTMLElement;
			return (
				item.hasAttribute("data-container_name") &&
				!item.classList.contains(styles["flex-resize-panel"])
			);
		}) as HTMLElement[];

		const siblings = containers.filter(
			(el) => el !== (flexContainerNodeRef.current as HTMLElement),
		);

		// 닫힌 컨테이너는 건드리지 않음
		const adjustable = siblings.filter((el) => el.style.flex !== "0 1 0%");

		const remaining = containerCount - nextGrow;
		if (remaining <= 0 || adjustable.length === 0) return;

		const oldSum = adjustable.reduce((sum, el) => sum + getGrow(el), 0);

		if (oldSum <= 0) {
			// 기존 grow 합이 0이면 균등분배
			const each = remaining / adjustable.length;
			adjustable.forEach((el) => {
				el.dataset.grow = each.toString();
				el.style.flex = `${each} 1 0%`;
			});
		} else {
			// 기존 grow 비율대로 스케일링
			adjustable.forEach((el) => {
				const g = getGrow(el);
				const scaled = remaining * (g / oldSum);
				el.dataset.grow = scaled.toString();
				el.style.flex = `${scaled} 1 0%`;
			});
		}
	}, [size, isFitContent, fitContent, containerCount, setGrowState]);

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
