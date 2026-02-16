import { HTMLAttributes, ReactElement, ReactNode, Ref } from "react";

export type ResizePanelMode =
	| "default"
	| "bottom-cylinder"
	| "bottom-cylinder-reverse"
	| "top-cylinder"
	| "left-cylinder"
	| "right-cylinder";

export type Direction = "row" | "column";
export type PanelMovementMode = "bulldozer" | "divorce" | "stalker";
export type FitContent = "width" | "height";

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
}

export interface FlexContainerProps extends FlexLayoutChildrenType {
	readonly fitContent?: FitContent;
	readonly containerCount?: number;
	readonly layoutName?: string;
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
	ref?: Ref<HTMLDivElement>;
	className?: string;
	panelClassName?: string;
	panelMovementMode?: PanelMovementMode;
}

export type FlexLayoutResizePanelProps = {
	direction: string;
	containerCount: number;
	panelMode?: ResizePanelMode;
	containerName: string;
	layoutName: string;
	panelMovementMode: PanelMovementMode;
	panelClassName?: string;
};

export interface FlexLayoutContextValue {
	layoutName: string;
	direction: Direction;
	panelMovementMode: PanelMovementMode;
	panelClassName?: string;
	containerCount: number;
	fitContent: FitContent;
}
