"use client";

import { useEffect, useState } from "react";
import { combineLatest, distinctUntilChanged, map, startWith } from "rxjs";
import { dragStateSubject, isResizingSubject } from "../hooks";

export function FlexLayoutIFramePane({
	url,
	screenKey,
}: {
	url: string;
	screenKey?: string;
}) {
	const [blockPointer, setBlockPointer] = useState(false);

	useEffect(() => {
		const draggingSubject = dragStateSubject.pipe(
			map((s) => !!s?.isDragging),
			startWith(false),
			distinctUntilChanged(),
		);

		const sub = combineLatest([draggingSubject, isResizingSubject])
			.pipe(
				map(([dragging, resizing]) => dragging || resizing),
				distinctUntilChanged(),
			)
			.subscribe(setBlockPointer);

		return () => sub.unsubscribe();
	}, []);

	return (
		<iframe
			key={screenKey}
			src={url}
			style={{
				width: "100%",
				height: "100%",
				border: 0,
				//리사이즈 및 드래깅 중 ifram이 이벤트 못먹게 방지
				pointerEvents: blockPointer ? "none" : "auto",
			}}
			sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
			referrerPolicy="no-referrer"
			loading="lazy"
		/>
	);
}
