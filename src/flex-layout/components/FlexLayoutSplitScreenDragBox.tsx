"use client";
import {
	CSSProperties,
	HTMLAttributes,
	MouseEvent,
	ReactElement,
	ReactNode,
	RefObject,
	TouchEvent,
	useEffect,
	useRef,
} from "react";
import { dragState, useDragEvents } from "../hooks/useDrag";

import styles from "../styles/FlexLayout.module.css";
import { isDocumentOut } from "../utils/FlexLayoutUtils";

const MAX_STEP = 18;

function shouldAllowViewportScroll(x: number, y: number) {
	const w = window.innerWidth;
	const h = window.innerHeight;
	const marginX = w * 0.15;
	const marginY = h * 0.15;
	return (
		x < marginX || // 왼쪽 15 %
		x > w - marginX || // 오른쪽 15 %
		y < marginY || // 상단 15 %
		y > h - marginY // 하단 15 %
	);
}

function edgeVelocity(x: number, y: number) {
	const w = window.innerWidth,
		h = window.innerHeight;
	const mx = w * 0.15,
		my = h * 0.15;

	/* X 축 */
	let vx = 0;
	if (x < mx)
		// ← 왼쪽
		vx = -((mx - x) / mx) * MAX_STEP;
	else if (x > w - mx)
		// → 오른쪽
		vx = ((x - (w - mx)) / mx) * MAX_STEP;

	/* Y 축 */
	let vy = 0;
	if (y < my)
		// ↑ 상단
		vy = -((my - y) / my) * MAX_STEP;
	else if (y > h - my)
		// ↓ 하단
		vy = ((y - (h - my)) / my) * MAX_STEP;

	return { vx, vy };
}

function calcVelocity(dx: number, dy: number, x: number, y: number) {
	const w = window.innerWidth,
		h = window.innerHeight;
	const marginX = w * 0.15,
		marginY = h * 0.15;

	/* 거리가 0(가장자리)~margin 사이면 1~4 배 가중치 */
	const multX =
		x < marginX
			? 1 + ((marginX - x) / marginX) * 3
			: x > w - marginX
				? 1 + ((x - (w - marginX)) / marginX) * 3
				: 1;

	const multY =
		y < marginY
			? 1 + ((marginY - y) / marginY) * 3
			: y > h - marginY
				? 1 + ((y - (h - marginY)) / marginY) * 3
				: 1;

	/* ←→·↑↓ **반대 방향**으로 스크롤 */
	return { vx: -dx * multX, vy: -dy * multY };
}

function createScreenKey() {
	const c = globalThis.crypto as Crypto | undefined;

	if (c?.randomUUID) return c.randomUUID();

	if (c?.getRandomValues) {
		return Array.from(c.getRandomValues(new Uint32Array(16)), (e) =>
			e.toString(32).padStart(2, "0"),
		).join("");
	}

	//  폴백
	return `${Date.now().toString(32)}-${Math.random().toString(32).slice(2)}`;
}

export interface FlexLayoutSplitScreenDragBoxProps<
	E extends HTMLElement = HTMLElement,
> extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
	onMouseDown?: (event: MouseEvent<HTMLDivElement>) => void;
	onTouchStart?: (event: TouchEvent<HTMLDivElement>) => void;
	dropEndCallback?: ({
		x,
		y,
		containerName,
	}: {
		x: number;
		y: number;
		containerName: string;
	}) => void;
	style?: CSSProperties;
	navigationTitle?: string;
	targetComponent?: ReactElement;
	dropDocumentOutsideOption?: DropDocumentOutsideOption;
	children: ReactNode;
	containerName: string;
	screenKey?: string;
	isBlockingActiveInput?: boolean;
	customData?: Record<string, string | number | boolean | undefined>;
	scrollTargetRef?: RefObject<E>;
}

export interface DropDocumentOutsideOption {
	openUrl: string;
	widthRatio?: number;
	heightRatio?: number;
	isNewTap?: boolean;
}

export default function FlexLayoutSplitScreenDragBox<E extends HTMLElement>({
	onMouseDown,
	onTouchStart,
	dropEndCallback,
	style,
	navigationTitle,
	targetComponent,
	containerName,
	children,
	className,
	dropDocumentOutsideOption,
	screenKey = createScreenKey(),
	isBlockingActiveInput = false,
	customData = {},
	scrollTargetRef,
	...props
}: FlexLayoutSplitScreenDragBoxProps) {
	const scrollRAF = useRef<number | null>(null); // 애니메이션 루프 id
	const velocity = useRef<{ vx: number; vy: number }>({ vx: 0, vy: 0 });
	const ref = useRef<HTMLDivElement>(null);
	const clonedNodeRef = useRef<HTMLDivElement | null>(null);
	const clonedWidth = useRef<number | null>(null);
	const clonedHeight = useRef<number | null>(null);
	const hrefUrlRef = useRef<string>("");

	const { handleStart, handleMove, handleEnd } = useDragEvents({
		isBlockingActiveInput,
	});

	const handleMoveWrapper = (event: Event) => {
		let allowScrollEdge = false;
		let x = 0;
		let y = 0;

		if (event.type === "touchmove") {
			const t = (event as globalThis.TouchEvent).touches[0];
			x = t.clientX;
			y = t.clientY;
		} else {
			const m = event as globalThis.MouseEvent;
			x = m.clientX;
			y = m.clientY;
		}
		const { vx, vy } = edgeVelocity(x, y);
		const inEdge = vx !== 0 || vy !== 0;

		allowScrollEdge = shouldAllowViewportScroll(x, y);
		/* 중앙 영역이면 스크롤 막음, 가장자리면 허용 */
		if (clonedNodeRef.current?.isConnected && !inEdge) {
			event.preventDefault(); // 화면 고정
			if (scrollRAF.current) {
				cancelAnimationFrame(scrollRAF.current);
				scrollRAF.current = null;
			}
		}

		if (clonedNodeRef.current?.isConnected && inEdge) {
			event.preventDefault();
			velocity.current = { vx, vy }; // ← X·Y 둘 다 들어갈 수 있음

			if (!scrollRAF.current) {
				const step = () => {
					const target =
						scrollTargetRef?.current ??
						(document.scrollingElement as HTMLElement | null);

					if (target?.scrollBy) {
						target.scrollBy(
							velocity.current.vx,
							velocity.current.vy,
						);
					} else {
						window.scrollBy(
							velocity.current.vx,
							velocity.current.vy,
						);
					}
					if (
						velocity.current.vx === 0 &&
						velocity.current.vy === 0
					) {
						scrollRAF.current = null;
						return;
					}
					scrollRAF.current = requestAnimationFrame(step);
				};
				scrollRAF.current = requestAnimationFrame(step);
			}
		}
		if (event.type !== "touchmove") {
			/* 마우스 · 펜 → 항상 고정 */
			event.preventDefault();
		}
		handleMove({
			event,
			notDragCallback: ({ x, y }) => {
				if (clonedNodeRef.current) clonedNodeRef.current.remove();
			},
			dragStartCallback: ({ x, y }) => {
				if (!clonedNodeRef.current) return;
				navigator.vibrate(100);
				clonedNodeRef.current.style.left = `${x - (clonedWidth.current || 0) / 2}px`;
				clonedNodeRef.current.style.top = `${y - (clonedHeight.current || 0) / 2}px`;
			},
			moveingCallback: ({ x, y }) => {
				if (clonedNodeRef.current?.isConnected) {
					clonedNodeRef.current.style.left = `${x - (clonedWidth.current || 0) / 2}px`;
					clonedNodeRef.current.style.top = `${y - (clonedHeight.current || 0) / 2}px`;
				}

				dragState.next({
					isDragging: true,
					isDrop: false,
					navigationTitle,
					children: targetComponent,
					x,
					y,
					containerName,
					dropDocumentOutsideOption,
					customData,
				});
			},
		});
	};

	const handleEndWrapper = (event: Event) => {
		//  안전장치로 RAF 취소
		if (scrollRAF.current !== null) {
			cancelAnimationFrame(scrollRAF.current);
			scrollRAF.current = null;
		}
		velocity.current = { vx: 0, vy: 0 };

		// 추가 안전장치 blur나 cancel 이벤트 발생 시 Clone 노드를 강제 정리
		if (
			event.type === "blur" ||
			event.type === "touchcancel" ||
			event.type === "pointercancel"
		) {
			if (clonedNodeRef.current) clonedNodeRef.current.remove();
		}

		handleEnd({
			event,
			dragEndCallback: ({ x, y }) => {
				const href = hrefUrlRef.current;
				if (clonedNodeRef.current) clonedNodeRef.current.remove();
				if (dropDocumentOutsideOption && isDocumentOut({ x, y })) {
					if (
						dropDocumentOutsideOption.isNewTap ||
						(!dropDocumentOutsideOption.widthRatio &&
							!dropDocumentOutsideOption.heightRatio)
					) {
						window.open(href, "_blank");
					} else {
						const width =
							window.innerWidth *
							(dropDocumentOutsideOption.widthRatio || 1);
						const height =
							window.innerHeight *
							(dropDocumentOutsideOption.heightRatio || 1);
						window.open(
							href,
							"_blank",
							`width=${width},height=${height},left=${window.screenLeft - x * -1 - width},top=${window.screenTop + y}`,
						);
					}
				}
				dragState.next({
					isDragging: false,
					isDrop: true,
					navigationTitle,
					children: targetComponent,
					x,
					y,
					containerName,
					dropDocumentOutsideOption,
					dropEndCallback,
					screenKey,
					customData,
				});
			},
		});
	};

	useEffect(() => {
		if (ref.current) {
			const clone = ref.current.cloneNode(true) as HTMLDivElement;
			const originRect = ref.current.getBoundingClientRect();
			clone.style.width = originRect.width + "px";
			clone.style.height = originRect.height + "px";
			clone.style.opacity = "0.3";
			clone.style.backdropFilter = "blur(6px)";
			clonedWidth.current = originRect.width;
			clonedHeight.current = originRect.height;
			if (dropDocumentOutsideOption?.openUrl) {
				hrefUrlRef.current = dropDocumentOutsideOption!.openUrl;
				const href = document.createElement("span");
				href.textContent = hrefUrlRef.current;
				clone.prepend(href);
			}

			if (navigationTitle) {
				const title = document.createElement("span");
				title.textContent = navigationTitle;
				clone.prepend(title);
			}
			clone.style.position = "fixed";
			clonedNodeRef.current = clone;
			clonedNodeRef.current.classList.add(
				styles["flex-split-screen-drag-box-clone"],
			);
		}
	}, []);

	useEffect(() => {
		const moveEvents: Array<keyof WindowEventMap> = [
			"mousemove",
			"touchmove",
		];

		// 드래그 상태가 붕괴되거나 좀비 상태가 될 수 있는 예외 케이스들을 모두 포함
		const endEvents: Array<keyof WindowEventMap> = [
			"mouseup",
			"touchend",
			"touchcancel", // 터치 제스처 시스템 인터럽트
			"pointerup", // 범용 포인터 이벤트
			"pointercancel",
			"blur", // 윈도우 포커스 아웃 (Alt+Tab 등)
		];

		moveEvents.forEach((eventName) => {
			window.addEventListener(eventName, handleMoveWrapper, {
				passive: false,
			});
		});
		endEvents.forEach((eventName) => {
			window.addEventListener(eventName, handleEndWrapper);
		});
		return () => {
			moveEvents.forEach((eventName) => {
				window.removeEventListener(eventName, handleMoveWrapper);
			});
			endEvents.forEach((eventName) => {
				window.removeEventListener(eventName, handleEndWrapper);
			});
		};
	}, [
		customData,
		targetComponent,
		dropDocumentOutsideOption,
		screenKey,
		isBlockingActiveInput,
		containerName,
		navigationTitle,
		dropEndCallback,
	]);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;

		const onCtx = (e: Event) => e.preventDefault();

		el.addEventListener("contextmenu", onCtx);

		return () => {
			el.removeEventListener("contextmenu", onCtx);
		};
	}, []);

	return (
		<>
			<div
				className={`${className || ""} ${styles["flex-split-screen-drag-box"]}`}
				ref={ref}
				onContextMenu={(e) => e.preventDefault()}
				onMouseDown={(ev) => {
					if (onMouseDown) {
						Promise.resolve().then(() => onMouseDown(ev));
					}
					handleStart({
						event: ev,
						dragStartCallback: ({ x, y }) => {
							if (clonedNodeRef.current) {
								document.body.appendChild(
									clonedNodeRef.current,
								);
								if (ref.current) {
									const originRect =
										ref.current.getBoundingClientRect();
									clonedNodeRef.current.style.width =
										originRect.width + "px";
									clonedNodeRef.current.style.height =
										originRect.height + "px";

									clonedWidth.current = originRect.width;
									clonedHeight.current = originRect.height;
								}
							}

							if (clonedNodeRef.current?.isConnected) {
								navigator.vibrate(100);
								clonedNodeRef.current.style.left = `${x - (clonedWidth.current || 0) / 2}px`;
								clonedNodeRef.current.style.top = `${y - (clonedHeight.current || 0) / 2}px`;
							}
							dragState.next({
								isDragging: true,
								isDrop: false,
								navigationTitle,
								children: targetComponent,
								x,
								y,
								containerName,
								dropDocumentOutsideOption,
								customData,
							});
						},
					});
				}}
				onTouchStart={(ev) => {
					if (onTouchStart) {
						Promise.resolve().then(() => onTouchStart(ev));
					}
					handleStart({
						event: ev,
						dragStartCallback: ({ x, y }) => {
							if (clonedNodeRef.current) {
								document.body.appendChild(
									clonedNodeRef.current,
								);
								if (ref.current) {
									const originRect =
										ref.current.getBoundingClientRect();
									clonedNodeRef.current.style.width =
										originRect.width + "px";
									clonedNodeRef.current.style.height =
										originRect.height + "px";

									clonedWidth.current = originRect.width;
									clonedHeight.current = originRect.height;
								}
							}
							if (clonedNodeRef.current?.isConnected) {
								navigator.vibrate(100);
								clonedNodeRef.current.style.left = `${x - (clonedWidth.current || 0) / 2}px`;
								clonedNodeRef.current.style.top = `${y - (clonedHeight.current || 0) / 2}px`;
							}
							dragState.next({
								isDragging: true,
								isDrop: false,
								navigationTitle,
								children: targetComponent,
								x,
								y,
								containerName,
								dropDocumentOutsideOption,
								customData,
							});
						},
					});
				}}
				style={{ ...style }}
				{...props}
			>
				{children}
			</div>
			{}
		</>
	);
}
