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
	useState,
} from "react";
import {
	dragStateSubject,
	DragStateType,
	useDragEvents,
} from "../hooks/useDrag";

import styles from "../styles/FlexLayout.module.css";
import { isDocumentOut } from "../utils/FlexLayoutUtils";
import { FlexLayoutIFramePane } from "./FlexLayoutIFramePane";

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

function getFallbackElement(targetComponent?: ReactElement, url?: string) {
	if (targetComponent) return targetComponent;
	if (url) return <FlexLayoutIFramePane url={url} />;
	return undefined;
}

function titleFromUrl(url?: string) {
	if (!url) return undefined;
	try {
		const u = new URL(url);
		return u.hostname;
	} catch {
		return url;
	}
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
	screenKey: _screenKey,
	isBlockingActiveInput = false,
	customData = {},
	scrollTargetRef,
	...props
}: FlexLayoutSplitScreenDragBoxProps) {
	const [screenKey, setScreenKey] = useState<string>();
	useEffect(() => {
		if (!_screenKey) setScreenKey(createScreenKey());
		else setScreenKey(_screenKey);
	}, [_screenKey]);
	const scrollRAF = useRef<number | null>(null); // 애니메이션 루프 id
	const velocity = useRef<{ vx: number; vy: number }>({ vx: 0, vy: 0 });
	const ref = useRef<HTMLDivElement>(null);
	const clonedNodeRef = useRef<HTMLDivElement | null>(null);
	const clonedWidth = useRef<number | null>(null);
	const clonedHeight = useRef<number | null>(null);
	const hrefUrlRef = useRef<string>("");

	const rafId = useRef<number | null>(null);
	const pending = useRef<DragStateType | null>(null);

	const lastPointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
	const escCanceledRef = useRef(false);

	const emitDragState = (v: DragStateType) => {
		pending.current = v;
		if (rafId.current != null) return;

		rafId.current = requestAnimationFrame(() => {
			if (pending.current) dragStateSubject.next(pending.current);
			pending.current = null;
			rafId.current = null;
		});
	};

	useEffect(() => {
		return () => {
			if (rafId.current != null) cancelAnimationFrame(rafId.current);
		};
	}, []);

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
				clonedNodeRef.current.style.transform = `translate3d(${x - (clonedWidth.current || 0) / 2}px, ${y - (clonedHeight.current || 0) / 2}px, 0)`;
			},
			moveingCallback: ({ x, y }) => {
				lastPointRef.current = { x, y };
				if (clonedNodeRef.current?.isConnected) {
					clonedNodeRef.current.style.transform = `translate3d(${x - (clonedWidth.current || 0) / 2}px, ${y - (clonedHeight.current || 0) / 2}px, 0)`;
					// clonedNodeRef.current.style.left = `${x - (clonedWidth.current || 0) / 2}px`;
					// clonedNodeRef.current.style.top = `${y - (clonedHeight.current || 0) / 2}px`;
				}

				emitDragState({
					isDragging: true,
					isDrop: false,
					navigationTitle:
						navigationTitle ??
						titleFromUrl(dropDocumentOutsideOption?.openUrl),
					children: getFallbackElement(
						targetComponent,
						dropDocumentOutsideOption?.openUrl,
					),
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
				if (escCanceledRef.current) {
					escCanceledRef.current = false;
					if (clonedNodeRef.current) clonedNodeRef.current.remove();

					emitDragState({
						isDragging: false,
						isDrop: false,
						navigationTitle:
							navigationTitle ??
							titleFromUrl(dropDocumentOutsideOption?.openUrl),
						children: getFallbackElement(
							targetComponent,
							dropDocumentOutsideOption?.openUrl,
						),
						x,
						y,
						containerName,
						dropDocumentOutsideOption,
						customData,
					});
					return;
				}

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
				emitDragState({
					isDragging: false,
					isDrop: true,
					navigationTitle:
						navigationTitle ??
						titleFromUrl(dropDocumentOutsideOption?.openUrl),
					children: getFallbackElement(
						targetComponent,
						dropDocumentOutsideOption?.openUrl,
					),
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

			const title = document.createElement("span");
			title.textContent =
				navigationTitle ??
				titleFromUrl(dropDocumentOutsideOption?.openUrl) ??
				"";
			clone.prepend(title);

			clone.style.position = "fixed";
			clone.style.left = "0px";
			clone.style.top = "0px";
			clone.style.margin = "0px";
			clone.style.willChange = "transform";
			clone.style.transform = "translate3d(-9999px, -9999px, 0)";
			clone.style.pointerEvents = "none";

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

	useEffect(() => {
		return () => {
			if (scrollRAF.current !== null) {
				cancelAnimationFrame(scrollRAF.current);
				scrollRAF.current = null;
			}
			velocity.current = { vx: 0, vy: 0 };
			clonedNodeRef.current?.remove();
		};
	}, []);

	//취소 이벤트
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return;

			// 드래그가 실제로 시작된 상태에서만 (clone이 body에 붙어있는 상태)
			if (!clonedNodeRef.current?.isConnected) return;

			e.preventDefault();
			e.stopPropagation();

			// 다음 mouseup이 와도 drop 로직 안 타게
			escCanceledRef.current = true;

			// 스크롤/RAF 정리
			if (scrollRAF.current !== null) {
				cancelAnimationFrame(scrollRAF.current);
				scrollRAF.current = null;
			}
			velocity.current = { vx: 0, vy: 0 };

			// clone 제거
			clonedNodeRef.current?.remove();

			//  useDragEvents 내부 상태도 "끝"으로 만들어 좀비 드래그 방지
			// (좌표는 hook이 마지막 좌표를 들고 있거나, 아래 emit에선 lastPointRef를 사용)
			handleEnd({
				event: new Event("pointercancel"),
				dragEndCallback: () => {},
			});

			// overlay 등 외부 UI도 즉시 종료시키기
			const { x, y } = lastPointRef.current;
			emitDragState({
				isDragging: false,
				isDrop: false,
				navigationTitle:
					navigationTitle ??
					titleFromUrl(dropDocumentOutsideOption?.openUrl),
				children: getFallbackElement(
					targetComponent,
					dropDocumentOutsideOption?.openUrl,
				),
				x,
				y,
				containerName,
				dropDocumentOutsideOption,
				customData,
			});
		};

		window.addEventListener("keydown", onKeyDown, true);
		return () => window.removeEventListener("keydown", onKeyDown, true);
	}, [
		handleEnd,
		containerName,
		navigationTitle,
		dropDocumentOutsideOption,
		targetComponent,
		customData,
	]);

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
							lastPointRef.current = { x, y };
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

								clonedNodeRef.current.style.transform = `translate3d(${x - (clonedWidth.current || 0) / 2}px, ${y - (clonedHeight.current || 0) / 2}px, 0)`;
							}
							emitDragState({
								isDragging: true,
								isDrop: false,
								navigationTitle:
									navigationTitle ??
									titleFromUrl(
										dropDocumentOutsideOption?.openUrl,
									),
								children: getFallbackElement(
									targetComponent,
									dropDocumentOutsideOption?.openUrl,
								),
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
								clonedNodeRef.current.style.transform = `translate3d(${x - (clonedWidth.current || 0) / 2}px, ${y - (clonedHeight.current || 0) / 2}px, 0)`;
							}
							emitDragState({
								isDragging: true,
								isDrop: false,
								navigationTitle:
									navigationTitle ??
									titleFromUrl(
										dropDocumentOutsideOption?.openUrl,
									),
								children: getFallbackElement(
									targetComponent,
									dropDocumentOutsideOption?.openUrl,
								),
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
