"use client";

import type { ReactElement, ReactNode } from "react";
import CoreFlexLayoutSplitScreenDragBox, {
	type FlexLayoutSplitScreenDragBoxProps,
} from "../../flex-layout/components/FlexLayoutSplitScreenDragBox";
import {
	FLEX_LAYOUT_NEXT_PERSISTABLE,
	FLEX_LAYOUT_NEXT_URL,
} from "../persistence/FlexLayoutNextPersistence";
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
	customData = {},
	...props
}: FlexLayoutNextSplitScreenDragBoxProps<E>) {
	const isPersistableNextUrlPane = !targetComponent && !iframe;

	return (
		<CoreFlexLayoutSplitScreenDragBox
			{...props}
			url={url}
			iframe={iframe}
			containerName={containerName}
			customData={{
				...customData,
				...(isPersistableNextUrlPane
					? {
						[FLEX_LAYOUT_NEXT_URL]: url,
						[FLEX_LAYOUT_NEXT_PERSISTABLE]: true,
					  }
					: {}),
			}}
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
