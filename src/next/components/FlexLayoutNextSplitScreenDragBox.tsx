"use client";

import type { ReactElement, ReactNode } from "react";
import CoreFlexLayoutSplitScreenDragBox, {
	type FlexLayoutSplitScreenDragBoxProps,
} from "../../flex-layout/components/FlexLayoutSplitScreenDragBox";
import FlexLayoutNextPane from "./FlexLayoutNextPane";

export interface FlexLayoutNextSplitScreenDragBoxProps<
	E extends HTMLElement = HTMLElement,
> extends Omit<
		FlexLayoutSplitScreenDragBoxProps<E>,
		"iframe" | "targetComponent" | "url"
	> {
	url: string;
	iframe?: boolean;
	targetComponent?: ReactElement;
	pendingComponent?: ReactNode;
	errorComponent?: ReactNode;
}

export default function FlexLayoutNextSplitScreenDragBox<
	E extends HTMLElement = HTMLElement,
>({
	url,
	iframe = false,
	targetComponent,
	pendingComponent,
	errorComponent,
	children,
	containerName,
	...props
}: FlexLayoutNextSplitScreenDragBoxProps<E>) {
	return (
		<CoreFlexLayoutSplitScreenDragBox
			{...props}
			url={url}
			iframe={iframe}
			containerName={containerName}
			targetComponent={
				targetComponent ??
				(iframe ? undefined : (
					<FlexLayoutNextPane
						url={url}
						pendingComponent={pendingComponent}
						errorComponent={errorComponent}
					/>
				))
			}
		>
			{children}
		</CoreFlexLayoutSplitScreenDragBox>
	);
}
