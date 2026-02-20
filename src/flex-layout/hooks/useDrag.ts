import equal from "fast-deep-equal";
import {
	MouseEvent,
	ReactElement,
	RefObject,
	TouchEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	animationFrameScheduler,
	auditTime,
	BehaviorSubject,
	distinctUntilChanged,
	map,
	Subject,
} from "rxjs";
import { DropDocumentOutsideOption } from "../components/FlexLayoutSplitScreenDragBox";
import { getClientXy } from "../utils/FlexLayoutUtils";
export interface DragStateType {
	isDragging: boolean;
	isDrop: boolean;
	navigationTitle?: string;
	children?: ReactElement;
	containerName: string;
	x: number;
	y: number;
	dropDocumentOutsideOption?: DropDocumentOutsideOption;
	dropEndCallback?: ({
		x,
		y,
		containerName,
	}: {
		x: number;
		y: number;
		containerName: string;
	}) => void;
	screenKey?: string;
	customData?: Record<string, string | number | boolean | undefined>;
}
export type PositionName =
	| "centerBoundary"
	| "leftBoundary"
	| "rightBoundary"
	| "topBoundary"
	| "bottomBoundary";

export interface DragStateResultType extends DragStateType {
	positionName: PositionName;
	isOver: boolean;
}
export const dragStateSubject = new Subject<DragStateType>();
/**
 * @deprecated Use `dragStateSubject` instead. This alias will be removed in a future release.
 */
export const dragState = dragStateSubject;

export const isResizingSubject = new BehaviorSubject<boolean>(false);

const filterChildren = (obj: any) => {
	// 객체 복사 후 children 속성 제거
	const { children, ...rest } = obj || {};
	return rest;
};

export const useDragCapture = (targetRef: RefObject<HTMLElement | null>) => {
	const [state, setState] = useState<DragStateResultType | null>(null);

	useEffect(() => {
		const subscription = dragStateSubject
			.pipe(
				auditTime(0, animationFrameScheduler),
				map((value) => {
					if (!targetRef || !targetRef.current) return null;

					const { x, y } = value;
					const rect = targetRef.current.getBoundingClientRect();
					const {
						width,
						height,
						x: rectX,
						y: rectY,
						right,
						bottom,
					} = rect;

					let isOver = false;
					if (x < rectX || x > right || y < rectY || y > bottom) {
						isOver = true;
					}

					const leftBoundary = rectX + width * 0.2;
					const rightBoundary = right - width * 0.2;
					const topBoundary = rectY + height * 0.2;
					const bottomBoundary = bottom - height * 0.2;

					let position = "centerBoundary";
					if (x < leftBoundary) {
						position = "leftBoundary";
					} else if (x > rightBoundary) {
						position = "rightBoundary";
					} else if (y < topBoundary) {
						position = "topBoundary";
					} else if (y > bottomBoundary) {
						position = "bottomBoundary";
					}

					return {
						positionName: position as PositionName,
						isOver,
						...value,
					};
				}),
				distinctUntilChanged((prev, curr) => {
					const { children: prevChildren, ..._prev } = prev || {};
					const { children: currChildren, ..._curr } = curr || {};

					return equal(filterChildren(_prev), filterChildren(_curr));
				}),
			)
			.subscribe({
				next: setState,
				error: (err) => console.error(err),
			});

		return () => subscription.unsubscribe();
	}, [targetRef]);

	return state;
};
export interface DropTargetComponent {
	containerName: string;
	component: ReactElement;
	navigationTitle?: string;
	dropDocumentOutsideOption?: DropDocumentOutsideOption;
	screenKey: string;
}
export type DropPositionOrderName = "before" | "center" | "after";

export interface DropMovementEventType {
	state: "remove" | "append" | "change";
	targetParentLayoutName: string;
	targetLayoutName: string;
	targetContainerName: string;
	targetComponent?: ReactElement;
	nextContainerName?: string;
	parentOrderName?: DropPositionOrderName;
	orderName?: DropPositionOrderName;
	x?: number;
	y?: number;
	dropEndCallback?: ({
		x,
		y,
		containerName,
	}: {
		x: number;
		y: number;
		containerName: string;
	}) => void;
	dropTargetComponentEvent?: DropTargetComponentEvent;
}
export interface DropTargetComponentEvent extends Omit<
	DropTargetComponent,
	"containerName" | "component"
> {
	direction: "row" | "column";
}
export const dropMovementEventSubject = new Subject<DropMovementEventType>();

export const allSplitScreenCount = new BehaviorSubject<number>(0);

export const useDragEvents = ({
	isBlockingActiveInput = false,
}: {
	isBlockingActiveInput?: boolean;
}) => {
	const dragResumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const dragStartDelayTimer = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);

	const scrollThreshold = 10; // 이동 거리 임계값

	const isScrolling = useRef<boolean>(false);
	const isPending = useRef(false);
	const isMouseDown = useRef(false);
	const isDragging = useRef(false); // 드래그 상태 플래그
	const touchStartX = useRef<number>(0);
	const touchStartY = useRef<number>(0);

	useEffect(() => {
		return () => {
			if (dragResumeTimer.current) {
				clearTimeout(dragResumeTimer.current);
				dragResumeTimer.current = null;
			}
			if (dragStartDelayTimer.current) {
				clearTimeout(dragStartDelayTimer.current);
				dragStartDelayTimer.current = null;
			}
		};
	}, []);

	const handleStart = useCallback(
		({
			event: _event,
			dragStartCallback,
		}: {
			event: MouseEvent | TouchEvent | Event;
			dragStartCallback: ({ x, y }: { x: number; y: number }) => void;
		}) => {
			const event = _event instanceof Event ? _event : _event.nativeEvent;

			// 기존 타이머가 있다면 정리
			if (dragResumeTimer.current) {
				clearTimeout(dragResumeTimer.current);
				dragResumeTimer.current = null;
			}
			if (dragStartDelayTimer.current) {
				clearTimeout(dragStartDelayTimer.current);
				dragStartDelayTimer.current = null;
			}

			if (
				(event.target as HTMLElement).contentEditable === "true" ||
				(isBlockingActiveInput &&
					document.activeElement === event.target)
			) {
				return;
			}
			if (event.cancelable && !(event instanceof globalThis.TouchEvent)) {
				event.preventDefault(); // cancelable=false 면 자동 skip
			}

			isPending.current = true;
			isMouseDown.current = true;
			isScrolling.current = false;

			// if (event instanceof globalThis.TouchEvent) {
			// 	const touch = event.touches[0];
			// 	touchStartX.current = touch.clientX;
			// 	touchStartY.current = touch.clientY;
			// } else if (event instanceof globalThis.MouseEvent) {
			// 	touchStartX.current = event.clientX;
			// 	touchStartY.current = event.clientY;
			// }

			const xy = getClientXy(event);
			if (!xy) return;
			touchStartX.current = xy.clientX;
			touchStartY.current = xy.clientY;

			if (
				event.type.toLowerCase().startsWith("touch") ||
				event instanceof globalThis.TouchEvent
			) {
				isPending.current = false;
				isDragging.current = true;

				dragStartCallback({ x: xy.clientX, y: xy.clientY });
				return;
			}

			//event.preventDefault();
			dragStartDelayTimer.current = setTimeout(() => {
				if (!isPending.current || isScrolling.current) return; // 스크롤 중이면 드래그 취소
				isPending.current = false;
				isDragging.current = true;

				const xy = getClientXy(event);
				if (!xy) return;

				const { clientX, clientY } = xy;

				dragStartCallback({ x: clientX, y: clientY });
			}, 300);
		},
		[isBlockingActiveInput],
	);

	const handleMove = useCallback(
		({
			event: _event,
			notDragCallback,
			dragStartCallback,
			moveingCallback,
		}: {
			event: MouseEvent | TouchEvent | Event;
			notDragCallback?: ({ x, y }: { x: number; y: number }) => void;
			dragStartCallback: ({ x, y }: { x: number; y: number }) => void;
			moveingCallback: ({ x, y }: { x: number; y: number }) => void;
		}) => {
			if (!isMouseDown.current) return;
			const event = _event instanceof Event ? _event : _event.nativeEvent;

			const xy = getClientXy(event);
			if (!xy) return;
			const { clientX, clientY } = xy;
			const deltaX = Math.abs(clientX - touchStartX.current);
			const deltaY = Math.abs(clientY - touchStartY.current);

			if (
				isPending.current &&
				(event.type.toLowerCase().startsWith("touch") ||
					event instanceof globalThis.TouchEvent) &&
				(deltaX > scrollThreshold || deltaY > scrollThreshold)
			) {
				if (dragStartDelayTimer.current) {
					clearTimeout(dragStartDelayTimer.current);
					dragStartDelayTimer.current = null;
				}

				isScrolling.current = true; // 스크롤 중으로 설정
				isPending.current = false; // 드래그 취소
				isDragging.current = false;

				if (notDragCallback)
					notDragCallback({ x: clientX, y: clientY });
				//if (clonedNodeRef.current) clonedNodeRef.current.remove();

				if (dragResumeTimer.current) {
					clearTimeout(dragResumeTimer.current);
					dragResumeTimer.current = null;
				}
				dragResumeTimer.current = setTimeout(() => {
					if (!isMouseDown.current) return;
					// if (dragStartCallback)
					// 	dragStartCallback({ x: clientX, y: clientY });
					// isPending.current = true;
					// isScrolling.current = false;
					// handleStart({ event: _event, dragStartCallback });

					touchStartX.current = clientX;
					touchStartY.current = clientY;
					isPending.current = true;
					isScrolling.current = false;
					handleStart({ event: _event, dragStartCallback });
				}, 400);
				return;
			}

			if (!isDragging.current || isPending.current) return; // 드래그 중이 아닐 경우 무시

			moveingCallback({ x: clientX, y: clientY });
		},
		[isBlockingActiveInput],
	);
	const handleEnd = useCallback(
		({
			event: _event,
			dragEndCallback,
		}: {
			event: MouseEvent | TouchEvent | Event;
			dragEndCallback: ({ x, y }: { x: number; y: number }) => void;
		}) => {
			isScrolling.current = false;
			isMouseDown.current = false;

			if (isPending.current) {
				isPending.current = false;
				if (dragStartDelayTimer.current) {
					clearTimeout(dragStartDelayTimer.current);
					dragStartDelayTimer.current = null;
				}
				return;
			}
			const event = _event instanceof Event ? _event : _event.nativeEvent;

			if (!isDragging.current) return; // 드래그 중이 아닐 경우 무시

			isDragging.current = false; // 드래그 종료

			const xy = getClientXy(event);
			if (!xy) return;

			const { clientX, clientY } = xy;

			dragEndCallback({ x: clientX, y: clientY });
			// const href = hrefUrlRef.current;

			// if (clonedNodeRef.current) clonedNodeRef.current.remove();
			// //console.log(clientX, clientY);
			// if (
			//     dropDocumentOutsideOption &&
			//     isDocumentOut({ x: clientX, y: clientY })
			// ) {
			//     if (
			//         dropDocumentOutsideOption.isNewTap ||
			//         (!dropDocumentOutsideOption.widthRatio &&
			//             !dropDocumentOutsideOption.heightRatio)
			//     ) {
			//         window.open(href, '_blank');
			//     } else {
			//         const width =
			//             window.innerWidth *
			//             (dropDocumentOutsideOption.widthRatio || 1);
			//         const height =
			//             window.innerHeight *
			//             (dropDocumentOutsideOption.heightRatio || 1);
			//         window.open(
			//             href,
			//             '_blank',
			//             `width=${width},height=${height},left=${window.screenLeft - clientX * -1 - width},top=${window.screenTop + clientY}`
			//         );
			//     }
			// }

			// dragState.next({
			//     isDragging: false,
			//     isDrop: true,
			//     navigationTitle,
			//     children: targetComponent,
			//     x: clientX,
			//     y: clientY,
			//     containerName,
			//     dropDocumentOutsideOption,
			//     dropEndCallback,
			//     screenKey,
			//     customData,
			// });
			//if (dropEndCallback) dropEndCallback({ x: clientX, y: clientY });
		},
		[isBlockingActiveInput],
	);

	return {
		handleStart,
		handleMove,
		handleEnd,
	};
};

export type FolderEventType = {
	type: "new" | "sort" | "title" | "delete" | "insert" | "update" | "next";
	isFolder: boolean;
	title: string;
	sort?: number;
	parentId?: string;
	id?: string;
	newData?: any;
};

export const folderEventSubject = new Subject<FolderEventType>();

export const setFolderEvent = (newValue: FolderEventType) => {
	folderEventSubject.next(newValue);
};

export const useFolderEvent = () => {
	const [folderEvent, setFolderEvent] = useState<FolderEventType | null>(
		null,
	);
	useEffect(() => {
		const subscription = folderEventSubject.subscribe((e) => {
			if (!e) return;
			setFolderEvent(e);
		});

		return () => {
			if (subscription) {
				subscription.unsubscribe();
			}
		};
	}, []);

	return { folderEvent };
};
