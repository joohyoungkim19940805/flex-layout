import { MouseEvent, ReactElement } from "react";
import styles from "../styles/FlexLayout.module.css";
import { FlexLayoutSplitScreenDragBoxProps } from "./FlexLayoutSplitScreenDragBox";
export interface FlexLayoutSplitScreenDragBoxItemProps {
	children: ReactElement<FlexLayoutSplitScreenDragBoxProps>;
	onClose: (event: MouseEvent<HTMLButtonElement>) => void;
	isActive: boolean;
}
export default function FlexLayoutSplitScreenDragBoxItem({
	children,
	onClose,
	isActive,
	...props
}: FlexLayoutSplitScreenDragBoxItemProps) {
	return (
		<div
			className={`${styles["flex-split-screen-drag-box-title-item"]} ${isActive ? styles["active"] : ""}`}
			{...props}
		>
			{children}
			<button
				type="button"
				onClick={(ev) => {
					ev.stopPropagation();
					onClose(ev);
				}}
			>
				X
			</button>
		</div>
	);
}
