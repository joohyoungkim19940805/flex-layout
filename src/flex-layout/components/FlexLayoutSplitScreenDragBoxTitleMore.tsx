"use client";

import {
	ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { DropTargetComponent } from "../hooks/useDrag";
import styles from "../styles/FlexLayout.module.css";

export interface FlexLayoutSplitScreenTitleMoreMenuContext {
	rootName: string;
	layoutName: string;
	containerName: string;
	screenKey: string;
	activeItem: DropTargetComponent;
	activeIndex: number;
	items: readonly DropTargetComponent[];
	closeMenu: () => void;
	closeCurrentTab: () => void;
	closeOtherTabs: () => void;
	closeTabsToRight: () => void;
	closeAllTabs: () => void;
	openInNewWindow: () => void;
	canCloseOtherTabs: boolean;
	canCloseTabsToRight: boolean;
	canOpenInNewWindow: boolean;
}

export type FlexLayoutSplitScreenTitleMoreRenderer = (
	context: FlexLayoutSplitScreenTitleMoreMenuContext,
) => ReactNode;

export interface FlexLayoutSplitScreenDragBoxTitleMoreProps {
	rootName: string;
	layoutName: string;
	containerName: string;
	screenKey: string;
	activeItem: DropTargetComponent;
	activeIndex: number;
	items: readonly DropTargetComponent[];
	onCloseCurrentTab: () => void;
	onCloseOtherTabs: () => void;
	onCloseTabsToRight: () => void;
	onCloseAllTabs: () => void;
	titleMoreButtonComponent?: ReactNode;
	renderTitleMoreMenu?: FlexLayoutSplitScreenTitleMoreRenderer;
	renderTitleMoreMenuItems?: FlexLayoutSplitScreenTitleMoreRenderer;
}

export default function FlexLayoutSplitScreenDragBoxTitleMore({
	rootName,
	layoutName,
	containerName,
	screenKey,
	activeItem,
	activeIndex,
	items,
	onCloseCurrentTab,
	onCloseOtherTabs,
	onCloseTabsToRight,
	onCloseAllTabs,
	titleMoreButtonComponent,
	renderTitleMoreMenu,
	renderTitleMoreMenuItems,
}: FlexLayoutSplitScreenDragBoxTitleMoreProps) {
	const triggerRef = useRef<HTMLSpanElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const [isOpen, setIsOpen] = useState(false);
	const [position, setPosition] = useState<{ top: number; left: number }>();

	const closeMenu = useCallback(() => setIsOpen(false), []);
	const updatePosition = useCallback(() => {
		if (!triggerRef.current || !menuRef.current) return;

		const triggerRect = triggerRef.current.getBoundingClientRect();
		const menuRect = menuRef.current.getBoundingClientRect();
		const margin = 8;
		const top =
			triggerRect.top - menuRect.height > margin
				? triggerRect.top - menuRect.height
				: triggerRect.bottom;
		const left =
			triggerRect.left - menuRect.width > margin
				? triggerRect.left - menuRect.width
				: triggerRect.right;

		setPosition({
			top: Math.max(
				margin,
				Math.min(top, window.innerHeight - menuRect.height - margin),
			),
			left: Math.max(
				margin,
				Math.min(left, window.innerWidth - menuRect.width - margin),
			),
		});
	}, []);

	useEffect(() => {
		if (!isOpen) {
			setPosition(undefined);
			return;
		}
		updatePosition();
	}, [isOpen, updatePosition]);

	useEffect(() => {
		if (!isOpen) return;

		const handleOutsidePointerDown = (event: PointerEvent) => {
			const target = event.target as Node | null;
			if (
				target &&
				!triggerRef.current?.contains(target) &&
				!menuRef.current?.contains(target)
			) {
				closeMenu();
			}
		};
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") closeMenu();
		};

		document.addEventListener("pointerdown", handleOutsidePointerDown, true);
		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("resize", updatePosition);
		window.addEventListener("scroll", updatePosition, true);

		return () => {
			document.removeEventListener(
				"pointerdown",
				handleOutsidePointerDown,
				true,
			);
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("resize", updatePosition);
			window.removeEventListener("scroll", updatePosition, true);
		};
	}, [closeMenu, isOpen, updatePosition]);

	if (titleMoreButtonComponent === null) return null;

	const openInNewWindow = () => {
		const option = activeItem.dropDocumentOutsideOption;
		if (!option?.openUrl) return;

		if (
			option.isNewTap ||
			(!option.widthRatio && !option.heightRatio)
		) {
			window.open(option.openUrl, "_blank");
			return;
		}

		const width = window.innerWidth * (option.widthRatio || 1);
		const height = window.innerHeight * (option.heightRatio || 1);
		window.open(
			option.openUrl,
			"_blank",
			`width=${width},height=${height},left=${window.screenLeft + (window.innerWidth - width) / 2},top=${window.screenTop + (window.innerHeight - height) / 2}`,
		);
	};
	const context: FlexLayoutSplitScreenTitleMoreMenuContext = {
		rootName,
		layoutName,
		containerName,
		screenKey,
		activeItem,
		activeIndex,
		items,
		closeMenu,
		closeCurrentTab: () => {
			onCloseCurrentTab();
			closeMenu();
		},
		closeOtherTabs: () => {
			onCloseOtherTabs();
			closeMenu();
		},
		closeTabsToRight: () => {
			onCloseTabsToRight();
			closeMenu();
		},
		closeAllTabs: () => {
			onCloseAllTabs();
			closeMenu();
		},
		openInNewWindow: () => {
			openInNewWindow();
			closeMenu();
		},
		canCloseOtherTabs: items.length > 1,
		canCloseTabsToRight: activeIndex < items.length - 1,
		canOpenInNewWindow: !!activeItem.dropDocumentOutsideOption?.openUrl,
	};

	return (
		<>
			<span
				ref={triggerRef}
				className={styles["flex-split-screen-drag-box-title-more-anchor"]}
				onClick={(event) => {
					event.stopPropagation();
					setIsOpen((prev) => !prev);
				}}
			>
				{titleMoreButtonComponent === undefined ? (
					<button
						type="button"
						aria-haspopup="menu"
						aria-expanded={isOpen}
						className={styles["flex-split-screen-drag-box-title-more"]}
					>
						<span>.</span>
						<span>.</span>
						<span>.</span>
					</button>
				) : (
					titleMoreButtonComponent
				)}
			</span>

			{isOpen && typeof document !== "undefined"
				? createPortal(
						<div
							ref={menuRef}
							className={
								styles[
									"flex-split-screen-drag-box-title-more-menu-positioner"
								]
							}
							style={{
								top: position?.top ?? 0,
								left: position?.left ?? 0,
								visibility: position ? "visible" : "hidden",
							}}
						>
							{renderTitleMoreMenu ? (
								renderTitleMoreMenu(context)
							) : (
								<div
									role="menu"
									className={
										styles[
											"flex-split-screen-drag-box-title-more-menu"
										]
									}
								>
									<button type="button" role="menuitem" onClick={context.closeCurrentTab}>
										현재 탭 닫기
									</button>
									<button
										type="button"
										role="menuitem"
										disabled={!context.canCloseOtherTabs}
										onClick={context.closeOtherTabs}
									>
										다른 탭 모두 닫기
									</button>
									<button
										type="button"
										role="menuitem"
										disabled={!context.canCloseTabsToRight}
										onClick={context.closeTabsToRight}
									>
										오른쪽 탭 모두 닫기
									</button>
									<button type="button" role="menuitem" onClick={context.closeAllTabs}>
										현재 분할의 탭 모두 닫기
									</button>
									{context.canOpenInNewWindow ? (
										<>
											<div
												className={
													styles[
														"flex-split-screen-drag-box-title-more-menu-divider"
													]
												}
											/>
											<button
												type="button"
												role="menuitem"
												onClick={context.openInNewWindow}
											>
												새 창에서 열기
											</button>
										</>
									) : null}
									{renderTitleMoreMenuItems ? (
										<>
											<div
												className={
													styles[
														"flex-split-screen-drag-box-title-more-menu-divider"
													]
												}
											/>
											{renderTitleMoreMenuItems(context)}
										</>
									) : null}
								</div>
							)}
						</div>,
						document.body,
					)
				: null}
		</>
	);
}
