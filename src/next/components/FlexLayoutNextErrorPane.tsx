"use client";

export interface FlexLayoutNextErrorPaneProps {
	url?: string;
	message?: string;
}

export default function FlexLayoutNextErrorPane({
	url,
	message = "Unable to render the requested page.",
}: FlexLayoutNextErrorPaneProps) {
	return (
		<div
			role="alert"
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
