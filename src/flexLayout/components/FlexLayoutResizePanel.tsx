"use client";

import type { TouchEvent } from "react";
import { MouseEvent, useEffect, useRef } from "react";
import { FlexDirectionModelType } from "../@types/FlexDirectionTypes";
import { FlexLayoutResizePanelProps } from "../@types/FlexLayoutTypes";
import { setResizePanelRef } from "../store/FlexLayoutContainerStore";
import styles from "../styles/FlexLayout.module.css";
import { findNotCloseFlexContent, isOverMove } from "../utils/FlexLayoutUtils";

const flexDirectionModel = {
	row: {
		xy: "x",
		targetDirection: "left",
		nextDirection: "right",
		sizeName: "width",
		resizeCursor: "ew-resize",
	} as FlexDirectionModelType,
	column: {
		xy: "y",
		targetDirection: "top",
		nextDirection: "bottom",
		sizeName: "height",
		resizeCursor: "ns-resize",
	} as FlexDirectionModelType,
} as Record<string, FlexDirectionModelType>;

const FlexLayoutResizePanel = ({
	direction,
	containerCount,
	panelMode = "default",
	containerName,
	layoutName,
	panelClassName,
	panelMovementMode,
}: FlexLayoutResizePanelProps) => {
	let isResizePanelClickRef = useRef<boolean>(false);
	let prevTouchEvent: globalThis.TouchEvent | null = null;
	let parentSizeRef = useRef<number>(0);
	let totalMovementRef = useRef<number>(0);

	const containerCountRef = useRef<number>(containerCount);
	useEffect(() => {
		return () => {
			document.body.style.cursor = "";
		};
	}, []);
	useEffect(() => {
		containerCountRef.current = containerCount;
	}, [containerCount]);
	const panelRef = useRef<HTMLDivElement>(null);

	const panelMouseDownEvent = (
		event: MouseEvent<HTMLDivElement> | TouchEvent<HTMLDivElement>,
	) => {
		if (!panelRef.current || !panelRef.current.parentElement) return;
		isResizePanelClickRef.current = true;
		containerCountRef.current = [
			...panelRef.current.parentElement.children,
		].filter((e) => e.hasAttribute("data-container_name")).length;
		const sizeName = flexDirectionModel[direction].sizeName;
		parentSizeRef.current =
			panelRef.current.parentElement.getBoundingClientRect()[
				sizeName
			] as number;
		prevTouchEvent = null;
		totalMovementRef.current = 0;

		if (!parentSizeRef.current) return;
		document.body.style.cursor = flexDirectionModel[direction].resizeCursor;
	};

	const panelMouseUpEvent = () => {
		isResizePanelClickRef.current = false;
		parentSizeRef.current = 0;
		prevTouchEvent = null;
		totalMovementRef.current = 0;
		document.body.style.cursor = "";
	};

	function moveMouseFlex(
		originTarget: HTMLDivElement,
		resizePanel: HTMLDivElement,
		moveEvent: { movementX: number; movementY: number },
	) {
		//return new Promise<void>(resolve => {
		const model = flexDirectionModel[direction];
		const movement =
			moveEvent[
				("movement" + model.xy.toUpperCase()) as
					| "movementX"
					| "movementY"
			];
		totalMovementRef.current += movement;

		const minSizeName = "min-" + model.sizeName;
		const maxSizeName = "max-" + model.sizeName;

		// 이전 방향으로 가까운 열린 패널 찾기
		let targetElement = findNotCloseFlexContent(
			originTarget,
			"previousElementSibling",
		);

		if (
			(panelMovementMode === "divorce" && totalMovementRef.current > 0) ||
			(panelMovementMode === "bulldozer" && movement > 0) ||
			!targetElement
		)
			//if (!targetElement || movement > 0)
			targetElement = originTarget;

		// 다음 방향으로 가까운 열린 패널 찾기
		let nextElement = findNotCloseFlexContent(
			resizePanel.nextElementSibling,
			"nextElementSibling",
		);

		if (
			(panelMovementMode === "divorce" && totalMovementRef.current < 0) ||
			(panelMovementMode === "bulldozer" && movement < 0) ||
			!nextElement
		)
			//if (!nextElement || movement < 0)
			nextElement = resizePanel.nextElementSibling as HTMLDivElement;

		if (!targetElement || !nextElement) return;

		const targetRect = targetElement.getBoundingClientRect();
		const targetStyle = window.getComputedStyle(targetElement);
		const targetMinSize =
			parseFloat(targetStyle.getPropertyValue(minSizeName)) || 0;
		const targetMaxSize =
			parseFloat(targetStyle.getPropertyValue(maxSizeName)) || 0;

		const nextRect = nextElement.getBoundingClientRect();
		const nextStyle = window.getComputedStyle(nextElement);
		const nextMinSize =
			parseFloat(nextStyle.getPropertyValue(minSizeName)) || 0;
		const nextMaxSize =
			parseFloat(nextStyle.getPropertyValue(maxSizeName)) || 0;

		// 변경하고자 하는 target 사이즈와 next 사이즈 계산
		let targetSize = (targetRect[model.sizeName] as number) + movement;
		let nextElementSize = (nextRect[model.sizeName] as number) - movement;

		// Max size 조건 확인
		if (targetMaxSize > 0 && targetSize > targetMaxSize) {
			// target이 max size 초과면 조정 불가
			return;
		}
		if (nextMaxSize > 0 && nextElementSize > nextMaxSize) {
			// next가 max size 초과면 조정 불가
			return;
		}

		// 2024 11 29 자기 자신이 close 상태일 때 다음 타겟을 따라가도록 하되 30px만큼 움직일 때는 자기 자신을 open 상태로 하는 코드 주석처리
		//if (!nextElement || 30 < movement * -1) {
		//    nextElement = resizePanel.nextElementSibling as HTMLDivElement;
		//}

		// Min size 조건 확인 후 조정
		if (isOverMove(targetSize, targetMinSize)) {
			// target이 너무 작아지면 0으로 처리 (close 상태)
			targetSize = 0;
			nextElementSize = nextRect[model.sizeName] as number; // next는 변화 없음
		} else if (isOverMove(nextElementSize, nextMinSize)) {
			// next가 너무 작아지면 0으로 처리 (close 상태)
			nextElementSize = 0;
			targetSize = targetRect[model.sizeName] as number; // target은 변화 없음
		}

		// flex-grow 재계산
		const targetFlexGrow =
			(targetSize / (parentSizeRef.current - 1)) *
			containerCountRef.current;
		const nextElementFlexGrow =
			(nextElementSize / (parentSizeRef.current - 1)) *
			containerCountRef.current;

		targetElement.style.flex = `${targetFlexGrow} 1 0%`;
		nextElement.style.flex = `${nextElementFlexGrow} 1 0%`;

		//     resolve();
		// });
	}

	useEffect(() => {
		const addGlobalMoveEvent = (event: Event) => {
			if (!isResizePanelClickRef.current || !panelRef.current) {
				return;
			}
			event.preventDefault();
			const targetElement = panelRef.current
				.previousElementSibling as HTMLDivElement;
			const targetPanel = panelRef.current;
			if (!targetElement || !targetPanel) return;

			let move = { movementX: 0, movementY: 0 };
			if (window.TouchEvent && event instanceof window.TouchEvent) {
				if (!prevTouchEvent) {
					prevTouchEvent = event as globalThis.TouchEvent;
					return;
				}
				move.movementX =
					(prevTouchEvent.touches[0].pageX - event.touches[0].pageX) *
					-2;
				move.movementY =
					(prevTouchEvent.touches[0].pageY - event.touches[0].pageY) *
					-2;
				prevTouchEvent = event;
			} else {
				move.movementX = (event as globalThis.MouseEvent).movementX;
				move.movementY = (event as globalThis.MouseEvent).movementY;
			}

			moveMouseFlex(targetElement, targetPanel, move);
		};

		["mousemove", "touchmove"].forEach((eventName) => {
			window.addEventListener(eventName, addGlobalMoveEvent, {
				passive: false,
			});
		});
		["mouseup", "touchend"].forEach((eventName) => {
			window.addEventListener(eventName, panelMouseUpEvent);
		});

		return () => {
			["mousemove", "touchmove"].forEach((eventName) => {
				window.removeEventListener(eventName, addGlobalMoveEvent);
			});
			["mouseup", "touchend"].forEach((eventName) => {
				window.removeEventListener(eventName, panelMouseUpEvent);
			});
		};
	}, []);

	useEffect(() => {
		if (!panelRef.current) return;
		setResizePanelRef(layoutName, containerName, panelRef);
	}, [containerName, layoutName]);

	return (
		<div
			id={containerName + "_resize_panel"}
			className={`${styles["flex-resize-panel"]} ${styles[panelMode as keyof typeof styles]} ${panelClassName && panelClassName !== "" ? panelClassName : ""}`}
			ref={panelRef}
			onMouseDown={panelMouseDownEvent}
			onTouchStart={panelMouseDownEvent}
		>
			<div className={styles.hover}></div>
		</div>
	);
};

export default FlexLayoutResizePanel;
