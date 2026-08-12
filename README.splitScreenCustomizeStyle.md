# FlexLayoutSplitScreen design customization example

> Reference-only example copied from the `SiteFlexLayoutSplitScreen.tsx` used by [byeolnaerim.com](https://byeolnaerim.com).
> This example uses dependencies and project-specific utilities that are **not** dependencies of `@byeolnaerim/flex-layout` (for example MUI, MUI Icons, site i18n/theme utilities).  
> The file is documentation only and is not compiled into `dist`. Adapt the styling/dependencies to your own project.

```tsx
"use client";

import {
	FlexLayoutSplitScreen,
	type DropDocumentOutsideOption,
	type FlexLayoutSplitScreenTitleMoreMenuContext,
} from "@byeolnaerim/flex-layout";
import { createRxState } from "@byeolnaerim/global-rx-state";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CallSplitRoundedIcon from "@mui/icons-material/CallSplitRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import { Box, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import * as React from "react";
import { useTranslation } from "@/i18n/client";
function SiteSplitScreenTitle({ children }: { children?: React.ReactNode }) {
	const theme = useTheme();

	return (
		<Box
			component="span"
			sx={{
				display: "inline-flex",
				alignItems: "center",
				gap: 0.75,
				maxWidth: "100%",
				px: 1.1,
				py: 0.45,
				borderRadius: 999,
			}}
		>
			<Box
				component="span"
				sx={{
					width: 7,
					height: 7,
					flex: "0 0 auto",
					borderRadius: "50%",
					backgroundColor: "primary.main",
					boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.14)}, 0 0 14px ${alpha(theme.palette.primary.main, 0.55)}`,
				}}
			/>
			<Typography
				component="span"
				variant="caption"
				sx={{
					minWidth: 0,
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
					fontWeight: 850,
					letterSpacing: "0.035em",
					color: "text.primary",
				}}
			>
				{children}
			</Typography>
		</Box>
	);
}

function SiteSplitScreenTitleWrapper({
	children,
}: {
	children?: React.ReactNode;
}) {
	const theme = useTheme();

	return (
		<Box
			component="span"
			sx={{
				display: "inline-flex",
				alignItems: "center",
				gap: 0.35,
				maxWidth: "100%",
				p: 0.3,
				border: `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
				borderRadius: 999,
				background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.92)}, ${alpha(theme.palette.primary.main, 0.07)})`,
				boxShadow: `0 5px 16px ${alpha(theme.palette.common.black, 0.08)}`,
			}}
		>
			{children}
		</Box>
	);
}

function SiteSplitScreenDropGuide() {
	const { t } = useTranslation();
	const theme = useTheme();

	return (
		<Box
			sx={{
				minWidth: { xs: 220, sm: 300 },
				maxWidth: 420,
				p: 2.25,
				border: `1px solid ${alpha(theme.palette.primary.main, 0.52)}`,
				borderRadius: 3.5,
				background: `linear-gradient(145deg, ${alpha(theme.palette.background.paper, 0.96)}, ${alpha(theme.palette.primary.main, 0.12)} 58%, ${alpha(theme.palette.arena.logos, 0.1)})`,
				boxShadow: `0 20px 60px ${alpha(theme.palette.common.black, 0.2)}, inset 0 0 0 1px ${alpha(theme.palette.common.white, theme.palette.mode === "dark" ? 0.05 : 0.55)}`,
				backdropFilter: "blur(18px)",
			}}
		>
			<Box
				sx={{
					display: "flex",
					alignItems: "center",
					gap: 1.25,
				}}
			>
				<Box
					sx={{
						width: 42,
						height: 42,
						display: "grid",
						placeItems: "center",
						flex: "0 0 auto",
						borderRadius: 2.25,
						color: "primary.main",
						border: `1px solid ${alpha(theme.palette.primary.main, 0.28)}`,
						backgroundColor: alpha(theme.palette.primary.main, 0.1),
					}}
				>
					<CallSplitRoundedIcon fontSize="small" />
				</Box>
				<Box sx={{ minWidth: 0 }}>
					<Typography
						variant="subtitle2"
						sx={{ fontWeight: 900, letterSpacing: "-0.01em" }}
					>
						{t("Dock into workspace")}
					</Typography>
					<Typography
						variant="caption"
						sx={{
							display: "block",
							mt: 0.25,
							color: "text.secondary",
						}}
					>
						{t("Drop on an edge to create a new split view.")}
					</Typography>
				</Box>
			</Box>
			<Box
				sx={{
					mt: 1.5,
					height: 4,
					borderRadius: 999,
					background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.arena.logos}, ${theme.palette.arena.pathos})`,
					opacity: 0.72,
				}}
			/>
		</Box>
	);
}

function SiteSplitScreenCloseButton() {
	const { t } = useTranslation();
	const theme = useTheme();

	return (
		<Box
			component="button"
			type="button"
			aria-label={t("Close split screen tab")}
			sx={{
				width: 27,
				height: 27,
				display: "grid",
				placeItems: "center",
				p: 0,
				border: `1px solid ${alpha(theme.palette.arena.pathos, 0.3)}`,
				borderRadius: 999,
				color: alpha(theme.palette.arena.pathos, 0.82),
				backgroundColor: alpha(theme.palette.arena.pathos, 0.07),
				cursor: "pointer",
				transition:
					"transform .15s ease, color .15s ease, border-color .15s ease, background-color .15s ease, box-shadow .15s ease",
				"&:hover": {
					color: theme.palette.arena.pathos,
					borderColor: alpha(theme.palette.arena.pathos, 0.58),
					backgroundColor: alpha(theme.palette.arena.pathos, 0.14),
					boxShadow: `0 6px 18px ${alpha(theme.palette.arena.pathos, 0.16)}`,
					transform: "translateY(-1px) rotate(4deg)",
				},
				"&:active": { transform: "translateY(0) scale(0.92)" },
			}}
		>
			<CloseRoundedIcon sx={{ fontSize: 17 }} />
		</Box>
	);
}

function SiteSplitScreenMoreButton() {
	const { t } = useTranslation();
	const theme = useTheme();

	return (
		<Box
			component="button"
			type="button"
			aria-label={t("Open split screen actions")}
			sx={{
				width: 34,
				height: 30,
				display: "grid",
				placeItems: "center",
				p: 0,
				border: `1px solid ${alpha(theme.palette.primary.main, 0.32)}`,
				borderRadius: 999,
				color: "text.secondary",
				background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.96)}, ${alpha(theme.palette.primary.main, 0.1)})`,
				boxShadow: `0 4px 14px ${alpha(theme.palette.common.black, 0.1)}`,
				cursor: "pointer",
				transition:
					"transform .15s ease, border-color .15s ease, color .15s ease, box-shadow .15s ease",
				alignSelf: "center",
				"&:hover": {
					color: "primary.main",
					borderColor: alpha(theme.palette.primary.main, 0.58),
					boxShadow: `0 7px 20px ${alpha(theme.palette.primary.main, 0.14)}`,
					transform: "translateY(-1px)",
				},
				"&:active": { transform: "translateY(0) scale(0.96)" },
			}}
		>
			<MoreHorizRoundedIcon fontSize="small" />
		</Box>
	);
}

function SiteSplitScreenMoreMenu({
	context,
}: {
	context: FlexLayoutSplitScreenTitleMoreMenuContext;
}) {
	const { t } = useTranslation();
	const theme = useTheme();
	const [copied, setCopied] = React.useState<"title" | "link">();

	const copyText = React.useCallback(
		(value: string, type: "title" | "link") => {
			navigator.clipboard.writeText(value).then(() => {
				setCopied(type);
				window.setTimeout(() => setCopied(undefined), 1200);
			});
		},
		[],
	);

	const itemSx = {
		width: "100%",
		display: "flex",
		alignItems: "center",
		gap: 1,
		px: 1.25,
		py: 0.9,
		border: 0,
		borderRadius: 1.5,
		color: "text.primary",
		backgroundColor: "transparent",
		font: "inherit",
		fontSize: 13,
		fontWeight: 650,
		textAlign: "left",
		cursor: "pointer",
		transition:
			"background-color .15s ease, color .15s ease, opacity .15s ease",
		"&:hover": {
			color: "primary.main",
			backgroundColor: alpha(theme.palette.primary.main, 0.09),
		},
		"&:disabled": {
			cursor: "default",
			opacity: 0.38,
			color: "text.secondary",
			backgroundColor: "transparent",
		},
	} as const;

	return (
		<Box
			role="menu"
			sx={{
				minWidth: 260,
				p: 0.75,
				border: `1px solid ${alpha(theme.palette.primary.main, 0.28)}`,
				borderRadius: 2.75,
				background: `linear-gradient(145deg, ${alpha(theme.palette.background.paper, 0.98)}, ${alpha(theme.palette.primary.main, 0.075)} 62%, ${alpha(theme.palette.arena.logos, 0.055)})`,
				boxShadow: `0 24px 70px ${alpha(theme.palette.common.black, 0.24)}, inset 0 1px 0 ${alpha(theme.palette.common.white, theme.palette.mode === "dark" ? 0.06 : 0.55)}`,
				backdropFilter: "blur(18px)",
			}}
		>
			<Typography
				component="div"
				variant="caption"
				sx={{
					px: 1.25,
					pt: 0.45,
					pb: 0.65,
					color: "text.secondary",
					fontWeight: 850,
					letterSpacing: "0.07em",
					textTransform: "uppercase",
				}}
			>
				{t("Tab actions")}
			</Typography>

			<Box
				component="button"
				type="button"
				role="menuitem"
				onClick={context.closeCurrentTab}
				sx={itemSx}
			>
				{t("Close Current Tab")}
			</Box>
			<Box
				component="button"
				type="button"
				role="menuitem"
				disabled={!context.canCloseOtherTabs}
				onClick={context.closeOtherTabs}
				sx={itemSx}
			>
				{t("Close Other Tabs")}
			</Box>
			<Box
				component="button"
				type="button"
				role="menuitem"
				disabled={!context.canCloseTabsToRight}
				onClick={context.closeTabsToRight}
				sx={itemSx}
			>
				{t("Close Tabs to the Right")}
			</Box>
			<Box
				component="button"
				type="button"
				role="menuitem"
				onClick={context.closeAllTabs}
				sx={itemSx}
			>
				{t("Close All Tabs in Split")}
			</Box>
			{context.canOpenInNewWindow ? (
				<Box
					component="button"
					type="button"
					role="menuitem"
					onClick={context.openInNewWindow}
					sx={itemSx}
				>
					{t("Open in New Window")}
				</Box>
			) : null}

			<Box
				sx={{
					mx: 0.75,
					my: 0.65,
					borderTop: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
				}}
			/>

			<Box
				sx={{
					display: "flex",
					alignItems: "center",
					gap: 0.75,
					px: 1.25,
					pt: 0.35,
					pb: 0.65,
					color: "text.secondary",
				}}
			>
				<AutoAwesomeRoundedIcon
					sx={{ fontSize: 15, color: "primary.main" }}
				/>
				<Typography
					component="span"
					variant="caption"
					sx={{
						fontWeight: 850,
						letterSpacing: "0.07em",
						textTransform: "uppercase",
					}}
				>
					{t("Site actions")}
				</Typography>
			</Box>
			<Box
				component="button"
				type="button"
				role="menuitem"
				onClick={() =>
					copyText(
						context.activeItem.navigationTitle ||
							context.containerName,
						"title",
					)
				}
				sx={itemSx}
			>
				<ContentCopyRoundedIcon sx={{ fontSize: 17 }} />
				<span>
					{copied === "title" ? "Title Copied" : "Copy Tab Title"}
				</span>
			</Box>
			{context.activeItem.dropDocumentOutsideOption?.openUrl ? (
				<Box
					component="button"
					type="button"
					role="menuitem"
					onClick={() =>
						copyText(
							context.activeItem.dropDocumentOutsideOption!
								.openUrl,
							"link",
						)
					}
					sx={itemSx}
				>
					<LinkRoundedIcon sx={{ fontSize: 17 }} />
					<span>
						{copied === "link" ? "Link Copied" : "Copy Tab Link"}
					</span>
				</Box>
			) : null}
		</Box>
	);
}

export default function SiteFlexLayoutSplitScreen({
	children,
	layoutName,
	containerName,
	navigationTitle,
	dropDocumentOutsideOption,
}: {
	children: React.ReactElement;
	layoutName: string;
	containerName: string;
	navigationTitle: string;
	dropDocumentOutsideOption?: DropDocumentOutsideOption;
}) {
	const { useIsCustomizeSplitScreen } = createRxState<
		boolean,
		"isCustomizeSplitScreen"
	>(true, "isCustomizeSplitScreen", {
		storage: "auto",
	});

	const isCustomizeSplitScreen = useIsCustomizeSplitScreen();


	return (
		<FlexLayoutSplitScreen
			layoutName={layoutName}
			containerName={containerName}
			navigationTitle={navigationTitle}
			navigationTitleComponent={
				isCustomizeSplitScreen ? <SiteSplitScreenTitle /> : undefined
			}
			dropGuideComponent={
				isCustomizeSplitScreen ? <SiteSplitScreenDropGuide /> : undefined
			}
			titleWrapperComponent={
				isCustomizeSplitScreen ? <SiteSplitScreenTitleWrapper /> : undefined
			}
			titleCloseButtonComponent={
				isCustomizeSplitScreen ? <SiteSplitScreenCloseButton /> : undefined
			}
			titleMoreButtonComponent={
				isCustomizeSplitScreen ? <SiteSplitScreenMoreButton /> : undefined
			}
			renderTitleMoreMenu={
				isCustomizeSplitScreen
					? (context) => <SiteSplitScreenMoreMenu context={context} />
					: undefined
			}
			dropDocumentOutsideOption={dropDocumentOutsideOption}
			preserveStateOnUnmount
		>
			{children}
		</FlexLayoutSplitScreen>
	);
}
```
