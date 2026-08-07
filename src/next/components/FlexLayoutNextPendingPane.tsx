"use client";

export interface FlexLayoutNextPendingPaneProps {
	url?: string;
	message?: string;
}

export default function FlexLayoutNextPendingPane({
	url,
	message = "Loading page...",
}: FlexLayoutNextPendingPaneProps) {
	return (
		<div
			role="status"
			aria-live="polite"
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				width: "100%",
				height: "100%",
				minHeight: "8rem",
				padding: "1rem",
				boxSizing: "border-box",
				textAlign: "center",
			}}
		>
			<div>
				<div>{message}</div>
				{url ? (
					<small style={{ overflowWrap: "anywhere" }}>{url}</small>
				) : null}
			</div>
		</div>
	);
}
