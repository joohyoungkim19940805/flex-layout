"use client";

import {
	type IframeHTMLAttributes,
	useEffect,
	useState,
} from "react";
import { combineLatest, distinctUntilChanged, map, startWith } from "rxjs";
import { dragStateSubject, isResizingSubject } from "../hooks";

export interface FlexLayoutIFramePaneProps
	extends Omit<IframeHTMLAttributes<HTMLIFrameElement>, "src"> {
	url: string;
	screenKey?: string;
}

export function FlexLayoutIFramePane({
	url,
	screenKey,
	style,
	sandbox = "allow-same-origin allow-scripts allow-forms allow-popups",
	referrerPolicy = "no-referrer",
	loading = "lazy",
	...props
}: FlexLayoutIFramePaneProps) {
	const [blockPointer, setBlockPointer] = useState(false);

	useEffect(() => {
		const draggingSubject = dragStateSubject.pipe(
			map((state) => !!state?.isDragging),
			startWith(false),
			distinctUntilChanged(),
		);

		const subscription = combineLatest([
			draggingSubject,
			isResizingSubject,
		])
			.pipe(
				map(([dragging, resizing]) => dragging || resizing),
				distinctUntilChanged(),
			)
			.subscribe(setBlockPointer);

		return () => subscription.unsubscribe();
	}, []);

	return (
		<iframe
			{...props}
			key={screenKey}
			src={url}
			style={{
				width: "100%",
				height: "100%",
				border: 0,
				...style,
				// 리사이즈 및 드래깅 중 iframe이 이벤트를 가로채지 않게 한다.
				pointerEvents: blockPointer ? "none" : style?.pointerEvents,
			}}
			sandbox={sandbox}
			referrerPolicy={referrerPolicy}
			loading={loading}
		/>
	);
}
