import * as React$1 from 'react';
import { HTMLAttributes, MouseEvent, TouchEvent, CSSProperties, ReactElement, ReactNode, RefObject } from 'react';
import * as rxjs from 'rxjs';
import { Subject, BehaviorSubject } from 'rxjs';

interface FlexLayoutSplitScreenDragBoxProps<E extends HTMLElement = HTMLElement> extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
    onMouseDown?: (event: MouseEvent<HTMLDivElement>) => void;
    onTouchStart?: (event: TouchEvent<HTMLDivElement>) => void;
    dropEndCallback?: ({ x, y, containerName, }: {
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
interface DropDocumentOutsideOption {
    openUrl: string;
    widthRatio?: number;
    heightRatio?: number;
    isNewTap?: boolean;
}

type FlexLayoutSplitScreenProps = {
    layoutName: string;
    containerName: string;
    children: ReactElement;
    navigationTitle: string;
    dropDocumentOutsideOption?: DropDocumentOutsideOption;
    screenKey?: string;
};

interface FlexLayoutSplitScreenScrollBoxProps extends HTMLAttributes<HTMLDivElement> {
    keyName: string;
    className?: string;
    direction?: "x" | "y";
    isDefaultScrollStyle?: boolean;
}

type SubjectMap<T> = Record<string, Subject<T>>;
interface ContainerStateRequest {
    mode: "toggle" | "open" | "close";
    initOpenState?: boolean;
    onOpen?: () => void;
    onClose?: () => void;
    openOption?: {
        isPrevSizeOpen?: boolean;
        isResize?: boolean;
        openGrowImportant?: number;
    };
    closeOption?: {
        isResize?: boolean;
        isDsiabledResizePanel?: boolean;
    };
}
interface ContainerState {
    isOpen: boolean;
    targetContainer: HTMLElement;
    grow: number;
}
declare const containerOpenCloseSubjectMap: SubjectMap<ContainerStateRequest>;
declare const containerSpreadSubjectMap: SubjectMap<ContainerState>;
declare const ContainerOpenCloseProvider: ({ layoutName, containerName, sizeName, }: {
    layoutName: string;
    containerName: string;
    sizeName: "width" | "height";
}) => null;
declare const useContainers: (layoutName: string) => HTMLElement[];
declare const useLayoutName: (containerName: string) => string | undefined;
declare const useDecompositionLayout: ({ layoutName: initialLayoutName, containerName, }: {
    layoutName?: string;
    containerName: string;
}) => {
    layout: HTMLElement[];
    container: HTMLElement | undefined;
    resizePanel: HTMLElement | undefined;
};
declare const useContainerSize: (containerName: string) => {
    size: {
        width: number;
        height: number;
    } | undefined;
};
declare const useDoubleClick: (containerName: string, opt: ContainerStateRequest) => {
    isOpen: boolean | undefined;
    isDoubleClick: boolean | undefined;
    setIsDoubleClick: React$1.Dispatch<React$1.SetStateAction<boolean | undefined>>;
};

interface DragStateType {
    isDragging: boolean;
    isDrop: boolean;
    navigationTitle?: string;
    children?: ReactElement;
    containerName: string;
    x: number;
    y: number;
    dropDocumentOutsideOption?: DropDocumentOutsideOption;
    dropEndCallback?: ({ x, y, containerName, }: {
        x: number;
        y: number;
        containerName: string;
    }) => void;
    screenKey?: string;
    customData?: Record<string, string | number | boolean | undefined>;
}
type PositionName = "centerBoundary" | "leftBoundary" | "rightBoundary" | "topBoundary" | "bottomBoundary";
interface DragStateResultType extends DragStateType {
    positionName: PositionName;
    isOver: boolean;
}
declare const dragState: Subject<DragStateType>;
declare const useDragCapture: (targetRef: RefObject<HTMLElement | null>) => DragStateResultType | null;
interface DropTargetComponent {
    containerName: string;
    component: ReactElement;
    navigationTitle?: string;
    dropDocumentOutsideOption?: DropDocumentOutsideOption;
    screenKey: string;
}
type DropPositionOrderName = "before" | "center" | "after";
interface DropMovementEventType {
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
    dropEndCallback?: ({ x, y, containerName, }: {
        x: number;
        y: number;
        containerName: string;
    }) => void;
    dropTargetComponentEvent?: DropTargetComponentEvent;
}
interface DropTargetComponentEvent extends Omit<DropTargetComponent, "containerName" | "component"> {
    direction: "row" | "column";
}
declare const dropMovementEventSubject: Subject<DropMovementEventType>;
declare const allSplitScreenCount: BehaviorSubject<number>;
declare const useDragEvents: ({ isBlockingActiveInput, }: {
    isBlockingActiveInput?: boolean;
}) => {
    handleStart: ({ event: _event, dragStartCallback, }: {
        event: React.MouseEvent | React.TouchEvent | Event;
        dragStartCallback: ({ x, y }: {
            x: number;
            y: number;
        }) => void;
    }) => void;
    handleMove: ({ event: _event, notDragCallback, dragStartCallback, moveingCallback, }: {
        event: React.MouseEvent | React.TouchEvent | Event;
        notDragCallback?: ({ x, y }: {
            x: number;
            y: number;
        }) => void;
        dragStartCallback: ({ x, y }: {
            x: number;
            y: number;
        }) => void;
        moveingCallback: ({ x, y }: {
            x: number;
            y: number;
        }) => void;
    }) => void;
    handleEnd: ({ event: _event, dragEndCallback, }: {
        event: React.MouseEvent | React.TouchEvent | Event;
        dragEndCallback: ({ x, y }: {
            x: number;
            y: number;
        }) => void;
    }) => void;
};
type FolderEventType = {
    type: "new" | "sort" | "title" | "delete" | "insert" | "update" | "next";
    isFolder: boolean;
    title: string;
    sort?: number;
    parentId?: string;
    id?: string;
    newData?: any;
};
declare const folderEventSubject: Subject<FolderEventType>;
declare const setFolderEvent: (newValue: FolderEventType) => void;
declare const useFolderEvent: () => {
    folderEvent: FolderEventType | null;
};

interface ScrollPosition {
    x: number;
    y: number;
}
declare const scrollPositions: Record<string, ScrollPosition>;
/**
 * 스크롤 위치 업데이트 함수
 *
 * 기존: 항상 store.next()가 호출됨 → 바뀌지 않았다면 건너뛰도록 변경
 */
declare const setScrollPosition: (layoutName: string, position: ScrollPosition) => void;
/**
 * 스크롤 위치 구독
 */
declare const getScrollPosition: (layoutName: string) => rxjs.Observable<ScrollPosition>;
declare const removeScrollPosition: (layoutName: string) => void;
type SplitScreenComponents = {
    afterDropTargetComponent: DropTargetComponent[];
    beforeDropTargetComponent: DropTargetComponent[];
    centerDropTargetComponent: DropTargetComponent[];
    direction: "row" | "column";
};
type LayoutSplitScreenState = Record<string, Record<string, SplitScreenComponents>>;
declare const layoutSplitScreenStore: BehaviorSubject<LayoutSplitScreenState>;
declare const setSplitScreen: (rootName: string, layoutName: string, newComponents: SplitScreenComponents) => void;
declare const resetRootSplitScreen: (rootName: string) => void;
declare const removeSplitScreenChild: (rootName: string, layoutName: string) => void;
declare const getCurrentSplitScreenComponents: (rootName: string, layoutName: string) => SplitScreenComponents | undefined;
declare const getSplitScreen: (rootName: string, layoutName: string) => rxjs.Observable<SplitScreenComponents>;
type RefStore = {
    [layoutName: string]: {
        [containerName: string]: RefObject<HTMLElement | null>;
    };
};
declare const flexContainerStore: BehaviorSubject<RefStore>;
declare const flexResizePanelStore: BehaviorSubject<RefStore>;
/**
 * ref를 업데이트하는 함수
 * - 기존: 무조건 next() → 새/이전 상태 비교 후 다를 경우에만 next()
 */
declare const setContainerRef: <T extends HTMLElement>(layoutName: string, containerName: string, ref: React.RefObject<T | null> | null) => void;
declare const setResizePanelRef: <T extends HTMLElement>(layoutName: string, containerName: string, ref: React.RefObject<T | null> | null) => void;
declare const getLayoutInfos: (layoutName: string) => rxjs.Observable<{
    container: {
        [containerName: string]: RefObject<HTMLElement | null>;
    };
    resizePanel: {
        [containerName: string]: RefObject<HTMLElement | null>;
    };
}>;
declare const getContainerRef: ({ containerName, layoutName, }: {
    containerName: string;
    layoutName?: string;
}) => rxjs.Observable<RefObject<HTMLElement | null> | undefined>;
declare const getResizePanelRef: ({ containerName, layoutName, }: {
    containerName: string;
    layoutName?: string;
}) => rxjs.Observable<RefObject<HTMLElement | null> | undefined>;

declare function isDocumentOut({ x, y }: {
    x: number;
    y: number;
}): boolean | undefined;
declare function getClientXy(event: Event): {
    clientX: number;
    clientY: number;
} | undefined;
declare function isOverMove(elementSize: number, elementMinSize: number): boolean;
declare function findNotCloseFlexContent(target: HTMLElement | Element | null, direction: 'previousElementSibling' | 'nextElementSibling'): HTMLElement | null;
declare function remain(flexContainerList: Array<HTMLElement>): Promise<unknown>;
declare function resize(list: Array<HTMLElement>, totalGrow: number): Promise<unknown>;
declare function mathWeight(totalCount: number, totalGrow: number): number;
declare function mathGrow(childSize: number, parentSize: number, containerCount: number): number;
declare function getGrow(growTarget: HTMLElement | Element): number;
declare function closeFlex(resizeTarget: HTMLElement, containers: HTMLElement[], { isResize, isDsiabledResizePanel, sizeName, }: {
    isResize?: boolean;
    isDsiabledResizePanel?: boolean;
    sizeName: 'width' | 'height';
}): Promise<unknown>;
declare function openFlex(resizeTarget: HTMLElement, containers: HTMLElement[], { isPrevSizeOpen, isResize, openGrowImportant, sizeName, }: {
    isPrevSizeOpen?: boolean;
    isResize?: boolean;
    openGrowImportant?: number;
    sizeName?: 'width' | 'height';
}): Promise<unknown>;

export { ContainerOpenCloseProvider, type DragStateResultType, type DragStateType, type DropDocumentOutsideOption, type DropMovementEventType, type DropPositionOrderName, type DropTargetComponent, type DropTargetComponentEvent, type FlexLayoutSplitScreenDragBoxProps, type FlexLayoutSplitScreenProps, type FlexLayoutSplitScreenScrollBoxProps, type FolderEventType, type LayoutSplitScreenState, type PositionName, type ScrollPosition, type SplitScreenComponents, type SubjectMap, allSplitScreenCount, closeFlex, containerOpenCloseSubjectMap, containerSpreadSubjectMap, dragState, dropMovementEventSubject, findNotCloseFlexContent, flexContainerStore, flexResizePanelStore, folderEventSubject, getClientXy, getContainerRef, getCurrentSplitScreenComponents, getGrow, getLayoutInfos, getResizePanelRef, getScrollPosition, getSplitScreen, isDocumentOut, isOverMove, layoutSplitScreenStore, mathGrow, mathWeight, openFlex, remain, removeScrollPosition, removeSplitScreenChild, resetRootSplitScreen, resize, scrollPositions, setContainerRef, setFolderEvent, setResizePanelRef, setScrollPosition, setSplitScreen, useContainerSize, useContainers, useDecompositionLayout, useDoubleClick, useDragCapture, useDragEvents, useFolderEvent, useLayoutName };
