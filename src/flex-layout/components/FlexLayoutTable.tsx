"use client";

import {
	ComponentType,
	CSSProperties,
	MouseEvent as ReactMouseEvent,
	ReactNode,
	TouchEvent as ReactTouchEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { OnReachTerminalType, useListPagingForSentinel } from "../hooks";
import {
	getContainerRef,
	getResizePanelRef,
} from "../store/FlexLayoutContainerStore";
import styles from "../styles/FlexLayout.module.css";
import {
	Direction,
	PanelMovementMode,
	ScrollMode,
} from "../types/FlexLayoutTypes";
import {
	FlexLayoutTableCellValue,
	getHorizontalBoxExtra,
	getInitialNumberArray,
	isSameNumberArray,
	measureTextRangeRect,
	toCssPx,
} from "../utils/FlexLayoutTableUtils";
import FlexLayout from "./FlexLayout";
import FlexLayoutContainer from "./FlexLayoutContainer";

const cx = (...classNames: Array<string | false | null | undefined>) =>
	classNames.filter(Boolean).join(" ");

export type FlexLayoutTableHeader = {
	headerKey: string;
	title: ReactNode;
	grow?: number;
};

export interface FlexLayoutTableBodyCell extends FlexLayoutTableCellValue {}

export type FlexLayoutTableBodyItem = {
	id: string;
	data: Record<string, FlexLayoutTableBodyCell>;
};

export type FlexLayoutTableScrollMode =
	| "x"
	| "y"
	| "xy"
	| "auto"
	| "window"
	| "visible"
	| ScrollMode;

export type FlexLayoutTableProps = {
	layoutName: string;
	direction?: Direction;
	headers: FlexLayoutTableHeader[];
	body?: FlexLayoutTableBodyItem[];
	customBodyComponent?: ComponentType<{ children: ReactNode }>;
	children?: ReactNode;
	onReachTerminal?: (onReachTerminalData: OnReachTerminalType) => void;
	scroll?: FlexLayoutTableScrollMode;
	panelMovementMode?: PanelMovementMode;
	resizePanelClassName?: string;
	resizePanelLineClassName?: string;
	resizePanelHoverClassName?: string;
	wrapperClassName?: string;
	tableClassName?: string;
	tableAreaClassName?: string;
	headerCellClassName?: string;
	contentCellClassName?: string;
	wrapperStyle?: CSSProperties;
	tableStyle?: CSSProperties;
	tableAreaStyle?: CSSProperties;
	headerCellStyle?: CSSProperties;
	contentCellStyle?: CSSProperties;
	rowResize?: boolean;
	rowHeight?: number;
	stickyHeader?: boolean;
	stickyTop?: number;
};

const TABLE_COLUMN_RESIZE_PANEL_CLASS = "flex-layout-table-column-resize-panel";
const TABLE_ROW_RESIZE_PANEL_CLASS = "flex-layout-table-row-resize-panel";
const TABLE_RESIZE_PANEL_ACTIVE_CLASS = "flex-layout-table-resize-panel-active";
const TABLE_RESIZE_PANEL_CORE_CLASS = "flex-layout-table-resize-panel-core";
const TABLE_RESIZE_PANEL_HOVER_CLASS = "flex-layout-table-resize-panel-hover";
const HEADER_COLUMN_RESIZE_PANEL_CLASS =
	styles["flex-layout-table-header-column-resize-panel"];

const getParentOverflowStyle = (
	scroll: FlexLayoutTableScrollMode,
): CSSProperties => {
	switch (scroll) {
		case "y":
			return { overflowY: "auto" };
		case "x":
			return { overflowX: "auto" };
		case "xy":
		case "layout":
		case "auto":
			return { overflow: "auto" };
		case "window":
		case "visible":
		default:
			return { overflow: "visible" };
	}
};

const getFlexScrollMode = (scroll: FlexLayoutTableScrollMode): ScrollMode =>
	scroll === "window" || scroll === "visible" ? "window" : "layout";

export default function FlexLayoutTable({
	layoutName,
	direction = "row",
	headers,
	body = [],
	customBodyComponent,
	children,
	onReachTerminal,
	scroll = "window",
	panelMovementMode = "bulldozer",
	resizePanelClassName,
	resizePanelLineClassName,
	resizePanelHoverClassName,
	wrapperClassName,
	tableClassName,
	tableAreaClassName,
	headerCellClassName,
	contentCellClassName,
	wrapperStyle,
	tableStyle,
	tableAreaStyle,
	headerCellStyle,
	contentCellStyle,
	rowResize = true,
	rowHeight = 56,
	stickyHeader = true,
	stickyTop = 0,
}: FlexLayoutTableProps) {
	const tableRef = useRef<HTMLDivElement | null>(null);
	const tableAreaRef = useRef<HTMLDivElement | null>(null);
	const columnResizePanelSourceRefs = useRef<
		Record<number, HTMLElement | null>
	>({});
	const columnResizePanelOverlayRefs = useRef<
		Record<number, HTMLDivElement | null>
	>({});
	const columnBoundaryRafIdRef = useRef<number | null>(null);
	const rowBoundarySourceRefs = useRef<Record<number, HTMLDivElement | null>>(
		{},
	);
	const rowResizePanelRefs = useRef<Record<number, HTMLDivElement | null>>(
		{},
	);
	const rowBoundaryRafIdRef = useRef<number | null>(null);
	const rowHeightsRef = useRef<number[]>(
		getInitialNumberArray(body.length, rowHeight),
	);
	const rowMinHeightsRef = useRef<number[]>(
		getInitialNumberArray(body.length, 1),
	);

	const [columnBoundaryLefts, setColumnBoundaryLefts] = useState<number[]>(
		[],
	);
	const [rowBoundaryTops, setRowBoundaryTops] = useState<number[]>([]);
	const [rowHeights, setRowHeights] = useState<number[]>(() =>
		getInitialNumberArray(body.length, rowHeight),
	);
	const [rowMinHeights, setRowMinHeights] = useState<number[]>(() =>
		getInitialNumberArray(body.length, 1),
	);

	const { firstChildRef, lastChildRef } = useListPagingForSentinel({
		onReachTerminal,
	});

	useEffect(() => {
		setRowMinHeights((prev) => {
			const next = getInitialNumberArray(body.length, 1).map(
				(value, index) => prev[index] ?? value,
			);
			rowMinHeightsRef.current = next;
			return isSameNumberArray(prev, next) ? prev : next;
		});

		setRowHeights((prev) => {
			const next = getInitialNumberArray(body.length, rowHeight).map(
				(value, index) => Math.max(prev[index] ?? value, value),
			);
			rowHeightsRef.current = next;
			return isSameNumberArray(prev, next) ? prev : next;
		});
	}, [body.length, rowHeight]);

	const setRowMinHeight = useCallback(
		(rowIndex: number, minHeight: number) => {
			const nextMinHeight = Math.ceil(Math.max(1, minHeight));

			setRowMinHeights((prev) => {
				if (nextMinHeight === prev[rowIndex]) return prev;
				const next = [...prev];
				next[rowIndex] = nextMinHeight;
				rowMinHeightsRef.current = next;
				return next;
			});

			setRowHeights((prev) => {
				if (nextMinHeight <= (prev[rowIndex] ?? rowHeight)) return prev;
				const next = [...prev];
				next[rowIndex] = nextMinHeight;
				rowHeightsRef.current = next;
				return next;
			});
		},
		[rowHeight],
	);

	const syncColumnOverlayStyle = useCallback((columnIndex: number) => {
		const sourcePanelEl = columnResizePanelSourceRefs.current[columnIndex];
		const overlayPanelEl =
			columnResizePanelOverlayRefs.current[columnIndex];
		if (!sourcePanelEl || !overlayPanelEl) return;

		const sourceStyle = window.getComputedStyle(sourcePanelEl);
		const sourceHoverEl =
			sourcePanelEl.querySelector<HTMLElement>(".hover");
		const hoverStyle = sourceHoverEl
			? window.getComputedStyle(sourceHoverEl)
			: null;

		overlayPanelEl.style.setProperty(
			"--flex-layout-table-resize-z-index",
			sourceStyle.zIndex || "11",
		);
		overlayPanelEl.style.setProperty(
			"--flex-layout-table-resize-hover-bg",
			hoverStyle?.backgroundColor &&
				hoverStyle.backgroundColor !== "rgba(0, 0, 0, 0)"
				? hoverStyle.backgroundColor
				: "#0066ffb5",
		);
	}, []);

	const updateColumnBoundaryLefts = useCallback(
		(commitState = true) => {
			const tableAreaEl = tableAreaRef.current;
			if (!tableAreaEl) return;

			const tableAreaLeft = tableAreaEl.getBoundingClientRect().left;
			const nextLefts = headers.slice(0, -1).map((_, columnIndex) => {
				const sourcePanelEl =
					columnResizePanelSourceRefs.current[columnIndex];
				if (!sourcePanelEl) return 0;

				const panelRect = sourcePanelEl.getBoundingClientRect();
				return Math.round(
					panelRect.left + panelRect.width / 2 - tableAreaLeft,
				);
			});

			nextLefts.forEach((left, columnIndex) => {
				const overlayPanelEl =
					columnResizePanelOverlayRefs.current[columnIndex];
				if (!overlayPanelEl || !left) return;
				overlayPanelEl.style.left = toCssPx(left);
				syncColumnOverlayStyle(columnIndex);
			});

			if (!commitState) return;

			setColumnBoundaryLefts((prev) =>
				isSameNumberArray(prev, nextLefts) ? prev : nextLefts,
			);
		},
		[headers, syncColumnOverlayStyle],
	);

	const scheduleUpdateColumnBoundaryLefts = useCallback(() => {
		if (typeof window === "undefined") return;

		if (columnBoundaryRafIdRef.current !== null) {
			cancelAnimationFrame(columnBoundaryRafIdRef.current);
		}

		columnBoundaryRafIdRef.current = requestAnimationFrame(() => {
			columnBoundaryRafIdRef.current = null;
			updateColumnBoundaryLefts();
		});
	}, [updateColumnBoundaryLefts]);

	const updateRowBoundaryTops = useCallback(
		(commitState = true) => {
			const tableAreaEl = tableAreaRef.current;
			if (!tableAreaEl) return;

			const tableAreaTop = tableAreaEl.getBoundingClientRect().top;
			const nextTops = getInitialNumberArray(body.length, 0).map(
				(_, rowIndex) => {
					const rowEl = rowBoundarySourceRefs.current[rowIndex];
					if (!rowEl) return 0;
					return Math.round(
						rowEl.getBoundingClientRect().bottom - tableAreaTop,
					);
				},
			);

			nextTops.forEach((top, rowIndex) => {
				const panelEl = rowResizePanelRefs.current[rowIndex];
				if (!panelEl || !top) return;
				panelEl.style.top = toCssPx(top);
			});

			if (!commitState) return;

			setRowBoundaryTops((prev) =>
				isSameNumberArray(prev, nextTops) ? prev : nextTops,
			);
		},
		[body.length],
	);

	const scheduleUpdateRowBoundaryTops = useCallback(() => {
		if (typeof window === "undefined") return;

		if (rowBoundaryRafIdRef.current !== null) {
			cancelAnimationFrame(rowBoundaryRafIdRef.current);
		}

		rowBoundaryRafIdRef.current = requestAnimationFrame(() => {
			rowBoundaryRafIdRef.current = null;
			updateRowBoundaryTops();
		});
	}, [updateRowBoundaryTops]);

	useEffect(() => {
		const subscriptions = headers.slice(0, -1).map((header, columnIndex) =>
			getResizePanelRef({
				layoutName,
				containerName: layoutName + header.headerKey,
			}).subscribe((resizePanel) => {
				columnResizePanelSourceRefs.current[columnIndex] =
					resizePanel?.current ?? null;
				scheduleUpdateColumnBoundaryLefts();
			}),
		);

		return () => {
			subscriptions.forEach((subscription) => subscription.unsubscribe());
		};
	}, [headers, layoutName, scheduleUpdateColumnBoundaryLefts]);

	useLayoutEffect(() => {
		scheduleUpdateColumnBoundaryLefts();
		scheduleUpdateRowBoundaryTops();

		if (typeof ResizeObserver === "undefined") return;

		const observer = new ResizeObserver(() => {
			scheduleUpdateColumnBoundaryLefts();
			scheduleUpdateRowBoundaryTops();
		});

		if (tableRef.current) observer.observe(tableRef.current);
		if (tableAreaRef.current) observer.observe(tableAreaRef.current);

		Object.values(columnResizePanelSourceRefs.current).forEach(
			(panelEl) => {
				if (panelEl) observer.observe(panelEl);
			},
		);

		Object.values(rowBoundarySourceRefs.current).forEach((rowEl) => {
			if (rowEl) observer.observe(rowEl);
		});

		window.addEventListener(
			"scroll",
			scheduleUpdateColumnBoundaryLefts,
			true,
		);
		window.addEventListener("scroll", scheduleUpdateRowBoundaryTops, true);
		window.addEventListener("resize", scheduleUpdateColumnBoundaryLefts);
		window.addEventListener("resize", scheduleUpdateRowBoundaryTops);

		return () => {
			observer.disconnect();
			if (columnBoundaryRafIdRef.current !== null) {
				cancelAnimationFrame(columnBoundaryRafIdRef.current);
				columnBoundaryRafIdRef.current = null;
			}
			if (rowBoundaryRafIdRef.current !== null) {
				cancelAnimationFrame(rowBoundaryRafIdRef.current);
				rowBoundaryRafIdRef.current = null;
			}
			window.removeEventListener(
				"scroll",
				scheduleUpdateColumnBoundaryLefts,
				true,
			);
			window.removeEventListener(
				"scroll",
				scheduleUpdateRowBoundaryTops,
				true,
			);
			window.removeEventListener(
				"resize",
				scheduleUpdateColumnBoundaryLefts,
			);
			window.removeEventListener("resize", scheduleUpdateRowBoundaryTops);
		};
	}, [
		scheduleUpdateColumnBoundaryLefts,
		scheduleUpdateRowBoundaryTops,
		rowHeights,
		rowMinHeights,
		headers.length,
	]);

	const handleRowBoundarySourceRef = useCallback(
		(rowIndex: number) => (node: HTMLDivElement | null) => {
			if (rowBoundarySourceRefs.current[rowIndex] === node) return;
			rowBoundarySourceRefs.current[rowIndex] = node;
			scheduleUpdateRowBoundaryTops();
		},
		[scheduleUpdateRowBoundaryTops],
	);

	const applyRowHeightToDom = useCallback(
		(rowIndex: number, height: number) => {
			const tableEl = tableRef.current;
			if (!tableEl) return;

			tableEl
				.querySelectorAll<HTMLElement>(
					`[data-flex-layout-table-row-index="${rowIndex}"]`,
				)
				.forEach((rowEl) => {
					rowEl.style.height = toCssPx(height);
					rowEl.style.minHeight = toCssPx(height);
				});

			updateRowBoundaryTops(false);
		},
		[updateRowBoundaryTops],
	);

	const handleRowResizeStart = useCallback(
		(
			rowIndex: number,
			event:
				| ReactMouseEvent<HTMLDivElement>
				| ReactTouchEvent<HTMLDivElement>,
		) => {
			if (!rowResize) return;

			event.preventDefault();
			event.stopPropagation();

			const startY =
				"touches" in event ? event.touches[0]?.clientY : event.clientY;
			if (typeof startY !== "number") return;

			const startHeight = rowHeightsRef.current[rowIndex] ?? rowHeight;
			const minHeight = rowMinHeightsRef.current[rowIndex] ?? 1;
			const previousCursor = document.body.style.cursor;
			const previousUserSelect = document.body.style.userSelect;
			let latestHeight = startHeight;
			let rafId: number | null = null;
			const activePanelEl = rowResizePanelRefs.current[rowIndex];

			activePanelEl?.classList.add(
				styles[TABLE_RESIZE_PANEL_ACTIVE_CLASS],
			);
			document.body.style.cursor = "ns-resize";
			document.body.style.userSelect = "none";

			const applyLatestHeight = () => {
				rafId = null;
				rowHeightsRef.current[rowIndex] = latestHeight;
				applyRowHeightToDom(rowIndex, latestHeight);
			};

			const move = (moveEvent: MouseEvent | TouchEvent) => {
				moveEvent.preventDefault();

				const clientY =
					moveEvent instanceof TouchEvent
						? moveEvent.touches[0]?.clientY
						: moveEvent.clientY;
				if (typeof clientY !== "number") return;

				latestHeight = Math.max(
					minHeight,
					startHeight + clientY - startY,
				);

				if (rafId !== null) return;
				rafId = requestAnimationFrame(applyLatestHeight);
			};

			const end = () => {
				if (rafId !== null) {
					cancelAnimationFrame(rafId);
					rafId = null;
					rowHeightsRef.current[rowIndex] = latestHeight;
					applyRowHeightToDom(rowIndex, latestHeight);
				}

				setRowHeights((prev) => {
					if (latestHeight === prev[rowIndex]) return prev;
					const next = [...prev];
					next[rowIndex] = latestHeight;
					rowHeightsRef.current = next;
					return next;
				});

				activePanelEl?.classList.remove(
					styles[TABLE_RESIZE_PANEL_ACTIVE_CLASS],
				);
				document.body.style.cursor = previousCursor;
				document.body.style.userSelect = previousUserSelect;
				window.removeEventListener("mousemove", move);
				window.removeEventListener("mouseup", end);
				window.removeEventListener("touchmove", move);
				window.removeEventListener("touchend", end);
				window.removeEventListener("touchcancel", end);
			};

			window.addEventListener("mousemove", move);
			window.addEventListener("mouseup", end);
			window.addEventListener("touchmove", move, { passive: false });
			window.addEventListener("touchend", end);
			window.addEventListener("touchcancel", end);
		},
		[applyRowHeightToDom, rowHeight, rowResize],
	);

	const handleColumnResizeStart = useCallback(
		(
			columnIndex: number,
			event:
				| ReactMouseEvent<HTMLDivElement>
				| ReactTouchEvent<HTMLDivElement>,
		) => {
			const sourcePanelEl =
				columnResizePanelSourceRefs.current[columnIndex];
			if (!sourcePanelEl) return;

			event.preventDefault();
			event.stopPropagation();

			const isTouchEvent = "touches" in event;
			const clientX = isTouchEvent
				? event.touches[0]?.clientX
				: event.clientX;
			const clientY = isTouchEvent
				? event.touches[0]?.clientY
				: event.clientY;
			if (typeof clientX !== "number" || typeof clientY !== "number")
				return;

			const activePanelEl =
				columnResizePanelOverlayRefs.current[columnIndex];
			activePanelEl?.classList.add(
				styles[TABLE_RESIZE_PANEL_ACTIVE_CLASS],
			);

			const syncColumnBoundary = () => updateColumnBoundaryLefts(false);
			const stopSyncColumnBoundary = () => {
				activePanelEl?.classList.remove(
					styles[TABLE_RESIZE_PANEL_ACTIVE_CLASS],
				);
				updateColumnBoundaryLefts();
				window.removeEventListener("mousemove", syncColumnBoundary);
				window.removeEventListener("mouseup", stopSyncColumnBoundary);
				window.removeEventListener("touchmove", syncColumnBoundary);
				window.removeEventListener("touchend", stopSyncColumnBoundary);
				window.removeEventListener(
					"touchcancel",
					stopSyncColumnBoundary,
				);
			};

			window.addEventListener("mousemove", syncColumnBoundary);
			window.addEventListener("mouseup", stopSyncColumnBoundary);
			window.addEventListener("touchmove", syncColumnBoundary, {
				passive: true,
			});
			window.addEventListener("touchend", stopSyncColumnBoundary);
			window.addEventListener("touchcancel", stopSyncColumnBoundary);

			if (isTouchEvent) {
				try {
					sourcePanelEl.dispatchEvent(
						new TouchEvent("touchstart", {
							bubbles: true,
							cancelable: true,
							touches: Array.from(
								event.touches,
							) as unknown as Touch[],
							targetTouches: Array.from(
								event.targetTouches,
							) as unknown as Touch[],
							changedTouches: Array.from(
								event.changedTouches,
							) as unknown as Touch[],
						}),
					);
				} catch {
					stopSyncColumnBoundary();
				}
				return;
			}

			sourcePanelEl.dispatchEvent(
				new MouseEvent("mousedown", {
					bubbles: true,
					cancelable: true,
					clientX,
					clientY,
					screenX: event.screenX,
					screenY: event.screenY,
					button: 0,
					buttons: 1,
				}),
			);
		},
		[updateColumnBoundaryLefts],
	);

	return (
		<div
			className={cx(
				styles["flex-layout-table-wrapper"],
				wrapperClassName,
			)}
			style={{ ...getParentOverflowStyle(scroll), ...wrapperStyle }}
		>
			<div
				ref={tableRef}
				className={cx(styles["flex-layout-table"], tableClassName)}
				style={tableStyle}
			>
				<div
					className={styles["flex-layout-table-sentinel"]}
					ref={firstChildRef as (node: HTMLDivElement | null) => void}
				/>

				<div
					ref={tableAreaRef}
					className={cx(
						styles["flex-layout-table-area"],
						tableAreaClassName,
					)}
					style={tableAreaStyle}
				>
					<FlexLayout
						layoutName={layoutName}
						direction={direction}
						className=""
						panelClassName={cx(
							resizePanelClassName,
							resizePanelLineClassName,
						)}
						panelHoverClassName={resizePanelHoverClassName}
						panelMovementMode={panelMovementMode}
						scrollMode={getFlexScrollMode(scroll)}
					>
						{headers.map((header, headerIndex) => (
							<FlexLayoutContainer
								key={layoutName + header.headerKey}
								isResizePanel={headerIndex < headers.length - 1}
								{...(header.grow ? { grow: header.grow } : {})}
								containerName={layoutName + header.headerKey}
								className=""
							>
								<div
									className={
										styles["flex-layout-table-column"]
									}
								>
									<FlexLayoutTableHeaderCell
										title={header.title}
										headerKey={header.headerKey}
										layoutName={layoutName}
										className={headerCellClassName}
										style={headerCellStyle}
										stickyHeader={stickyHeader}
										stickyTop={stickyTop}
									/>

									{body.map(({ id, data }, rowIndex) => (
										<FlexLayoutTableCell
											key={`${header.headerKey}_${id}_${rowIndex}`}
											id={id}
											headerKey={header.headerKey}
											rowIndex={rowIndex}
											rowHeight={
												rowHeights[rowIndex] ??
												rowHeight
											}
											content={data[header.headerKey]}
											customBodyComponent={
												customBodyComponent
											}
											className={contentCellClassName}
											style={contentCellStyle}
											onRowMinHeightChange={
												setRowMinHeight
											}
											rowBoundarySourceRef={
												headerIndex === 0
													? handleRowBoundarySourceRef(
															rowIndex,
														)
													: undefined
											}
										/>
									))}
								</div>
							</FlexLayoutContainer>
						))}
					</FlexLayout>

					{headers.slice(0, -1).map((header, columnIndex) => {
						const left = columnBoundaryLefts[columnIndex];
						if (!left) return null;

						return (
							<div
								key={`${header.headerKey}_${columnIndex}_column_resize_panel`}
								ref={(node) => {
									columnResizePanelOverlayRefs.current[
										columnIndex
									] = node;
								}}
								className={cx(
									styles[
										"flex-layout-table-column-resize-panel"
									],
									styles[
										"flex-layout-table-header-column-resize-panel"
									],
									resizePanelClassName,
								)}
								style={{ left: `${left}px` }}
								onMouseDown={(event) =>
									handleColumnResizeStart(columnIndex, event)
								}
								onTouchStart={(event) =>
									handleColumnResizeStart(columnIndex, event)
								}
							>
								<div
									className={cx(
										styles[
											"flex-layout-table-resize-panel-core"
										],
										resizePanelLineClassName,
									)}
								>
									<div
										className={cx(
											styles[
												"flex-layout-table-resize-panel-hover"
											],
											resizePanelHoverClassName,
										)}
									/>
								</div>
							</div>
						);
					})}

					{rowResize &&
						body.slice(0, -1).map((row, rowIndex) => {
							const top = rowBoundaryTops[rowIndex];
							if (!top) return null;

							return (
								<div
									key={`${row.id}_${rowIndex}_row_resize_panel`}
									ref={(node) => {
										rowResizePanelRefs.current[rowIndex] =
											node;
									}}
									className={cx(
										styles[TABLE_ROW_RESIZE_PANEL_CLASS],
										resizePanelClassName,
									)}
									style={{ top: toCssPx(top) }}
									onMouseDown={(event) =>
										handleRowResizeStart(rowIndex, event)
									}
									onTouchStart={(event) =>
										handleRowResizeStart(rowIndex, event)
									}
								>
									<div
										className={cx(
											styles[
												TABLE_RESIZE_PANEL_CORE_CLASS
											],
											resizePanelLineClassName,
										)}
									>
										<div
											className={cx(
												styles[
													TABLE_RESIZE_PANEL_HOVER_CLASS
												],
												resizePanelHoverClassName,
											)}
										/>
									</div>
								</div>
							);
						})}
				</div>

				<div
					className={styles["flex-layout-table-sentinel"]}
					ref={lastChildRef as (node: HTMLDivElement | null) => void}
				/>
			</div>

			{children}
		</div>
	);
}

type FlexLayoutTableHeaderCellProps = {
	title: ReactNode;
	headerKey: string;
	layoutName: string;
	className?: string;
	style?: CSSProperties;
	stickyHeader: boolean;
	stickyTop: number;
};

function FlexLayoutTableHeaderCell({
	title,
	headerKey,
	layoutName,
	className,
	style,
	stickyHeader,
	stickyTop,
}: FlexLayoutTableHeaderCellProps) {
	const titleWrapperRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!titleWrapperRef.current) return;

		const containerSubscribe = getContainerRef({
			layoutName,
			containerName: layoutName + headerKey,
		}).subscribe((container) => {
			if (!container?.current || !titleWrapperRef.current) return;

			const rect = measureTextRangeRect(titleWrapperRef.current);
			if (!rect) return;

			container.current.style.minWidth = toCssPx(
				rect.width + getHorizontalBoxExtra(titleWrapperRef.current),
			);
		});

		return () => containerSubscribe.unsubscribe();
	}, [headerKey, layoutName]);

	return (
		<div
			ref={titleWrapperRef}
			className={cx(styles["flex-layout-table-header-cell"], className)}
			style={{
				position: stickyHeader ? "sticky" : "relative",
				top: stickyHeader ? stickyTop : undefined,
				...style,
			}}
		>
			{title}
		</div>
	);
}

type FlexLayoutTableCellProps = {
	id: string;
	headerKey: string;
	rowIndex: number;
	rowHeight: number;
	content?: FlexLayoutTableBodyCell;
	customBodyComponent?: ComponentType<{ children: ReactNode }>;
	className?: string;
	style?: CSSProperties;
	onRowMinHeightChange: (rowIndex: number, minHeight: number) => void;
	rowBoundarySourceRef?: (node: HTMLDivElement | null) => void;
};

function FlexLayoutTableCell({
	id,
	headerKey,
	rowIndex,
	rowHeight,
	content,
	customBodyComponent: CustomBodyComponent,
	className,
	style,
	onRowMinHeightChange,
	rowBoundarySourceRef,
}: FlexLayoutTableCellProps) {
	const contentRef = useRef<HTMLDivElement | null>(null);
	const contentInnerRef = useRef<HTMLDivElement | null>(null);

	useLayoutEffect(() => {
		const element = contentInnerRef.current;
		if (!element) return;

		let rafId = 0;

		const measure = () => {
			if (rafId) cancelAnimationFrame(rafId);

			rafId = requestAnimationFrame(() => {
				const rect = measureTextRangeRect(element);
				onRowMinHeightChange(
					rowIndex,
					rect ? Math.ceil(rect.height) : 1,
				);
			});
		};

		measure();

		const resizeObserver =
			typeof ResizeObserver !== "undefined"
				? new ResizeObserver(measure)
				: null;

		resizeObserver?.observe(element);

		return () => {
			if (rafId) cancelAnimationFrame(rafId);
			resizeObserver?.disconnect();
		};
	}, [content, onRowMinHeightChange, rowIndex]);

	const setContentRef = useCallback(
		(node: HTMLDivElement | null) => {
			contentRef.current = node;
			rowBoundarySourceRef?.(node);
		},
		[rowBoundarySourceRef],
	);

	return (
		<div
			ref={setContentRef}
			data-flex-layout-table-row-id={id}
			data-flex-layout-table-row-index={rowIndex}
			data-flex-layout-table-header-key={headerKey}
			className={cx(styles["flex-layout-table-cell"], className)}
			style={{
				height: toCssPx(rowHeight),
				minHeight: toCssPx(rowHeight),
				...style,
			}}
		>
			{content &&
				(CustomBodyComponent ? (
					<div
						ref={contentInnerRef}
						className={styles["flex-layout-table-cell-content"]}
					>
						<CustomBodyComponent>
							{content.content}
						</CustomBodyComponent>
					</div>
				) : (
					<div
						ref={contentInnerRef}
						className={styles["flex-layout-table-cell-content"]}
						title={
							typeof content.content === "string"
								? content.content
								: ""
						}
					>
						{content.content}
					</div>
				))}
		</div>
	);
}
