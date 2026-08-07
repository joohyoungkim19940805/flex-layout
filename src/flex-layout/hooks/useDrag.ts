import { createRxStateTuple } from "@byeolnaerim/global-rx-state";
import equal from "fast-deep-equal/react";
import {
	MouseEvent,
	ReactElement,
	ReactNode,
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
	navigationTitleComponent?: ReactNode;
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

export type ResizeDragEvent =
	| {
			type: "START";
			sessionId: string;
			targets: string[]; // resize panel key list
			cursor?: string;
	  }
	| {
			type: "MOVE";
			sessionId: string;
			movementX: number;
			movementY: number;
	  }
	| {
			type: "END";
			sessionId: string;
	  };

export const dragStateSubject = new Subject<DragStateType>();
/**
 * @deprecated Use `dragStateSubject` instead. This alias will be removed in a future release.
 */
export const dragState = dragStateSubject;

export const [, , useIsResizing, isResizingSubject] =
	createRxStateTuple<boolean>(false, "__flexLayoutIsResizing");

export const resizeDragSubject: Subject<ResizeDragEvent> =
	new Subject<ResizeDragEvent>();

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
	navigationTitleComponent?: ReactNode;
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

export const [, , useAllSplitScreenCount, allSplitScreenCount] =
	createRxStateTuple<number>(0, "__flexLayoutAllSplitScreenCount");

export const [
	setSplitScreenLeafCounts,
	getSplitScreenLeafCounts,
	useSplitScreenLeafCounts,
] = createRxStateTuple<Record<string, number>>(
	{},
	"__flexLayoutSplitScreenLeafCounts",
);

export const addSplitScreenLeaf = (rootName: string) => {
	const current = getSplitScreenLeafCounts();
	setSplitScreenLeafCounts({
		...current,
		[rootName]: (current[rootName] || 0) + 1,
	});
};

export const removeSplitScreenLeaf = (rootName: string) => {
	const current = getSplitScreenLeafCounts();
	const nextCount = Math.max((current[rootName] || 0) - 1, 0);

	if (nextCount === 0) {
		const { [rootName]: _, ...rest } = current;
		setSplitScreenLeafCounts(rest);
		return;
	}

	setSplitScreenLeafCounts({
		...current,
		[rootName]: nextCount,
	});
};

export const useDragEvents = ({
	isBlockingActiveInput = false,
}: {
	isBlockingActiveInput?: boolean;
}) => {
	const dragStartDelayTimer = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);

	const scrollThreshold = 10;

	const isScrolling = useRef<boolean>(false);
	const isPending = useRef(false);
	const isMouseDown = useRef(false);
	const isDragging = useRef(false);
	const touchStartX = useRef<number>(0);
	const touchStartY = useRef<number>(0);

	useEffect(() => {
		return () => {
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

			const xy = getClientXy(event);
			if (!xy) return;

			touchStartX.current = xy.clientX;
			touchStartY.current = xy.clientY;

			isPending.current = true;
			isMouseDown.current = true;
			isScrolling.current = false;
			isDragging.current = false;

			if (event.cancelable && !(event instanceof globalThis.TouchEvent)) {
				event.preventDefault();
			}

			dragStartDelayTimer.current = setTimeout(() => {
				if (!isPending.current || isScrolling.current) return;

				isPending.current = false;
				isDragging.current = true;

				dragStartCallback({
					x: touchStartX.current,
					y: touchStartY.current,
				});
			}, 300);
		},
		[isBlockingActiveInput],
	);

	const handleMove = useCallback(
		({
			event: _event,
			notDragCallback,
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

				isScrolling.current = true;
				isPending.current = false;
				isDragging.current = false;
				isMouseDown.current = false;

				if (notDragCallback) {
					notDragCallback({ x: clientX, y: clientY });
				}

				return;
			}

			if (!isDragging.current || isPending.current) return;

			moveingCallback({ x: clientX, y: clientY });
		},
		[],
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

			if (!isDragging.current) return;

			isDragging.current = false;

			const xy = getClientXy(event);
			if (!xy) return;

			dragEndCallback({
				x: xy.clientX,
				y: xy.clientY,
			});
		},
		[],
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
