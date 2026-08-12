import {
	cloneElement,
	MouseEvent,
	ReactElement,
	ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";
import { useDragCapture } from "../hooks/useDrag";
import styles from "../styles/FlexLayout.module.css";
import { FlexLayoutSplitScreenDragBoxProps } from "./FlexLayoutSplitScreenDragBox";

export interface FlexLayoutSplitScreenDragBoxItemProps {
	children: ReactElement<FlexLayoutSplitScreenDragBoxProps>;
	onClose: (event: MouseEvent<HTMLElement>) => void;
	isActive: boolean;
	layoutName: string;
	containerName: string;
	titleWrapperComponent?: ReactElement<{ children?: ReactNode }>;
	titleCloseButtonComponent?: ReactNode;
	onMove: (
		draggedContainerName: string,
		targetContainerName: string,
		position: "before" | "after",
	) => void;
}

export default function FlexLayoutSplitScreenDragBoxItem({
	children,
	onClose,
	isActive,
	layoutName,
	containerName,
	titleWrapperComponent,
	titleCloseButtonComponent,
	onMove,
	...props
}: FlexLayoutSplitScreenDragBoxItemProps) {
	const rootRef = useRef<HTMLDivElement>(null);
	const dragState = useDragCapture(rootRef);
	const [dragPosition, setDragPosition] = useState<"before" | "after">();
	const lastDropRef = useRef<{ position: "before" | "after" } | null>(null);

	const titleContent: ReactNode = (
		<>
			{children}
			{titleCloseButtonComponent === undefined ? (
				<button
					type="button"
					onClick={(event) => {
						event.stopPropagation();
						onClose(event);
					}}
				>
					X
				</button>
			) : titleCloseButtonComponent !== null ? (
				<span
					onClick={(event) => {
						event.stopPropagation();
						onClose(event);
					}}
				>
					{titleCloseButtonComponent}
				</span>
			) : null}
		</>
	);

	useEffect(() => {
		if (!dragState) {
			setDragPosition(undefined);
			lastDropRef.current = null;
			return;
		}

		const { customData, isDrop, isDragging, isOver, x } = dragState;
		const draggedContainerName = customData?.__flexLayoutSplitScreenTitleContainerName;
		const draggedLayoutName = customData?.__flexLayoutSplitScreenTitleLayoutName;

		if (
			typeof draggedContainerName !== "string" ||
			draggedLayoutName !== layoutName ||
			draggedContainerName === containerName ||
			!rootRef.current
		) {
			setDragPosition(undefined);
			lastDropRef.current = null;
			return;
		}

		if (isDragging && !isOver) {
			const rect = rootRef.current.getBoundingClientRect();
			const position =
				x < rect.left + rect.width / 2 ? "before" : "after";
			setDragPosition(position);
			lastDropRef.current = { position };
		}

		if (isOver) setDragPosition(undefined);

		if (isDrop && !isOver) {
			const rect = rootRef.current.getBoundingClientRect();
			const position =
				lastDropRef.current?.position ??
				(x < rect.left + rect.width / 2 ? "before" : "after");
			lastDropRef.current = null;
			setDragPosition(undefined);
			onMove(draggedContainerName, containerName, position);
		}
	}, [dragState, containerName, layoutName, onMove]);

	return (
		<div
			ref={rootRef}
			onMouseDown={(event) => event.stopPropagation()}
			className={`${styles["flex-split-screen-drag-box-title-item"]} ${isActive ? styles["active"] : ""}`}
			data-drag-position={dragPosition}
			data-flex-split-screen-title-layout-name={layoutName}
			data-flex-split-screen-title-container-name={containerName}
			{...props}
		>
		{titleWrapperComponent
			? cloneElement(titleWrapperComponent, undefined, titleContent)
			: titleContent}
		</div>
	);
}
