"use client";

import { useEffect, useState } from "react";
import {
	flexContainerStore,
	getLayoutInfos,
	getResizePanelRef,
} from "../store/FlexLayoutContainerStore";
import {
	closeFlex,
	getGrow,
	mathGrow,
	openFlex,
} from "../utils/FlexLayoutUtils";

import {
	buffer,
	debounceTime,
	EMPTY,
	filter,
	fromEvent,
	map,
	Subject,
	switchMap,
} from "rxjs";
const g = globalThis as any;
g.__FLEX_SUBJECTS__ ??= { openClose: {}, spread: {} };

export type SubjectMap<T> = Record<string, Subject<T>>;

// 컨테이너 상태 타입 정의
interface ContainerStateRequest {
	mode: "toggle" | "open" | "close";
	initOpenState?: boolean;
	onOpen?: () => void;
	onClose?: () => void;
	openOption?: {
		isPrevSizeOpen?: boolean;
		isResize?: boolean;
		openGrowImportant?: number;
	};
	closeOption?: { isResize?: boolean; isDsiabledResizePanel?: boolean };
}

interface ContainerState {
	isOpen: boolean;
	targetContainer: HTMLElement;
	grow: number;
}
export const containerOpenCloseSubjectMap: SubjectMap<ContainerStateRequest> =
	g.__FLEX_SUBJECTS__.openClose;
export const containerSpreadSubjectMap: SubjectMap<ContainerState> =
	g.__FLEX_SUBJECTS__.spread;

// export const containerOpenCloseSubjectMap: SubjectMap<ContainerStateRequest> = (
//     Object.keys({}) as Array<string>
// ).reduce((total, key) => {
//     total[key] = new Subject<ContainerStateRequest>();
//     return total;
// }, {} as SubjectMap<ContainerStateRequest>);

// export const containerSpreadSubjectMap: SubjectMap<ContainerState> = (
//     Object.keys({}) as Array<string>
// ).reduce((total, key) => {
//     total[key] = new Subject<ContainerState>();
//     return total;
// }, {} as SubjectMap<ContainerState>);

export const ContainerOpenCloseProvider = ({
	layoutName,
	containerName,
	sizeName,
}: {
	layoutName: string;
	containerName: string;
	sizeName: "width" | "height";
}) => {
	// SubjectMap에 중복 체크 후 Subject 추가
	if (!containerOpenCloseSubjectMap[containerName]) {
		containerOpenCloseSubjectMap[containerName] =
			new Subject<ContainerStateRequest>();
	}
	if (!containerSpreadSubjectMap[containerName]) {
		containerSpreadSubjectMap[containerName] =
			new Subject<ContainerState>();
	}

	const [containers, setContainers] = useState<HTMLElement[]>([]);
	const [container, setContainer] = useState<HTMLElement>();

	useEffect(() => {
		// 특정 layoutName과 containerName을 통해 ref를 구독
		const subscription = getLayoutInfos(layoutName as string).subscribe(
			(layout) => {
				if (
					!layout ||
					!layout.container[containerName] ||
					!layout.container[containerName].current
				)
					return;
				setContainers(
					Object.values(layout.container)
						.filter(
							(e): e is { current: HTMLElement } =>
								e.current !== null,
						)
						.map((e) => e.current),
				);
				setContainer(layout.container[containerName].current);
			},
		);

		// 구독 해제
		return () => subscription.unsubscribe();
	}, [containerName, layoutName]);
	useEffect(() => {
		const styleName = `${sizeName.charAt(0).toUpperCase() + sizeName.substring(1)}`;
		const clientSize = ("client" + styleName) as
			| "clientWidth"
			| "clientHeight";
		const outerSize = ("outer" + styleName) as "outerWidth" | "outerHeight";
		const maxSize = ("max" + styleName) as "maxWidth" | "maxHeight";
		const subscribe = containerOpenCloseSubjectMap[containerName].subscribe(
			({
				mode,
				initOpenState: isOpenState,
				onClose,
				onOpen,
				openOption = {},
				closeOption = {},
			}) => {
				if (!container || containers.length === 0) return;
				const currentGrow = getGrow(container);
				const styleMap = window.getComputedStyle(container);
				const maxSizeGrow = mathGrow(
					parseInt(styleMap[maxSize]),
					(container.parentElement &&
						container.parentElement[clientSize]) ||
						window[outerSize],
					containers.length,
				);
				const open = () =>
					openFlex(container, containers, {
						sizeName,
						...(isNaN(maxSizeGrow)
							? {}
							: {
									openGrowImportant: maxSizeGrow,
								}),
						...openOption,
					}).then((openTargetGrow) => {
						if (onOpen) onOpen();
						containerSpreadSubjectMap[containerName].next({
							isOpen: true,
							grow: openTargetGrow as any,
							targetContainer: container,
						});
					});
				const close = () =>
					closeFlex(container, containers, {
						sizeName,
						...closeOption,
					}).then(() => {
						if (onClose) onClose();
						containerSpreadSubjectMap[containerName].next({
							isOpen: false,
							grow: 0,
							targetContainer: container,
						});
					});
				if (mode === "toggle") {
					if (currentGrow === 0) {
						open();
					} else {
						close();
					}
				} else if (mode === "open") {
					if (currentGrow === 0) {
						open();
					}
				} else if (mode === "close") {
					if (currentGrow !== 0) {
						close();
					}
				}
			},
		);

		return () => {
			subscribe.unsubscribe();
		};
	}, [containerName, container, containers, sizeName]);

	return null;
};

export const useContainers = (layoutName: string) => {
	const [containers, setContainers] = useState<HTMLElement[]>([]);

	useEffect(() => {
		// 특정 layoutName과 containerName을 통해 ref를 구독
		const subscription = getLayoutInfos(layoutName as string).subscribe(
			(layout) => {
				setContainers(
					Object.values(layout.container)
						.filter(
							(e): e is { current: HTMLElement } =>
								e.current !== null,
						)
						.map((e) => e.current),
				);
			},
		);

		// 구독 해제
		return () => subscription.unsubscribe();
	}, [layoutName]);
	return containers;
};

export const useLayoutName = (containerName: string) => {
	const [layoutName, setLayoutName] = useState<string>();
	useEffect(() => {
		const subscribe = flexContainerStore
			.pipe(
				map(
					(layouts) =>
						Object.entries(layouts)
							.filter(([_, v]) => v[containerName])
							.map(([k]) => k)[0] as string, // 첫 번째 결과 가져오기
				),
			)
			.subscribe(setLayoutName);

		// 컴포넌트 언마운트 시 구독 해제
		return () => subscribe.unsubscribe();
	}, [containerName]);

	return layoutName;
};

export const useDecompositionLayout = ({
	layoutName: initialLayoutName,
	containerName,
}: {
	layoutName?: string;
	containerName: string;
}) => {
	const derivedLayoutName = useLayoutName(containerName);
	const finalLayoutName = initialLayoutName || derivedLayoutName;

	const [containers, setContainers] = useState<HTMLElement[]>([]);
	const [container, setContainer] = useState<HTMLElement>();
	const [resizePanel, setResizePanel] = useState<HTMLElement>();

	useEffect(() => {
		if (!finalLayoutName) return; // layoutName이 준비될 때까지 대기
		// 특정 layoutName과 containerName을 통해 ref를 구독
		const subscription = getLayoutInfos(finalLayoutName).subscribe(
			(layout) => {
				if (!layout) return;
				setContainers(
					Object.values(layout.container)
						.filter(
							(e): e is { current: HTMLElement } =>
								e.current !== null,
						)
						.map((e) => e.current),
				);
				if (
					containerName &&
					layout.container[containerName] &&
					layout.container[containerName].current
				) {
					setContainer(layout.container[containerName].current);
					if (
						layout.resizePanel[containerName] &&
						layout.resizePanel[containerName].current
					) {
						setResizePanel(
							layout.resizePanel[containerName].current,
						);
					}
				}
			},
		);

		// 구독 해제
		return () => subscription.unsubscribe();
	}, [containerName, finalLayoutName]);

	return { layout: containers, container, resizePanel };
};

export const useContainerSize = (containerName: string) => {
	const { layout, container, resizePanel } = useDecompositionLayout({
		containerName,
	});
	const [size, setSize] = useState<{ width: number; height: number }>();
	useEffect(() => {
		if (!container) return;
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setSize({
					width: entry.contentRect.width,
					height: entry.contentRect.height,
				});
			}
		});
		observer.observe(container);
		return () => observer.disconnect();
	}, [container]);
	return { size };
};

export const useDoubleClick = (
	containerName: string,
	opt: ContainerStateRequest,
) => {
	const [isOpen, setIsOpen] = useState<boolean>();
	const [isDoubleClick, setIsDoubleClick] = useState<boolean>();
	useEffect(() => {
		const resizePanelClickEvent = getResizePanelRef({
			containerName,
		}).pipe(
			filter(
				(resizePanelref) =>
					resizePanelref != undefined &&
					resizePanelref.current != undefined,
			),
			//take(1),
			switchMap((resizePanelref) => {
				if (!resizePanelref || !resizePanelref.current) return EMPTY;
				return fromEvent(resizePanelref.current, "click");
			}),
		);
		const subscribe = resizePanelClickEvent
			.pipe(
				buffer(resizePanelClickEvent.pipe(debounceTime(500))),
				filter((clickEventArray) => clickEventArray.length >= 2),
				map((events) => {
					containerOpenCloseSubjectMap[containerName].next({
						...opt,
						openOption: {
							...opt.openOption,
							isPrevSizeOpen: false,
						},
						onClose: () => {
							if (opt.onClose) opt.onClose();
							setIsOpen(false);
							setIsDoubleClick(true);
						},
						onOpen: () => {
							if (opt.onOpen) opt.onOpen();
							setIsOpen(true);
							setIsDoubleClick(true);
						},
					});
				}),
			)
			.subscribe();
		return () => {
			subscribe.unsubscribe();
		};
	}, [containerName]);
	return { isOpen, isDoubleClick, setIsDoubleClick };
};
