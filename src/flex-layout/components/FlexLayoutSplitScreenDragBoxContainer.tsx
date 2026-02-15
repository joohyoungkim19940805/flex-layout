"use client";
import { HTMLAttributes } from "react";
import styles from "../styles/FlexLayout.module.css";
import FlexLayoutSplitScreenScrollBox from "./FlexLayoutSplitScreenScrollBox";
export interface FlexLayoutSplitScreenDragBoxContainerProps extends HTMLAttributes<HTMLDivElement> {
	layoutName: string;
}

export default function FlexLayoutSplitScreenDragBoxContainer({
	className,
	children,
	layoutName,
	...props
}: FlexLayoutSplitScreenDragBoxContainerProps) {
	return (
		<FlexLayoutSplitScreenScrollBox
			keyName={layoutName}
			className={`${styles["flex-split-screen-drag-box-title-container"]} ${(className && className !== "" && className) || ""}`}
			direction="x"
			{...props}
		>
			{children}
		</FlexLayoutSplitScreenScrollBox>
	);
}
