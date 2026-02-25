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

const CROSS_SLOP = 4;
const getPanelsNearPoint = (
	clientX: number,
	clientY: number,
	basePanelEl?: HTMLElement | null,
	baseDir?: string,
) => {
	// 너무 멀리까지 퍼지면 엉뚱한 패널까지 잡힐 수 있어서 적당히 제한

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
		[-CROSS_SLOP, 0],
		[CROSS_SLOP, 0],
		[0, -CROSS_SLOP],
		[0, CROSS_SLOP],
		[-CROSS_SLOP, -CROSS_SLOP],
		[CROSS_SLOP, -CROSS_SLOP],
		[-CROSS_SLOP, CROSS_SLOP],
		[CROSS_SLOP, CROSS_SLOP],
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

		// 한 번에 패널을 건드릴 수 있는 간격
		const STEP = Math.max(1, Math.ceil(thickness / 2));

		//  스윕 범위: CROSS_SLOP + 두께 보정 (화면/분할 수 몰라도 동작)
		const RANGE = Math.ceil(CROSS_SLOP + thickness * 2);
		//  가상공간 폭
		const BAND = Math.max(CROSS_SLOP, Math.ceil(thickness * 2));

		// 가상공간 내부를 3점(가장 안쪽/중앙/가장 바깥쪽)으로 샘플링
		// (BAND가 작으면 중복/0 방지)
		const OFFSETS = Array.from(
			new Set([1, Math.floor(BAND / 2), Math.max(1, BAND - 1)]),
		);

		if (baseDir === "row") {
			// 세로 패널: 좌/우 가상공간에서 y 스윕
			for (let d = -RANGE; d <= RANGE; d += STEP) {
				for (const off of OFFSETS) {
					collect(rect.left - off, clientY + d);
					collect(rect.right + off, clientY + d);
				}
			}
		} else if (baseDir === "column") {
			// 가로 패널: 위/아래 가상공간에서 x 스윕
			for (let d = -RANGE; d <= RANGE; d += STEP) {
				for (const off of OFFSETS) {
					collect(clientX + d, rect.top - off);
					collect(clientX + d, rect.bottom + off);
				}
			}
		}
	}

	// 교차축(수직/수평) 패널이 발견되면, 그 패널의 경계 바깥을 가상 공간 기준으로 찍어서
	// 반대편(다른 컬럼/다른 로우)의 같은 방향 패널까지 같이 주워온다.
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
						: 1;

			const STEP2 = Math.max(1, Math.ceil(perpThickness / 2));
			const RANGE2 = Math.ceil(CROSS_SLOP + perpThickness * 2);

			// ✅ "가상영역 폭"을 중앙/끝 어디를 찍든 커버하도록 3점 샘플링
			// (CROSS_SLOP을 가상영역 크기로 존중 + 두께가 더 크면 두께에 맞춰 확장)
			const BAND2 = Math.max(CROSS_SLOP, Math.ceil(perpThickness * 2));

			// 가상영역 내부를 [가장 안쪽, 중앙, 가장 바깥쪽] 3점으로 샘플링
			const OFFSETS2 = Array.from(
				new Set([1, Math.floor(BAND2 / 2), Math.max(1, BAND2 - 1)]),
			);

			if (baseDir === "column" && perp.dir === "row") {
				// baseDir=column(가로 패널) 상태에서 perp=row(세로 패널)을 찾았다면
				// 세로 패널의 좌/우 가상공간을 y 스윕하면서 찍는다
				for (let d = -RANGE2; d <= RANGE2; d += STEP2) {
					for (const off of OFFSETS2) {
						collect(r.left - off, clientY + d);
						collect(r.right + off, clientY + d);
					}
				}
			} else if (baseDir === "row" && perp.dir === "column") {
				// baseDir=row(세로 패널) 상태에서 perp=column(가로 패널)을 찾았다면
				// 가로 패널의 위/아래 가상공간을 x 스윕하면서 찍는다
				for (let d = -RANGE2; d <= RANGE2; d += STEP2) {
					for (const off of OFFSETS2) {
						collect(clientX + d, r.top - off);
						collect(clientX + d, r.bottom + off);
					}
				}
			}
		}
	}

	return [...map.values()];
};
const parseCSSLen = (v: string, axisSize: number) => {
	if (!v) return null;
	if (v === "auto") return null;
	if (v.endsWith("px")) {
		const n = parseFloat(v);
		return Number.isFinite(n) ? n : null;
	}
	if (v.endsWith("%")) {
		const n = parseFloat(v);
		return Number.isFinite(n) ? (axisSize * n) / 100 : null;
	}
	// "0" 같은 케이스
	const n = parseFloat(v);
	return Number.isFinite(n) ? n : null;
};

const isPointInRect = (
	x: number,
	y: number,
	r: { left: number; top: number; right: number; bottom: number },
) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

const getAfterRect = (panelEl: HTMLElement) => {
	const base = panelEl.getBoundingClientRect();
	const s = getComputedStyle(panelEl, "::after");

	// content 없으면 pseudo 박스 없음
	if (!s || s.content === "none" || s.content === "normal") return null;
	if (s.display === "none" || s.visibility === "hidden") return null;

	const w = parseCSSLen(s.width, base.width);
	const h = parseCSSLen(s.height, base.height);
	if (!w || !h) return null;

	const leftVal = parseCSSLen(s.left, base.width);
	const rightVal = parseCSSLen(s.right, base.width);
	const topVal = parseCSSLen(s.top, base.height);
	const bottomVal = parseCSSLen(s.bottom, base.height);

	let left = base.left;
	if (leftVal !== null) left = base.left + leftVal;
	else if (rightVal !== null) left = base.right - rightVal - w;

	let top = base.top;
	if (topVal !== null) top = base.top + topVal;
	else if (bottomVal !== null) top = base.bottom - bottomVal - h;

	return { left, top, right: left + w, bottom: top + h };
};

// ✅ 핵심: "실린더(::after) 위"면 false(=교차 금지), "선(코어) 위/근처"면 true
const isPointerOnPanelCore = (
	clientX: number,
	clientY: number,
	panelEl: HTMLElement,
	baseDir: string,
	CROSS_SLOP: number,
) => {
	const base = panelEl.getBoundingClientRect();

	// 1) ::after 박스(실린더)가 있으면, 그 위는 무조건 "코어 아님"
	const afterRect = getAfterRect(panelEl);
	if (afterRect && isPointInRect(clientX, clientY, afterRect)) {
		return false;
	}

	// 2) 코어 판정은 너무 타이트하지 않게: 선 두께 + CROSS_SLOP로 패딩
	const thickness =
		baseDir === "row" ? base.width : baseDir === "column" ? base.height : 1;

	const pad = Math.max(CROSS_SLOP, Math.ceil(thickness));

	// row(세로 선)은 x로 코어 판정, column(가로 선)은 y로 코어 판정
	if (baseDir === "row") {
		return clientX >= base.left - pad && clientX <= base.right + pad;
	}
	if (baseDir === "column") {
		return clientY >= base.top - pad && clientY <= base.bottom + pad;
	}
	return true;
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

		//  겹친 resize panel들 탐색
		const myDir = directionRef.current;

		//  실린더 위면 교차 판정 금지
		const coreHit = isPointerOnPanelCore(
			pos.clientX,
			pos.clientY,
			panelRef.current,
			myDir,
			CROSS_SLOP,
		);

		const nearPanels = coreHit
			? getPanelsNearPoint(
					pos.clientX,
					pos.clientY,
					panelRef.current,
					myDir,
				)
			: [{ el: panelRef.current, key: panelKey, dir: myDir }];

		const targetsSet = new Set<string>([panelKey]);
		nearPanels.forEach((p) => targetsSet.add(p.key));
		const targets = [...targetsSet];

		// 교차면 + 커서
		const cursor =
			coreHit && targets.length >= 2
				? "move"
				: flexDirectionModel[myDir].resizeCursor;

		const sessionId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

		resizeDragSubject.next({
			type: "START",
			sessionId,
			targets,
			cursor,
		});

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

			// 실린더위면 교차 커서/교차 하이라이트 금지
			const coreHit = isPointerOnPanelCore(
				e.clientX,
				e.clientY,
				panelRef.current!,
				myDir,
				CROSS_SLOP,
			);

			if (!coreHit) {
				panelRef.current!.style.cursor = "";
				clearCrossHoverMark();
				return;
			}

			const nearPanels = getPanelsNearPoint(
				e.clientX,
				e.clientY,
				panelRef.current,
				myDir,
			);

			const perpendicularPanels = nearPanels
				.filter((p) => p.dir && p.dir !== myDir)
				.map((p) => p.el);

			panelRef.current!.style.cursor =
				perpendicularPanels.length > 0 ? "move" : "";

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
