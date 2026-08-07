"use client";

import { type ReactNode, useEffect, useTransition } from "react";
import { useFlexLayoutNextContext } from "../providers/FlexLayoutNextClientProvider";
import FlexLayoutNextErrorPane from "./FlexLayoutNextErrorPane";
import FlexLayoutNextPendingPane from "./FlexLayoutNextPendingPane";

export interface FlexLayoutNextPaneProps {
	url: string;
	screenKey?: string;
	pendingComponent?: ReactNode;
	errorComponent?: ReactNode;
}

export default function FlexLayoutNextPane({
	url,
	screenKey,
	pendingComponent,
	errorComponent,
}: FlexLayoutNextPaneProps) {
	const context = useFlexLayoutNextContext();
	const [, startTransition] = useTransition();
	const requestRender = context?.requestRender;
	const releasePane = context?.releasePane;
	const pane = screenKey ? context?.panes[screenKey] : undefined;

	useEffect(() => {
		if (!requestRender || !screenKey) return;

		startTransition(() => {
			void requestRender(screenKey, url);
		});
	}, [requestRender, screenKey, startTransition, url]);

	useEffect(() => {
		if (!releasePane || !screenKey) return;

		return () => releasePane(screenKey);
	}, [releasePane, screenKey]);

	if (!context) {
		return (
			<>
				{errorComponent ?? (
					<FlexLayoutNextErrorPane
						url={url}
						message="FlexLayoutNextProvider is not mounted."
					/>
				)}
			</>
		);
	}

	if (!screenKey) {
		return (
			<>
				{errorComponent ?? (
					<FlexLayoutNextErrorPane
						url={url}
						message="FlexLayout did not assign a screen key to this pane."
					/>
				)}
			</>
		);
	}

	if (pane?.url === url && pane.status === "ready") {
		return <>{pane.content}</>;
	}

	if (pane?.url === url && pane.status === "error") {
		return (
			<>
				{errorComponent ?? (
					<FlexLayoutNextErrorPane
						url={url}
						message={pane.error}
					/>
				)}
			</>
		);
	}

	return (
		<>
			{pendingComponent ?? <FlexLayoutNextPendingPane url={url} />}
		</>
	);
}
