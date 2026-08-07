import type { RxStateStorageOptions } from "@byeolnaerim/global-rx-state";
import { HTMLAttributes, ReactElement, ReactNode } from "react";

export type ResizePanelMode =
	| "default"
	| "bottom-cylinder"
	| "bottom-cylinder-reverse"
	| "top-cylinder"
	| "left-cylinder"
	| "right-cylinder";

export type Direction = "row" | "column";
/**
 * bulldozer : 인접한 패널을 밀어내지만, 달라붙진 않는다.
 * divorce : 인접한 패널을 밀어내고 서로 달라붙지만, 리사이즈가 시작했던 위치로 되돌아 올 때는 다시 분리된다.
 * stalker : 인접한 패널끼리 달라붙는다.
 * default : divorce
 */
export type PanelMovementMode = "bulldozer" | "divorce" | "stalker";
export type FitContent = "width" | "height";

/**
 * scrollMode
 * layout : FlexLayout = overflow : auto
 * window : FlexLayout = overflow : visible
 * default : layout
 */
export type ScrollMode = "layout" | "window";

export type FlexLayoutResizeMemoryOptions = Omit<
	RxStateStorageOptions,
	"storage"
> & {
	/**
	 * Storage engine used to persist the latest grow map for this layout.
	 *
	 * When this option is omitted from FlexLayout, resize memory is disabled.
	 */
	storage: Exclude<NonNullable<RxStateStorageOptions["storage"]>, "in-memory">;

	/**
	 * Named key used by global-rx-state.
	 *
	 * Defaults to `__flexLayoutResizeGrow:${layoutName}`.
	 */
	keyName?: string;
};

export type FlexLayoutGrowMemory = {
	getGrowMap: () => Record<string, number>;
	setGrowMap: (growMap: Record<string, number>) => void;
	ready: Promise<void>;
};

export type StickyMode = {
	position: "top" | "bottom";
	offsetPx?: number;

	/**
	 * 리사이즈 패널도 같이 sticky 동기화.
	 * default : true
	 */
	stickyResizePanel?: boolean;
};

export interface FlexLayoutChildrenType {
	isInitialResizable?: boolean;
	grow?: number;
	prevGrow?: number;
	panelMode?: ResizePanelMode;
	isFitContent?: boolean;
	isFitResize?: boolean;
	isResizePanel?: boolean;
	containerName: string;
	children: ReactNode;
	className?: string;

	/**
	 * 컨테이너 스티키 모드
	 * position: top | bottom
	 * offsetPx: sticky offset(px)
	 * zIndex: sticky z-index (default 1003)
	 * stickyResizePanel: 리사이즈 패널도 같이 sticky 처리 (default true)
	 */
	stickyMode?: StickyMode;
}

export interface FlexContainerProps extends FlexLayoutChildrenType {
	// readonly fitContent?: FitContent;
	// readonly containerCount?: number;
	// readonly layoutName?: string;
}

export interface FlexLayoutPanelStyle {
	color: string;
	hoverColor?: string;
}

export interface FlexLayoutProps extends Omit<
	HTMLAttributes<HTMLDivElement>,
	"children" | "id" | "panelClassName"
> {
	direction: Direction;
	children:
		| ReactElement<FlexLayoutChildrenType>[]
		| ReactElement<FlexLayoutChildrenType>;
	layoutName: string;
	isSplitScreen?: boolean;
	className?: string;
	panelClassName?: string;
	panelHoverClassName?: string;
	panelMovementMode?: PanelMovementMode;
	/**
	 * scrollMode
	 * layout : FlexLayout = overflow : auto
	 * window : FlexLayout = overflow : visible
	 * default : layout
	 */
	scrollMode?: ScrollMode;

	/**
	 * Persist the latest grow values for every FlexLayoutContainer in this
	 * layout.
	 *
	 * This option is layout-level because grow values are distributed across the
	 * whole FlexLayout. Remembering only one container's grow value is not enough
	 * to restore a valid split layout.
	 *
	 * When omitted, resize memory is disabled. No in-memory fallback is created.
	 */
	rememberResize?: FlexLayoutResizeMemoryOptions;
}

export type FlexLayoutResizePanelProps = {
	direction: string;
	containerCount: number;
	panelMode?: ResizePanelMode;
	containerName: string;
	layoutName: string;
	panelMovementMode: PanelMovementMode;
	panelClassName?: string;
	panelHoverClassName?: string;
	onResizingChange?: (isResizing: boolean) => void;
};

export interface FlexLayoutContextValue {
	layoutName: string;
	direction: Direction;
	panelMovementMode: PanelMovementMode;
	panelClassName?: string;
	panelHoverClassName?: string;
	containerCount: number;
	fitContent: FitContent;
	resizeMemory?: FlexLayoutGrowMemory;
}
