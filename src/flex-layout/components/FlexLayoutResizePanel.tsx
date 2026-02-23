"use client";

import type { TouchEvent } from "react";
import { MouseEvent, useEffect, useMemo, useRef } from "react";
import {
	isResizingSubject,
	ResizeDragEvent,
	resizeDragSubject,
} from "../hooks";
import { setResizePanelRef } from "../store/FlexLayoutContainerStore";
import styles from "../styles/FlexLayout.module.css";
import { FlexDirectionModelType } from "../types/FlexDirectionTypes";
import { FlexLayoutResizePanelProps } from "../types/FlexLayoutTypes";
import {
	findNotCloseFlexContent,
	getClientXy,
	isOverMove,
} from "../utils/FlexLayoutUtils";

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

const CROSS_SLOP = 16;
const getPanelsNearPoint = (
	clientX: number,
	clientY: number,
	basePanelEl?: HTMLElement | null,
	baseDir?: string,
) => {
	// 너무 멀리까지 퍼지면 엉뚱한 패널까지 잡힐 수 있어서 적당히 제한
	const SPREAD = CROSS_SLOP;

	const map = new Map<
		string,
		{ el: HTMLElement; key: string; dir?: string }
	>();

	const collect = (x: number, y: number) => {
		const elements = document.elementsFromPoint(x, y);
		for (const el of elements) {
			const h = el as HTMLElement;
			const panelEl = h.closest?.(
				`.${styles["flex-resize-panel"]}`,
			) as HTMLElement | null;
			if (!panelEl) continue;

			const key = panelEl.dataset.resize_panel_key;
			if (!key) continue;

			if (!map.has(key)) {
				map.set(key, {
					el: panelEl,
					key,
					dir: panelEl.dataset.direction,
				});
			}
		}
	};

	// 1) 포인터 주변(기본)
	[
		[0, 0],
		[-SPREAD, 0],
		[SPREAD, 0],
		[0, -SPREAD],
		[0, SPREAD],
		[-SPREAD, -SPREAD],
		[SPREAD, -SPREAD],
		[-SPREAD, SPREAD],
		[SPREAD, SPREAD],
	].forEach(([dx, dy]) => collect(clientX + dx, clientY + dy));

	// 2) "내 패널" 기준: 패널 양끝(경계 바깥) 가상 공간에 찍기
	if (basePanelEl && baseDir) {
		const rect = basePanelEl.getBoundingClientRect();

		const thickness =
			baseDir === "row"
				? rect.width
				: baseDir === "column"
					? rect.height
					: 1;

		// ✅ 패널 두께 기반으로: 한 번에 패널을 "건드릴" 수 있는 간격
		// (두께가 얇을수록 촘촘히)
		const STEP = Math.max(1, Math.ceil(thickness / 2));

		// ✅ 패널 바깥으로 나가는 거리(가상 공간): 두께에 비례
		const PAD = Math.ceil(thickness * 2);

		// ✅ 스윕 범위: CROSS_SLOP + 두께 보정 (화면/분할 수 몰라도 동작)
		const RANGE = Math.ceil(CROSS_SLOP + thickness * 2);

		if (baseDir === "row") {
			// 세로 패널: 좌/우 가상공간에서 y 스윕 (가로 패널 주움)
			for (let d = -RANGE; d <= RANGE; d += STEP) {
				collect(rect.left - PAD, clientY + d);
				collect(rect.right + PAD, clientY + d);
			}
		} else if (baseDir === "column") {
			// 가로 패널: 위/아래 가상공간에서 x 스윕 (세로 패널 주움)
			for (let d = -RANGE; d <= RANGE; d += STEP) {
				collect(clientX + d, rect.top - PAD);
				collect(clientX + d, rect.bottom + PAD);
			}
		}
	}

	// 3) "정중앙 십자(4분할)" 핵심:
	//    교차축(수직/수평) 패널이 발견되면, 그 패널의 경계 바깥(가상 공간)으로 다시 찍어서
	//    반대편(다른 컬럼/다른 로우)의 "같은 방향 패널"까지 같이 주워온다.
	if (baseDir) {
		const current = [...map.values()];
		const perps = current.filter((p) => p.dir && p.dir !== baseDir);

		for (const perp of perps) {
			const r = perp.el.getBoundingClientRect();
			const perpThickness =
				perp.dir === "row"
					? r.width
					: perp.dir === "column"
						? r.height
						: 4;

			const STEP2 = Math.max(1, Math.ceil(perpThickness / 2));
			const PAD2 = Math.ceil(perpThickness * 2);
			const RANGE2 = Math.ceil(CROSS_SLOP + perpThickness * 2);

			if (baseDir === "column" && perp.dir === "row") {
				for (let d = -RANGE2; d <= RANGE2; d += STEP2) {
					collect(r.left - PAD2, clientY + d);
					collect(r.right + PAD2, clientY + d);
				}
			} else if (baseDir === "row" && perp.dir === "column") {
				for (let d = -RANGE2; d <= RANGE2; d += STEP2) {
					collect(clientX + d, r.top - PAD2);
					collect(clientX + d, r.bottom + PAD2);
				}
			}
		}
	}

	return [...map.values()];
};
export default function FlexLayoutResizePanel({
	direction,
	containerCount,
	panelMode = "default",
	containerName,
	layoutName,
	panelClassName,
	panelMovementMode,
	onResizingChange,
}: FlexLayoutResizePanelProps) {
	const directionRef = useRef(direction);
	const movementModeRef = useRef(panelMovementMode);

	const panelKey = useMemo(
		() => `${layoutName}::${containerName}`,
		[layoutName, containerName],
	);

	useEffect(() => {
		directionRef.current = direction;
	}, [direction]);
	useEffect(() => {
		movementModeRef.current = panelMovementMode;
	}, [panelMovementMode]);

	const isResizePanelClickRef = useRef<boolean>(false);
	const prevTouchEventRef = useRef<globalThis.TouchEvent | null>(null);
	const parentSizeRef = useRef<number>(0);
	const totalMovementRef = useRef<number>(0);

	const containerCountRef = useRef<number>(containerCount);

	const panelRef = useRef<HTMLDivElement>(null);

	const activeSessionIdRef = useRef<string | null>(null);
	const globalCleanupRef = useRef<(() => void) | null>(null);

	useEffect(() => {
		return () => {
			isResizingSubject.next(false);
			document.body.style.cursor = "";

			globalCleanupRef.current?.();
		};
	}, []);
	useEffect(() => {
		containerCountRef.current = containerCount;
	}, [containerCount]);

	const startLocalDrag = () =>
		// event: MouseEvent<HTMLDivElement> | TouchEvent<HTMLDivElement>,
		{
			if (!panelRef.current || !panelRef.current.parentElement) return;
			isResizePanelClickRef.current = true;
			onResizingChange?.(true);
			containerCountRef.current = [
				...panelRef.current.parentElement.children,
			].filter((e) => e.hasAttribute("data-container_name")).length;
			const sizeName = flexDirectionModel[direction].sizeName;
			parentSizeRef.current =
				panelRef.current.parentElement.getBoundingClientRect()[
					sizeName
				] as number;
			prevTouchEventRef.current = null;
			totalMovementRef.current = 0;

			isResizingSubject.next(true);

			// if (!parentSizeRef.current) return;
			// document.body.style.cursor = flexDirectionModel[direction].resizeCursor;
		};

	const endLocalDrag = () => {
		isResizePanelClickRef.current = false;
		onResizingChange?.(false);
		parentSizeRef.current = 0;
		totalMovementRef.current = 0;

		activeSessionIdRef.current = null;
		isResizingSubject.next(false);
		document.body.style.cursor = "";
		clearCrossHoverMark();
	};

	function moveMouseFlex(
		originTarget: HTMLDivElement,
		resizePanel: HTMLDivElement,
		moveEvent: { movementX: number; movementY: number },
		dir: string,
		mode: string,
	) {
		//return new Promise<void>(resolve => {
		const model = flexDirectionModel[dir];
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
			(mode === "divorce" && totalMovementRef.current > 0) ||
			(mode === "bulldozer" && movement > 0) ||
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
			(mode === "divorce" && totalMovementRef.current < 0) ||
			(mode === "bulldozer" && movement < 0) ||
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

		if (!(targetElement instanceof HTMLElement)) return;
		if (!(nextElement instanceof HTMLElement)) return;

		targetElement.style.flex = `${targetFlexGrow} 1 0%`;
		nextElement.style.flex = `${nextElementFlexGrow} 1 0%`;

		//     resolve();
		// });
	}

	useEffect(() => {
		const sub = resizeDragSubject.subscribe((ev: ResizeDragEvent) => {
			if (ev.type === "START") {
				if (!ev.targets.includes(panelKey)) return;

				activeSessionIdRef.current = ev.sessionId;
				startLocalDrag();

				// 커서는 initiator가 넣어준 값 사용 (교차면 move)
				if (ev.cursor) document.body.style.cursor = ev.cursor;
				return;
			}

			if (ev.type === "MOVE") {
				if (activeSessionIdRef.current !== ev.sessionId) return;
				if (!isResizePanelClickRef.current || !panelRef.current) return;

				const dir = directionRef.current;
				const mode = movementModeRef.current;

				const targetElement = panelRef.current
					.previousElementSibling as HTMLDivElement;
				const targetPanel = panelRef.current;
				if (!targetElement || !targetPanel) return;

				moveMouseFlex(
					targetElement,
					targetPanel,
					{ movementX: ev.movementX, movementY: ev.movementY },
					dir,
					mode,
				);
				return;
			}

			if (ev.type === "END") {
				if (activeSessionIdRef.current !== ev.sessionId) return;
				endLocalDrag();
			}
		});

		return () => sub.unsubscribe();
	}, [panelKey]);

	const panelMouseDownEvent = (
		event: MouseEvent<HTMLDivElement> | TouchEvent<HTMLDivElement>,
	) => {
		if (!panelRef.current) return;

		event.preventDefault?.();

		const nativeEv = event.nativeEvent as unknown as Event;
		const pos = getClientXy(nativeEv);
		if (!pos) return;

		// (1) 겹친 resize panel들 탐색 (CROSS_SLOP 반경으로 러프하게)
		const myDir = directionRef.current;
		const nearPanels = getPanelsNearPoint(
			pos.clientX,
			pos.clientY,
			panelRef.current,
			myDir,
		);

		// (2) "십자가" 케이스: 자기 자신 + (방향이 다른) 겹친 패널 1개만 추가
		const perpendicularPanels = nearPanels.filter(
			(p) => p.key !== panelKey && p.dir && p.dir !== myDir,
		);

		const targetsSet = new Set<string>([panelKey]);
		perpendicularPanels.forEach((p) => targetsSet.add(p.key));

		const targets = [...targetsSet];

		const sessionId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

		// ✅ 교차면 "+" 커서 (진짜 + 모양)
		const cursor =
			targets.length >= 2
				? "move"
				: flexDirectionModel[myDir].resizeCursor;

		// (3) START 브로드캐스트
		resizeDragSubject.next({
			type: "START",
			sessionId,
			targets,
			cursor,
		});

		// (4) 글로벌 move/up 바인딩 (이 패널이 initiator)
		globalCleanupRef.current?.();

		let prevX = pos.clientX;
		let prevY = pos.clientY;

		const onMove = (e: Event) => {
			// touchmove 스크롤 방지
			e.preventDefault?.();

			const p = getClientXy(e);
			if (!p) return;

			const movementX = p.clientX - prevX;
			const movementY = p.clientY - prevY;
			prevX = p.clientX;
			prevY = p.clientY;

			resizeDragSubject.next({
				type: "MOVE",
				sessionId,
				movementX,
				movementY,
			});
		};

		const onUp = () => {
			globalCleanupRef.current?.();
			globalCleanupRef.current = null;

			resizeDragSubject.next({ type: "END", sessionId });
		};

		["mousemove", "touchmove"].forEach((name) => {
			window.addEventListener(name, onMove as any, { passive: false });
		});

		[
			"mouseup",
			"touchend",
			"touchcancel",
			"pointerup",
			"pointercancel",
			"blur",
		].forEach((name) => window.addEventListener(name, onUp));

		globalCleanupRef.current = () => {
			["mousemove", "touchmove"].forEach((name) =>
				window.removeEventListener(name, onMove as any),
			);
			[
				"mouseup",
				"touchend",
				"touchcancel",
				"pointerup",
				"pointercancel",
				"blur",
			].forEach((name) => window.removeEventListener(name, onUp));
		};
	};

	useEffect(() => {
		if (!panelRef.current) return;
		setResizePanelRef(layoutName, containerName, panelRef);
		return () => {
			setResizePanelRef(layoutName, containerName, null);
		};
	}, [containerName, layoutName]);

	const lastHoverMarkedRef = useRef<HTMLElement[]>([]);
	const hoverRafRef = useRef<number | null>(null);

	const clearCrossHoverMark = () => {
		for (const panelEl of lastHoverMarkedRef.current) {
			const hoverEl = panelEl.querySelector(
				`.${styles.hover}`,
			) as HTMLElement | null;
			hoverEl?.removeAttribute("data-is_hover");
		}
		lastHoverMarkedRef.current = [];
	};

	const applyCrossHoverMark = (targets: HTMLElement[]) => {
		clearCrossHoverMark();
		for (const panelEl of targets) {
			const hoverEl = panelEl.querySelector(
				`.${styles.hover}`,
			) as HTMLElement | null;
			// selector가 [data-is_hover]라 "존재"만 하면 됨
			hoverEl?.setAttribute("data-is_hover", "");
		}
		lastHoverMarkedRef.current = targets;
	};

	// hover 중 커서 + data-is_hover 세팅
	const updateHoverCursor = (e: React.MouseEvent<HTMLDivElement>) => {
		if (!panelRef.current) return;

		if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
		hoverRafRef.current = requestAnimationFrame(() => {
			const myDir = directionRef.current;
			const nearPanels = getPanelsNearPoint(
				e.clientX,
				e.clientY,
				panelRef.current,
				myDir,
			);
			// 내 방향과 다른 패널(수직 패널)들
			const perpendicularPanels = nearPanels
				.filter((p) => p.dir && p.dir !== myDir)
				.map((p) => p.el);

			// ✅ 교차면 "+" 커서 (진짜 + 모양)
			panelRef.current!.style.cursor =
				perpendicularPanels.length > 0 ? "move" : "";

			// ✅ 상대 교차선도 파란 highlight 되게
			applyCrossHoverMark(perpendicularPanels);
		});
	};

	const resetHoverCursor = () => {
		if (!panelRef.current) return;
		panelRef.current.style.cursor = "";
		clearCrossHoverMark();
	};

	return (
		<div
			id={containerName + "_resize_panel"}
			data-resize_panel_key={panelKey}
			data-direction={direction}
			className={`${styles["flex-resize-panel"]} ${styles[panelMode as keyof typeof styles]} ${panelClassName && panelClassName !== "" ? panelClassName : ""}`}
			ref={panelRef}
			onMouseDown={panelMouseDownEvent}
			onTouchStart={panelMouseDownEvent}
			onMouseMove={updateHoverCursor}
			onMouseEnter={updateHoverCursor}
			onMouseLeave={resetHoverCursor}
		>
			<div className={styles.hover} aria-hidden></div>
		</div>
	);
}
