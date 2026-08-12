"use client";
import {
	cloneElement,
	ReactElement,
	ReactNode,
	RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import {
	addSplitScreenLeaf,
	dropMovementEventSubject,
	DropPositionOrderName,
	DropTargetComponent,
	removeSplitScreenLeaf,
	useSplitScreenLeafCounts,
} from "../hooks/useDrag";
import { useFlexLayoutSplitScreen } from "../hooks/useFlexLayoutSplitScreen";
import { useFlexLayoutSplitScreenRuntimeContext } from "../providers/FlexLayoutSplitScreenRuntimeContext";
import {
	getCurrentSplitScreenComponents,
	getLayoutSplitScreenStore,
	getSplitScreen,
	removeRootSplitScreen,
	removeSplitScreenChild,
	setSplitScreen,
} from "../store/FlexLayoutContainerStore";
import styles from "../styles/FlexLayout.module.css";
import FlexLayout from "./FlexLayout";
import FlexLayoutContainer from "./FlexLayoutContainer";
import FlexLayoutSplitScreenDragBox, {
	DropDocumentOutsideOption,
} from "./FlexLayoutSplitScreenDragBox";

import equal from "fast-deep-equal/react";
import { distinctUntilChanged, take } from "rxjs";
import FlexLayoutSplitScreenDragBoxItem from "./FlexLayoutSplitScreenDragBoxItem";
import FlexLayoutSplitScreenDragBoxTitleMore, {
	FlexLayoutSplitScreenTitleMoreRenderer,
} from "./FlexLayoutSplitScreenDragBoxTitleMore";
import FlexLayoutSplitScreenScrollBox from "./FlexLayoutSplitScreenScrollBox";

function isOverDrop({
	x,
	y,
	element,
}: {
	x: number;
	y: number;
	element: HTMLDivElement;
}) {
	const {
		x: elementX,
		y: elementY,
		right: elementRight,
		bottom: elementBottom,
	} = element.getBoundingClientRect();
	const isElementOver =
		x < elementX || x > elementRight || y < elementY || y > elementBottom;
	return isElementOver;
}
function isInnerDrop({
	x,
	y,
	element,
}: {
	x: number;
	y: number;
	element: HTMLDivElement;
}) {
	const {
		x: elementX,
		y: elementY,
		right: elementRight,
		bottom: elementBottom,
	} = element.getBoundingClientRect();
	const isElementInner =
		x >= elementX &&
		x <= elementRight &&
		y >= elementY &&
		y <= elementBottom;
	return isElementInner;
}

// SSR 환경과 브라우저 환경 모두에서 안전하게 키를 생성하는 헬퍼 함수
const generateScreenKey = () => {
	// 브라우저 환경일 때 (window 객체가 존재할 때)
	if (typeof window != "undefined" && window.crypto) {
		return Array.from(
			window.crypto.getRandomValues(new Uint32Array(16)),
			(e) => e.toString(32).padStart(2, "0"),
		).join("");
	}
	// 서버 환경일 때 (Node.js) - 대체 랜덤 문자열 생성
	return (
		Math.random().toString(36).substring(2, 15) +
		Math.random().toString(36).substring(2, 15)
	);
};

const copySplitScreenSubtree = ({
	rootName,
	oldLayoutName,
	newLayoutName,
	screenKey,
	oldDepth,
	newDepth,
}: {
	rootName: string;
	oldLayoutName: string;
	newLayoutName: string;
	screenKey: string;
	oldDepth: number;
	newDepth: number;
}) => {
	const rootStore = getLayoutSplitScreenStore()[rootName];
	const current = rootStore?.[`${oldLayoutName}=${screenKey}`];
	if (!current) return;

	setSplitScreen(rootName, `${newLayoutName}=${screenKey}`, current);

	current.beforeDropTargetComponent.forEach((item) => {
		copySplitScreenSubtree({
			rootName,
			oldLayoutName: `${oldLayoutName}_before-${oldDepth}`,
			newLayoutName: `${newLayoutName}_before-${newDepth}`,
			screenKey: item.screenKey,
			oldDepth: oldDepth + 1,
			newDepth: newDepth + 1,
		});
	});

	current.afterDropTargetComponent.forEach((item) => {
		copySplitScreenSubtree({
			rootName,
			oldLayoutName: `${oldLayoutName}_after-${oldDepth}`,
			newLayoutName: `${newLayoutName}_after-${newDepth}`,
			screenKey: item.screenKey,
			oldDepth: oldDepth + 1,
			newDepth: newDepth + 1,
		});
	});

	if (
		current.beforeDropTargetComponent.length !== 0 ||
		current.afterDropTargetComponent.length !== 0
	) {
		copySplitScreenSubtree({
			rootName,
			oldLayoutName: `${oldLayoutName}_center-${oldDepth}`,
			newLayoutName: `${newLayoutName}_center-${newDepth}`,
			screenKey,
			oldDepth: oldDepth + 1,
			newDepth: newDepth + 1,
		});
	}
};

const handleUpdateDropTargetComponents = ({
	orderName,
	parentOrderName,
	containerName,
	parentLayoutName,
	layoutName,
	dropComponent,
	navigationTitle,
	nextContainerName,
	isUsePrefix = true,
	beforeDropTargetComponent,
	afterDropTargetComponent,
	centerDropTargetComponent,
	dropDocumentOutsideOption,
	customData,
	screenKey = generateScreenKey(),
}: {
	orderName: DropPositionOrderName;
	parentOrderName?: DropPositionOrderName;
	containerName: string;
	parentLayoutName: string;
	layoutName: string;
	dropComponent: ReactElement;
	navigationTitle?: string;
	nextContainerName?: string;
	isUsePrefix?: boolean;
	beforeDropTargetComponent: DropTargetComponent[];
	afterDropTargetComponent: DropTargetComponent[];
	centerDropTargetComponent: DropTargetComponent[];
	dropDocumentOutsideOption?: DropDocumentOutsideOption;
	customData?: Record<string, string | number | boolean | undefined>;
	screenKey?: string;
}) => {
	const nextContainerNameOrderName = parentOrderName
		? parentOrderName
		: orderName;

	let listMap: Record<string, DropTargetComponent[]>;
	let list: DropTargetComponent[];
	let key: string;
	if (
		nextContainerNameOrderName === orderName ||
		nextContainerNameOrderName === "center"
	) {
		listMap =
			orderName === "before"
				? { beforeDropTargetComponent }
				: orderName === "after"
					? { afterDropTargetComponent }
					: {
							centerDropTargetComponent:
								centerDropTargetComponent.filter(
									(e) =>
										!e.containerName
											.split("_")
											.at(0)!
											.startsWith(
												containerName.split("_").at(0)!,
											),
								),
						};
	} else {
		listMap =
			nextContainerNameOrderName === "before"
				? { beforeDropTargetComponent }
				: { afterDropTargetComponent };
	}
	const entries = Object.entries(listMap)[0];
	key = entries[0];
	list = entries[1];
	/*
    nextContainerNameOrderName이 after고 orderName이 before면 setAfterDropTargetComponent에서 nextContainerName의 뒤에 넣는다.
    nextContainerNameOrderName이 before고 orderName이 after면 setBeforeDropTargetComponent에서 nextContainerName 앞에 넣는다. 
    nextContainerNameOrderName이 center고 orderName이 after면 리스트의 첫번째에 넣는다.
    nextContainerNameOrderName이 center고 orderName이 before면 리스트의 마지막에 넣는다.
    nextContainerNameOrderName === orderName가 같고 orderName이 after나 center면 list에서 nextContainerName 앞에 넣는다.
    nextContainerNameOrderName === orderName가 같고 orderName이 before면 list에서 nextContainerName 뒤에 넣는다.
    */

	const newComponent = {
		containerName: `${containerName + "_" + layoutName}${isUsePrefix ? "_" + orderName + "-" + list.length : ""}`,
		component: cloneElement(
			dropComponent as ReactElement<{ screenKey: string }>,
			{ key: screenKey, screenKey },
		),
		navigationTitle,
		dropDocumentOutsideOption,
		customData,
		screenKey: screenKey || generateScreenKey(),
	};
	let allComponents;

	if (nextContainerName) {
		// nextContainerName이 존재할 때
		const index = list.findIndex(
			(item) => item.containerName === nextContainerName,
		);
		if (index !== -1) {
			if (nextContainerNameOrderName === orderName) {
				if (orderName === "before") {
					// nextContainerNameOrderName === orderName가 같고
					// orderName이 before면 list에서 nextContainerName 뒤에 넣는다.
					allComponents = [
						...list.slice(0, index),
						newComponent,
						...list.slice(index),
					];
				} else {
					// nextContainerNameOrderName === orderName가 같고
					// orderName이 after나 center면 list에서 nextContainerName 앞에 넣는다.
					allComponents = [
						...list.slice(0, index + 1),
						newComponent,
						...list.slice(index + 1),
					];
				}
			} else {
				if (
					nextContainerNameOrderName === "after" &&
					orderName === "before"
				) {
					// nextContainerNameOrderName이 after고 orderName이 before면
					// setAfterDropTargetComponent에서 nextContainerName의 뒤에 넣는다.
					allComponents = [
						...list.slice(0, index),
						newComponent,
						...list.slice(index),
					];
				} else if (
					nextContainerNameOrderName === "before" &&
					orderName === "after"
				) {
					// nextContainerNameOrderName이 before고 orderName이 after면
					// setBeforeDropTargetComponent에서 nextContainerName 앞에 넣는다.
					allComponents = [
						...list.slice(0, index + 1),
						newComponent,
						...list.slice(index + 1),
					];
				} else {
					// 기타 경우 기존 로직 유지
					if (orderName === "before") {
						allComponents = [
							...list.slice(0, index),
							newComponent,
							...list.slice(index),
						];
					} else {
						allComponents = [
							...list.slice(0, index + 1),
							newComponent,
							...list.slice(index + 1),
						];
					}
				}
			}
		} else {
			if (
				nextContainerNameOrderName === "center" &&
				orderName === "after"
			) {
				// nextContainerNameOrderName이 center고 orderName이 after면
				// setAfterDropTargetComponent에서 첫번째에 넣는다.
				allComponents = [newComponent, ...list];
			} else if (
				nextContainerNameOrderName === "center" &&
				orderName === "before"
			) {
				// nextContainerNameOrderName이 center고 orderName이 before면
				// setBeforeDropTargetComponent에서 마지막에 넣는다.

				allComponents = [...list, newComponent];
			} else {
				// nextContainerName을 찾지 못했을 경우 기존 로직 유지
				allComponents =
					orderName === "before"
						? [newComponent, ...list]
						: [...list, newComponent];
			}
		}
	} else {
		// nextContainerName이 존재하지 않을 때 기존 로직 유지
		allComponents =
			orderName === "before"
				? [newComponent, ...list]
				: [...list, newComponent];
	}

	const seen = new Set<string>();

	const result = allComponents.filter((item) => {
		if (seen.has(item.containerName)) {
			return false; // 이미 본 containerName은 제거
		}
		seen.add(item.containerName);
		return true;
	});
	dropMovementEventSubject.next({
		state: "append",
		targetParentLayoutName: parentLayoutName,
		targetLayoutName: layoutName,
		targetContainerName: containerName,
		orderName: orderName,
	});
	return { [key]: result };
};

const handleRemove = (
	list: DropTargetComponent[],
	targetContainerName: string,
	orderNameSetter: (removeCount: number) => void,
) => {
	const result = list.filter((e) => e.containerName !== targetContainerName);
	if (result.length != list.length)
		orderNameSetter(list.length - result.length);
	return result;
};

function getAdjacentItem<T>(items: T[], currentIndex: number) {
	if (currentIndex + 1 < items.length) {
		return {
			adjacentItem: items[currentIndex + 1],
			adjacentIndex: currentIndex + 1,
		};
	} else if (currentIndex - 1 >= 0) {
		return {
			adjacentItem: items[currentIndex - 1],
			adjacentIndex: currentIndex - 1,
		};
	}
	return { adjacentItem: null, adjacentIndex: currentIndex };
}

const getSelfOrderName = (
	containerName: string,
): DropPositionOrderName | undefined => {
	const result = containerName
		.split("_")
		.at(-1)
		?.split("-")
		.at(0)
		?.split("=")
		.at(0);
	if (["before", "center", "after"].some((e) => e === result)) {
		return result as DropPositionOrderName;
	} else {
		return;
	}
};

export type FlexLayoutSplitScreenProps = {
	layoutName: string;
	containerName: string;
	children: ReactElement; //ComponentType | ReactElement;
	navigationTitle: string;
	navigationTitleComponent?: ReactElement<{ children?: ReactNode }>;
	titleWrapperComponent?: ReactElement<{ children?: ReactNode }>;
	dropGuideComponent?: ReactNode;
	titleCloseButtonComponent?: ReactNode;
	titleMoreButtonComponent?: ReactNode;
	renderTitleMoreMenu?: FlexLayoutSplitScreenTitleMoreRenderer;
	renderTitleMoreMenuItems?: FlexLayoutSplitScreenTitleMoreRenderer;
	dropDocumentOutsideOption?: DropDocumentOutsideOption;
	screenKey?: string;

	/**
	 * @deprecated This option is no longer used and will be removed in a future release.
	 * Root children are always refreshed without resetting the current split structure.
	 */
	isResetOnChildrenChange?: boolean;

	/**
	 * Keep the in-memory split-screen store when this component unmounts.
	 * This does not persist state across a browser reload.
	 * default = false
	 */
	preserveStateOnUnmount?: boolean;

	/**
	 * @deprecated Use `preserveStateOnUnmount` instead.
	 * This compatibility alias will be removed in a future release.
	 */
	isRemoveStoreOnUnmount?: boolean;
};

export default function FlexLayoutSplitScreen({
	children,
	containerName,
	layoutName,
	navigationTitle,
	navigationTitleComponent,
	titleWrapperComponent,
	dropGuideComponent,
	titleCloseButtonComponent,
	titleMoreButtonComponent,
	renderTitleMoreMenu,
	renderTitleMoreMenuItems,
	dropDocumentOutsideOption,
	screenKey,
	preserveStateOnUnmount,
	isRemoveStoreOnUnmount,
}: FlexLayoutSplitScreenProps) {
	const {
		direction,
		isSplit,
		boundaryContainerSize,
		afterDropTargetComponent,
		beforeDropTargetComponent,
		centerDropTargetComponent,
		setAfterDropTargetComponent,
		setBeforeDropTargetComponent,
		setCenterDropTargetComponent,
		layoutRef,
		setIsSplit,
		setDirection,
	} = useFlexLayoutSplitScreen({
		isSplitInitial: false,
		directionInitial: "row",
		selfContainerName: containerName,
		parentLayoutName: "",
		layoutName: layoutName,
	});

	const resolvedScreenKeyRef = useRef(screenKey ?? generateScreenKey());

	const resolvedScreenKey = screenKey ?? resolvedScreenKeyRef.current;

	const shouldPreserveStateOnUnmount =
		preserveStateOnUnmount ?? isRemoveStoreOnUnmount === false;
	const splitScreenRuntimeContext = useFlexLayoutSplitScreenRuntimeContext();
	const runtimeRootComponentRef = useRef<DropTargetComponent>({
		containerName,
		component: children,
		navigationTitle,
		dropDocumentOutsideOption,
		screenKey: resolvedScreenKey,
	});
	runtimeRootComponentRef.current = {
		containerName,
		component: children,
		navigationTitle,
		dropDocumentOutsideOption,
		screenKey: resolvedScreenKey,
	};

	useLayoutEffect(() => {
		return splitScreenRuntimeContext?.registerRoot(
			layoutName,
			() => runtimeRootComponentRef.current,
		);
	}, [layoutName, splitScreenRuntimeContext]);

	useEffect(() => {
		const sub = getSplitScreen(layoutName, layoutName).subscribe(
			(layoutInfo) => {
				if (layoutInfo) {
					setBeforeDropTargetComponent([
						...layoutInfo.beforeDropTargetComponent,
					]);
					setAfterDropTargetComponent([
						...layoutInfo.afterDropTargetComponent,
					]);
					setCenterDropTargetComponent([
						...layoutInfo.centerDropTargetComponent,
					]);
					setDirection(layoutInfo.direction);

					const rootCenterScreenKey =
						layoutInfo.centerDropTargetComponent[0]?.screenKey;
					const nestedCenter = rootCenterScreenKey
						? getCurrentSplitScreenComponents(
								layoutName,
								`${layoutName}_center=${rootCenterScreenKey}`,
							)
						: undefined;
					setIsSplit(
						layoutInfo.beforeDropTargetComponent.length !== 0 ||
							layoutInfo.afterDropTargetComponent.length !== 0 ||
							Boolean(
								nestedCenter &&
									(nestedCenter.beforeDropTargetComponent.length !== 0 ||
										nestedCenter.afterDropTargetComponent.length !== 0 ||
										nestedCenter.centerDropTargetComponent.length > 1),
							),
					);
					return;
				}

				// store가 없으면 초기 생성
				setSplitScreen(layoutName, layoutName, {
					afterDropTargetComponent: [],
					beforeDropTargetComponent: [],
					centerDropTargetComponent: [
						{
							containerName,
							component: children,
							navigationTitle,
							dropDocumentOutsideOption,
							screenKey: resolvedScreenKey,
						},
					],
					direction,
				});
			},
		);

		return () => {
			sub.unsubscribe();
			if (!shouldPreserveStateOnUnmount) {
				removeRootSplitScreen(layoutName);
			}
		};
	}, [layoutName, shouldPreserveStateOnUnmount]);

	useEffect(() => {
		const current = getCurrentSplitScreenComponents(layoutName, layoutName);
		if (!current || current.centerDropTargetComponent.length === 0) return;

		// 루트 center(보통 1개)만 업데이트. (분할 상태/다른 pane는 유지)
		const rootCenter = current.centerDropTargetComponent[0];

		// screenKey가 다르면 “다른 루트”로 간주하고 덮어쓰지 않는 편이 안전
		const expectedKey = screenKey ?? rootCenter.screenKey;
		if (rootCenter.screenKey !== expectedKey) return;

		const nextRootCenter = {
			...rootCenter,
			component: children,
			navigationTitle,
			dropDocumentOutsideOption,
		};

		// 동일하면 setSplitScreen 호출하지 않음(불필요한 rerender/loop 방지)
		if (
			rootCenter.component === nextRootCenter.component &&
			rootCenter.navigationTitle === nextRootCenter.navigationTitle &&
			rootCenter.dropDocumentOutsideOption ===
				nextRootCenter.dropDocumentOutsideOption
		) {
			return;
		}

		setSplitScreen(layoutName, layoutName, {
			...current,
			centerDropTargetComponent: [nextRootCenter],
		});

		const rootTabKey = rootCenter.screenKey; // 라우트(children) 탭의 고유키

		const childKey = `${layoutName}_center=${rootTabKey}`;
		const child = getCurrentSplitScreenComponents(layoutName, childKey);

		if (child?.centerDropTargetComponent?.length) {
			const idx = child.centerDropTargetComponent.findIndex(
				(t) => t.screenKey === rootTabKey,
			);

			if (idx !== -1) {
				const nextList = [...child.centerDropTargetComponent];
				nextList[idx] = {
					...nextList[idx],
					component: children,
					navigationTitle,
					dropDocumentOutsideOption,
				};

				setSplitScreen(layoutName, childKey, {
					...child,
					centerDropTargetComponent: nextList,
				});
			}
		}
	}, [
		layoutName,
		children,
		navigationTitle,
		dropDocumentOutsideOption,
		screenKey,
	]);

	useEffect(() => {
		const subscribe = dropMovementEventSubject
			.pipe(
				distinctUntilChanged((prev, curr) => {
					// 이전 상태와 현재 상태를 비교하여 동일하면 필터링
					const filterChildren = (obj: any) => {
						// 객체 복사 후 children 속성 제거
						const {
							children,
							component,
							targetComponent,
							x,
							y,
							...rest
						} = obj || {};
						return rest;
					};
					return equal(filterChildren(prev), filterChildren(curr));
				}),
			)
			.subscribe((event) => {
				if (event.state === "remove") {
					// 렌더링 중에 바로 setRemoveContainerName을 호출하지 않고
					// requestAnimationFrame으로 감싸 렌더 후에 실행되도록 한다.
					if (
						event.targetParentLayoutName === layoutName ||
						(event.targetParentLayoutName === "" &&
							event.targetLayoutName === layoutName)
					) {
						requestAnimationFrame(() => {
							let removeCallback = (
								removeOrderName: DropPositionOrderName,
							) => {
								// removeSplitScreenChild(
								//     layoutName,
								//     event.targetLayoutName
								// );
								//탭 이동이고 현재 활성화 된 탭인 경우
								if (
									event.nextContainerName &&
									event.dropTargetComponentEvent &&
									event.targetComponent
								) {
									const targetComponentsMap =
										handleUpdateDropTargetComponents({
											orderName: removeOrderName,
											containerName:
												event.nextContainerName,
											parentLayoutName: "",
											layoutName,
											dropComponent:
												event.targetComponent,
											navigationTitle:
												event.dropTargetComponentEvent!
													.navigationTitle!,
											isUsePrefix: true,
											afterDropTargetComponent,
											beforeDropTargetComponent,
											centerDropTargetComponent,
											dropDocumentOutsideOption,
											customData:
												event.dropTargetComponentEvent.customData,
											screenKey:
												event.dropTargetComponentEvent
													.screenKey,
										});
									setSplitScreen(layoutName, layoutName, {
										...(getCurrentSplitScreenComponents(
											layoutName,
											layoutName,
										) || {
											afterDropTargetComponent,
											beforeDropTargetComponent,
											centerDropTargetComponent,
											direction,
										}),
										...targetComponentsMap,
									});
									Promise.resolve().then(
										() =>
											event.dropEndCallback &&
											event.dropEndCallback({
												x: event.x!,
												y: event.y!,
												containerName: containerName,
											}),
									);
								}
							};
							const currentComponents =
								getCurrentSplitScreenComponents(
									layoutName,
									layoutName,
								);
							const currentAfter =
								currentComponents?.afterDropTargetComponent ||
								afterDropTargetComponent;
							const currentBefore =
								currentComponents?.beforeDropTargetComponent ||
								beforeDropTargetComponent;
							const currentCenter =
								currentComponents?.centerDropTargetComponent ||
								centerDropTargetComponent;
							let afterList = handleRemove(
								currentAfter,
								event.targetContainerName,
								() => removeCallback("after"),
							);
							let beforList = handleRemove(
								currentBefore,
								event.targetContainerName,
								() => removeCallback("before"),
							);
							let centerList = handleRemove(
								currentCenter,
								event.targetContainerName,
								() => removeCallback("center"),
							);

							if (
								centerList.length === 0 &&
								currentCenter.some(
									(item) =>
										item.containerName ===
										event.targetContainerName,
								)
							) {
								const promotedFrom =
									currentBefore.length !== 0
										? "before"
										: currentAfter.length !== 0
											? "after"
											: undefined;
								const promoted =
									promotedFrom === "before"
										? currentBefore[
												currentBefore.length - 1
											]
										: promotedFrom === "after"
											? currentAfter[0]
											: undefined;

								if (promoted && promotedFrom) {
									if (promotedFrom === "before") {
										beforList = currentBefore.slice(0, -1);
									} else {
										afterList = currentAfter.slice(1);
									}
									centerList = [promoted];

									copySplitScreenSubtree({
										rootName: layoutName,
										oldLayoutName: `${layoutName}_${promotedFrom}`,
										newLayoutName: `${layoutName}_center`,
										screenKey: promoted.screenKey,
										oldDepth: 1,
										newDepth: 0,
									});
								}
							}

							setSplitScreen(layoutName, layoutName, {
								afterDropTargetComponent: afterList,
								beforeDropTargetComponent: beforList,
								centerDropTargetComponent: centerList,
								direction,
							});
						});
					}
				} else if (event.state === "append") {
					const {
						x,
						y,
						dropEndCallback,
						dropTargetComponentEvent,
						orderName,
						parentOrderName,
						targetLayoutName,
						targetParentLayoutName,
						targetContainerName,
						targetComponent,
						nextContainerName,
					} = event;
					if (
						layoutRef.current &&
						orderName &&
						x &&
						y &&
						targetComponent &&
						dropTargetComponentEvent &&
						targetLayoutName === layoutName &&
						isInnerDrop({ x, y, element: layoutRef.current })
					) {
						const {
							direction: dropDirection,
							navigationTitle,
							dropDocumentOutsideOption,
						} = dropTargetComponentEvent;

						const isOrderNameNotCenter = orderName !== "center";
						const isOrderNameCenterAndFirstScreen =
							orderName === "center" &&
							centerDropTargetComponent.length <= 1;
						if (
							isOrderNameNotCenter ||
							isOrderNameCenterAndFirstScreen
						) {
							setIsSplit(true);
							if (isOrderNameNotCenter) {
								setDirection(dropDirection);
								const targetComponentsMap =
									handleUpdateDropTargetComponents({
										orderName,
										parentOrderName,
										containerName: targetContainerName,
										nextContainerName: nextContainerName,
										dropComponent: targetComponent,
										parentLayoutName: "",
										layoutName,
										navigationTitle,
										isUsePrefix: true,
										afterDropTargetComponent,
										beforeDropTargetComponent,
										centerDropTargetComponent,
										dropDocumentOutsideOption,
										customData: dropTargetComponentEvent.customData,
									});

								setSplitScreen(layoutName, layoutName, {
									...{
										afterDropTargetComponent,
										beforeDropTargetComponent,
										centerDropTargetComponent,
										direction: dropDirection,
									},
									...targetComponentsMap,
									...{ direction: dropDirection },
								});
								Promise.resolve().then(
									() =>
										dropEndCallback &&
										dropEndCallback({
											x: event.x!,
											y: event.y!,
											containerName: containerName,
										}),
								);
							} else {
								const childScreenInfo =
									getCurrentSplitScreenComponents(
										layoutName,
										`${layoutName}_center=${centerDropTargetComponent[0].screenKey}`,
									) || {
										afterDropTargetComponent: [],
										beforeDropTargetComponent: [],
										centerDropTargetComponent: [],
										direction,
									};
								setSplitScreen(
									layoutName,
									`${layoutName}_center=${centerDropTargetComponent[0].screenKey}`,
									{
										...childScreenInfo,
										...{
											centerDropTargetComponent: [
												centerDropTargetComponent[0],
												{
													containerName: `${targetContainerName}_${layoutName}_${orderName}`,
													component: targetComponent!,
													dropDocumentOutsideOption,
													customData: dropTargetComponentEvent.customData,
													screenKey:
														dropTargetComponentEvent.screenKey,
													navigationTitle,
												},
											],
										},
									},
								);
							}
						}
					}
				}
			});
		return () => {
			subscribe.unsubscribe();
		};
	}, [
		direction,
		layoutName,
		isSplit,
		beforeDropTargetComponent,
		afterDropTargetComponent,
		centerDropTargetComponent,
	]);

	const fallbackRootCenter: DropTargetComponent = {
		containerName,
		component: children,
		navigationTitle,
		dropDocumentOutsideOption,
		screenKey: resolvedScreenKey,
	};

	const rootCenter = centerDropTargetComponent[0] ?? fallbackRootCenter;
	const hasRealRootCenter = centerDropTargetComponent.length > 0;
	return (
		<div className={`${styles["flex-split-screen"]}`} ref={layoutRef}>
			<FlexLayout
				direction={direction}
				layoutName={layoutName}
				data-is_split={isSplit}
				panelMovementMode="bulldozer"
			>
				{beforeDropTargetComponent.length != 0 ? (
					<>
						{beforeDropTargetComponent.map(
							(
								{
									containerName: cName,
									component,
									navigationTitle,
									dropDocumentOutsideOption,
									customData,
									screenKey,
								},
								i,
							) => (
								<FlexLayoutContainer
									containerName={cName}
									isInitialResizable
									isResizePanel
									key={cName}
								>
									<FlexLayoutSplitScreenChild
										parentDirection={direction}
										layoutName={`${layoutName}_before`}
										parentLayoutName={layoutName}
										containerName={cName}
										depth={1}
										//isSplit={isSplit}
										rootRef={layoutRef}
										screenKey={screenKey}
										initialCenterComponents={[
											{
												navigationTitle,
												component,
												containerName: cName,
												dropDocumentOutsideOption,
												customData,
												screenKey,
											},
										]}
										navigationTitleComponent={navigationTitleComponent}
										titleWrapperComponent={titleWrapperComponent}
										dropGuideComponent={dropGuideComponent}
										titleCloseButtonComponent={titleCloseButtonComponent}
										titleMoreButtonComponent={titleMoreButtonComponent}
										renderTitleMoreMenu={renderTitleMoreMenu}
										renderTitleMoreMenuItems={renderTitleMoreMenuItems}
										rootName={layoutName}
									></FlexLayoutSplitScreenChild>
								</FlexLayoutContainer>
							),
						)}
					</>
				) : (
					<div></div>
				)}
				<FlexLayoutContainer
					containerName={`${rootCenter.containerName}`}
					isInitialResizable
					isResizePanel={isSplit}
				>
					{hasRealRootCenter && isSplit ? (
						<FlexLayoutSplitScreenChild
							parentDirection={direction}
							layoutName={`${layoutName}_center`}
							parentLayoutName={layoutName}
							containerName={rootCenter.containerName}
							depth={0}
							rootRef={layoutRef}
							screenKey={rootCenter.screenKey}
							initialCenterComponents={[
								{
									navigationTitle: rootCenter.navigationTitle,
									component: rootCenter.component,
									containerName: rootCenter.containerName,
									dropDocumentOutsideOption:
										rootCenter.dropDocumentOutsideOption,
									customData: rootCenter.customData,
									screenKey: rootCenter.screenKey,
								},
							]}
							navigationTitleComponent={navigationTitleComponent}
							titleWrapperComponent={titleWrapperComponent}
							dropGuideComponent={dropGuideComponent}
							titleCloseButtonComponent={titleCloseButtonComponent}
							titleMoreButtonComponent={titleMoreButtonComponent}
							renderTitleMoreMenu={renderTitleMoreMenu}
							renderTitleMoreMenuItems={renderTitleMoreMenuItems}
							rootName={layoutName}
						></FlexLayoutSplitScreenChild>
					) : (
						<FlexLayoutSplitScreenScrollBox
							keyName={rootCenter.containerName}
						>
							{rootCenter.component}
						</FlexLayoutSplitScreenScrollBox>
					)}
				</FlexLayoutContainer>
				{afterDropTargetComponent.length != 0 ? (
					<>
						{afterDropTargetComponent.map(
							(
								{
									containerName: cName,
									component,
									navigationTitle,
									dropDocumentOutsideOption,
									customData,
									screenKey,
								},
								i,
							) => (
								<FlexLayoutContainer
									containerName={cName}
									isInitialResizable
									isResizePanel={
										afterDropTargetComponent.length - 1 !==
										i
									}
									key={cName}
								>
									<FlexLayoutSplitScreenChild
										parentDirection={direction}
										layoutName={`${layoutName}_after`}
										parentLayoutName={layoutName}
										containerName={cName}
										depth={1}
										//isSplit={isSplit}
										rootRef={layoutRef}
										screenKey={screenKey}
										initialCenterComponents={[
											{
												navigationTitle,
												component,
												containerName: cName,
												dropDocumentOutsideOption,
												customData,
												screenKey,
											},
										]}
										navigationTitleComponent={navigationTitleComponent}
										titleWrapperComponent={titleWrapperComponent}
										dropGuideComponent={dropGuideComponent}
										titleCloseButtonComponent={titleCloseButtonComponent}
										titleMoreButtonComponent={titleMoreButtonComponent}
										renderTitleMoreMenu={renderTitleMoreMenu}
										renderTitleMoreMenuItems={renderTitleMoreMenuItems}
										rootName={layoutName}
									></FlexLayoutSplitScreenChild>
								</FlexLayoutContainer>
							),
						)}
					</>
				) : (
					<div></div>
				)}
			</FlexLayout>
			{boundaryContainerSize && (
				<div
					className={`${styles["flex-split-screen-boundary-container"]}`}
					style={{ ...boundaryContainerSize }}
				>
					{dropGuideComponent === undefined
						? "⬇️드롭하면 화면이 분할됩니다."
						: dropGuideComponent}
				</div>
			)}
		</div>
	);
}

function FlexLayoutSplitScreenChild({
	containerName,
	layoutName,
	parentLayoutName,
	parentDirection,
	depth,
	//isSplit: isSplitInitial,
	rootRef,
	rootName,
	initialCenterComponents,
	screenKey,
	navigationTitleComponent,
	titleWrapperComponent,
	dropGuideComponent,
	titleCloseButtonComponent,
	titleMoreButtonComponent,
	renderTitleMoreMenu,
	renderTitleMoreMenuItems,
}: {
	layoutName: string;
	parentLayoutName: string;
	containerName: string;
	parentDirection: "row" | "column";
	depth: number;
	//isSplit: boolean;
	rootRef: RefObject<HTMLDivElement | null>;
	rootName: string;
	initialCenterComponents?: DropTargetComponent[];
	screenKey: string;
	navigationTitleComponent?: ReactElement<{ children?: ReactNode }>;
	titleWrapperComponent?: ReactElement<{ children?: ReactNode }>;
	dropGuideComponent?: ReactNode;
	titleCloseButtonComponent?: ReactNode;
	titleMoreButtonComponent?: ReactNode;
	renderTitleMoreMenu?: FlexLayoutSplitScreenTitleMoreRenderer;
	renderTitleMoreMenuItems?: FlexLayoutSplitScreenTitleMoreRenderer;
}) {
	// const memoizedChildren = useMemo(
	//     () => <MemoizedChildren>{children}</MemoizedChildren>,
	//     [children]
	// );
	const {
		direction,
		isSplit,
		boundaryContainerSize,
		afterDropTargetComponent,
		beforeDropTargetComponent,
		centerDropTargetComponent,
		setAfterDropTargetComponent,
		setBeforeDropTargetComponent,
		setCenterDropTargetComponent,
		layoutRef,
		setIsSplit,
		setDirection,
	} = useFlexLayoutSplitScreen({
		isSplitInitial: false,
		directionInitial: "row",
		parentDirection,
		selfContainerName: containerName,
		parentLayoutName: parentLayoutName,
		layoutName: layoutName,
	});

	const splitScreenRuntimeContext = useFlexLayoutSplitScreenRuntimeContext();
	const [isEmptyContent, setIsEmptyContent] = useState<boolean>(false);
	const [activeIndex, setActiveIndex] = useState<number>(0);
	const centerDropTargetComponentRef = useRef(centerDropTargetComponent);
	const initialCenterRef = useRef<DropTargetComponent[]>(
		initialCenterComponents ?? [],
	);

	const activeIndexRef = useRef(activeIndex);

	const removeCurrentSplit = useCallback(() => {
		dropMovementEventSubject.next({
			state: "remove",
			targetContainerName: containerName,
			targetParentLayoutName: parentLayoutName,
			targetLayoutName: layoutName,
		});
	}, [containerName, layoutName, parentLayoutName]);

	const applyCenterTabs = useCallback(
		(next: DropTargetComponent[], activeScreenKey?: string) => {
			const nextActiveIndex = activeScreenKey
				? next.findIndex((item) => item.screenKey === activeScreenKey)
				: 0;
			const resolvedActiveIndex =
				next.length === 0
					? 0
					: nextActiveIndex >= 0
						? nextActiveIndex
						: Math.min(activeIndexRef.current, next.length - 1);

			centerDropTargetComponentRef.current = next;
			activeIndexRef.current = resolvedActiveIndex;
			setActiveIndex(resolvedActiveIndex);
			setCenterDropTargetComponent(next);
			setSplitScreen(rootName, `${layoutName}=${screenKey}`, {
				...(getCurrentSplitScreenComponents(
					rootName,
					`${layoutName}=${screenKey}`,
				) || {
					afterDropTargetComponent,
					beforeDropTargetComponent,
					centerDropTargetComponent:
						centerDropTargetComponentRef.current,
					direction,
				}),
				centerDropTargetComponent: next,
			});
		},
		[
			afterDropTargetComponent,
			beforeDropTargetComponent,
			direction,
			layoutName,
			rootName,
			screenKey,
		],
	);

	const closeCenterTab = useCallback(
		(index: number) => {
			const current = centerDropTargetComponentRef.current;
			if (!current[index]) return;
			if (current.length === 1) {
				removeCurrentSplit();
				return;
			}

			const activeScreenKey = current[activeIndexRef.current]?.screenKey;
			const next = current.filter((_, itemIndex) => itemIndex !== index);
			applyCenterTabs(
				next,
				index === activeIndexRef.current
					? next[Math.min(index, next.length - 1)]?.screenKey
					: activeScreenKey,
			);
		},
		[applyCenterTabs, removeCurrentSplit],
	);

	const closeOtherCenterTabs = useCallback(() => {
		const current = centerDropTargetComponentRef.current;
		const activeItem = current[activeIndexRef.current];
		if (!activeItem || current.length <= 1) return;
		applyCenterTabs([activeItem], activeItem.screenKey);
	}, [applyCenterTabs]);

	const closeRightCenterTabs = useCallback(() => {
		const current = centerDropTargetComponentRef.current;
		const activeItem = current[activeIndexRef.current];
		if (!activeItem || activeIndexRef.current >= current.length - 1) return;
		applyCenterTabs(
			current.slice(0, activeIndexRef.current + 1),
			activeItem.screenKey,
		);
	}, [applyCenterTabs]);

	const moveCenterTab = useCallback(
		(
			draggedContainerName: string,
			targetContainerName: string,
			position: "before" | "after",
		) => {
			const current = centerDropTargetComponentRef.current;
			const fromIndex = current.findIndex(
				(item) => item.containerName === draggedContainerName,
			);
			const targetIndexBefore = current.findIndex(
				(item) => item.containerName === targetContainerName,
			);
			if (fromIndex < 0 || targetIndexBefore < 0) return;

			const activeScreenKey = current[activeIndexRef.current]?.screenKey;
			const next = [...current];
			const [dragged] = next.splice(fromIndex, 1);
			const targetIndexAfter = next.findIndex(
				(item) => item.containerName === targetContainerName,
			);
			next.splice(
				position === "before" ? targetIndexAfter : targetIndexAfter + 1,
				0,
				dragged,
			);

			if (next.every((item, index) => item === current[index])) return;
			applyCenterTabs(next, activeScreenKey);
		},
		[applyCenterTabs],
	);

	useEffect(() => {
		const storeKey = `${layoutName}=${screenKey}`;

		const subscribe = getSplitScreen(rootName, storeKey)
			.pipe(take(1))
			.subscribe((layoutInfo) => {
				if (layoutInfo) return;

				setSplitScreen(rootName, storeKey, {
					afterDropTargetComponent: [],
					beforeDropTargetComponent: [],
					centerDropTargetComponent: initialCenterRef.current,
					direction,
				});
			});
		return () => {
			if (!splitScreenRuntimeContext?.isRestoringRoot?.(rootName)) {
				removeSplitScreenChild(rootName, `${layoutName}=${screenKey}`);
			}
			subscribe.unsubscribe();
		};
	}, [rootName, layoutName, screenKey, splitScreenRuntimeContext]);

	useEffect(() => {
		const subscribe = getSplitScreen(rootName, `${layoutName}=${screenKey}`)
			//.pipe(take(1))
			.subscribe((layoutInfo) => {
				if (layoutInfo) {
					// console.log(
					//     'layoutInfo:::',
					//     layoutInfo,
					//     layoutName,
					//     containerName
					// );
					setBeforeDropTargetComponent([
						...layoutInfo.beforeDropTargetComponent,
					]);
					setAfterDropTargetComponent([
						...layoutInfo.afterDropTargetComponent,
					]);
					setCenterDropTargetComponent([
						...layoutInfo.centerDropTargetComponent,
					]);
					setDirection(layoutInfo.direction);
					if (
						layoutInfo.beforeDropTargetComponent.length !== 0 ||
						layoutInfo.afterDropTargetComponent.length !== 0
					) {
						setIsSplit(true);
					} else if (
						layoutInfo.beforeDropTargetComponent.length === 0 &&
						layoutInfo.centerDropTargetComponent.length === 0 &&
						layoutInfo.afterDropTargetComponent.length === 0
					) {
						dropMovementEventSubject.next({
							state: "remove",
							targetContainerName: containerName,
							targetParentLayoutName: "",
							targetLayoutName: parentLayoutName,
						});
						setIsEmptyContent(true);
					}
				}
			});

		return () => {
			subscribe.unsubscribe();
			if (!splitScreenRuntimeContext?.isRestoringRoot?.(rootName)) {
				removeRootSplitScreen(layoutName);
			}
		};
	}, [rootName, layoutName, splitScreenRuntimeContext]);

	useEffect(() => {
		const subscribe = dropMovementEventSubject
			.pipe(
				distinctUntilChanged((prev, curr) => {
					// 이전 상태와 현재 상태를 비교하여 동일하면 필터링
					const filterChildren = (obj: any) => {
						// 객체 복사 후 children 속성 제거
						const {
							children,
							component,
							targetComponent,
							x,
							y,
							...rest
						} = obj || {};
						return rest;
					};

					return equal(filterChildren(prev), filterChildren(curr));
				}),
			)
			.subscribe((event) => {
				if (event.state === "remove") {
					if (
						event.targetParentLayoutName === layoutName ||
						(event.targetParentLayoutName === "" &&
							event.targetLayoutName === layoutName)
					) {
						requestAnimationFrame(() => {
							let removeCallback = (
								removeOrderName: DropPositionOrderName,
							) => {
								// removeSplitScreenChild(
								//     rootName,
								//     event.targetLayoutName
								// );
								if (
									event.nextContainerName &&
									event.dropTargetComponentEvent &&
									event.targetComponent
								) {
									const targetComponentsMap =
										handleUpdateDropTargetComponents({
											orderName: removeOrderName,
											containerName:
												event.nextContainerName,
											parentLayoutName,
											layoutName,
											dropComponent:
												event.targetComponent,
											navigationTitle:
												event.dropTargetComponentEvent
													.navigationTitle!,
											isUsePrefix: true,
											afterDropTargetComponent,
											beforeDropTargetComponent,
											centerDropTargetComponent,
											dropDocumentOutsideOption:
												event.dropTargetComponentEvent
													?.dropDocumentOutsideOption,
											customData:
												event.dropTargetComponentEvent.customData,
											screenKey:
												event.dropTargetComponentEvent
													.screenKey,
										});
									setSplitScreen(
										rootName,
										`${layoutName}=${screenKey}`,
										{
											...(getCurrentSplitScreenComponents(
												rootName,
												`${layoutName}=${screenKey}`,
											) || {
												afterDropTargetComponent,
												beforeDropTargetComponent,
												centerDropTargetComponent,
												direction,
											}),
											...targetComponentsMap,
										},
									);
									Promise.resolve().then(
										() =>
											event.dropEndCallback &&
											event.dropEndCallback({
												x: event.x!,
												y: event.y!,
												containerName: containerName,
											}),
									);
								}
							};
							const currentComponents =
								getCurrentSplitScreenComponents(
									rootName,
									`${layoutName}=${screenKey}`,
								);
							const afterList = handleRemove(
								currentComponents?.afterDropTargetComponent ||
									afterDropTargetComponent,
								event.targetContainerName,
								() => removeCallback("after"),
							);
							const beforList = handleRemove(
								currentComponents?.beforeDropTargetComponent ||
									beforeDropTargetComponent,
								event.targetContainerName,
								() => removeCallback("before"),
							);
							const centerList = handleRemove(
								currentComponents?.centerDropTargetComponent ||
									centerDropTargetComponent,
								event.targetContainerName,
								() => removeCallback("center"),
							);
							setSplitScreen(
								rootName,
								`${layoutName}=${screenKey}`,
								{
									afterDropTargetComponent: afterList,
									beforeDropTargetComponent: beforList,
									centerDropTargetComponent: centerList,
									direction,
								},
							);
						});
					}
				} else if (event.state === "append") {
					const {
						x,
						y,
						dropEndCallback,
						dropTargetComponentEvent,
						orderName,
						targetLayoutName,
						targetParentLayoutName,
						targetContainerName,
						targetComponent,
						nextContainerName,
						parentOrderName,
					} = event;
					if (
						layoutRef.current &&
						orderName &&
						x &&
						y &&
						dropTargetComponentEvent &&
						isInnerDrop({ x, y, element: layoutRef.current })
					) {
						const {
							direction: dropDirection,
							navigationTitle,
							dropDocumentOutsideOption,
							screenKey: containerScreenKey,
						} = dropTargetComponentEvent;

						if (
							//orderName !== 'center' &&
							targetLayoutName === layoutName &&
							targetComponent
						) {
							//드래그앤드롭으로 추가되었을 때
							if (
								dropDirection === parentDirection &&
								orderName !== "center"
							) {
								dropMovementEventSubject.next({
									state: "append",
									targetContainerName: targetContainerName,
									targetParentLayoutName: "",
									targetLayoutName: parentLayoutName,
									targetComponent: targetComponent,
									nextContainerName: containerName,
									parentOrderName:
										getSelfOrderName(layoutName) ||
										orderName,
									orderName,
									x,
									y,
									dropEndCallback,
									dropTargetComponentEvent: {
										navigationTitle,
										dropDocumentOutsideOption,
										direction: parentDirection,
										screenKey,
										customData: dropTargetComponentEvent.customData,
									},
								});
							} else {
								if (orderName !== "center") {
									setDirection(dropDirection);
									setIsSplit(true);
								}
								const targetComponentsMap =
									handleUpdateDropTargetComponents({
										orderName,
										parentOrderName,
										containerName: targetContainerName,
										nextContainerName: nextContainerName,
										parentLayoutName,
										layoutName,
										dropComponent: targetComponent,
										navigationTitle,
										isUsePrefix: orderName !== "center",
										afterDropTargetComponent,
										beforeDropTargetComponent,
										centerDropTargetComponent,
										dropDocumentOutsideOption,
										customData: dropTargetComponentEvent.customData,
									});
								setSplitScreen(
									rootName,
									`${layoutName}=${screenKey}`,
									{
										...(getCurrentSplitScreenComponents(
											rootName,
											`${layoutName}=${screenKey}`,
										) || {
											afterDropTargetComponent,
											beforeDropTargetComponent,
											centerDropTargetComponent,
											direction,
										}),
										...targetComponentsMap,
										...{ direction: dropDirection },
									},
								);
								Promise.resolve().then(
									() =>
										event.dropEndCallback &&
										event.dropEndCallback({
											x: event.x!,
											y: event.y!,
											containerName: containerName,
										}),
								);
							}
						}

						//else if (dropDirection === direction) {
					}
				}
				//console.log('1111:::', layoutName, parentLayoutName, event);
				//setRemoveContainerName(event.targetContainerName);
			});
		return () => {
			subscribe.unsubscribe();
		};
	}, [
		direction,
		parentDirection,
		parentLayoutName,
		layoutName,
		beforeDropTargetComponent,
		afterDropTargetComponent,
		centerDropTargetComponent,
	]);

	useEffect(() => {
		centerDropTargetComponentRef.current = centerDropTargetComponent;
	}, [centerDropTargetComponent]);
	useEffect(() => {
		activeIndexRef.current = activeIndex;
	}, [activeIndex]);

	// useEffect(() => {
	//     const subscribe = getSplitScreen(
	//         rootName,
	//         `${layoutName}=${screenKey}`
	//     ).subscribe(layoutInfo => {
	//         if (
	//             beforeDropTargetComponent.length === 0 &&
	//             centerDropTargetComponent.length === 0 &&
	//             afterDropTargetComponent.length === 0 &&
	//             (layoutInfo?.beforeDropTargetComponent || []).length === 0 &&
	//             (layoutInfo?.centerDropTargetComponent || []).length === 0 &&
	//             (layoutInfo?.afterDropTargetComponent || []).length === 0
	//         ) {
	//             console.log(
	//                 'remove ::: ',
	//                 parentLayoutName,
	//                 layoutName,
	//                 initialCenterComponents
	//             );
	//             dropMovementEventSubject.next({
	//                 state: 'remove',
	//                 targetContainerName: containerName,
	//                 targetParentLayoutName: '',
	//                 targetLayoutName: parentLayoutName,
	//             });
	//             setIsEmptyContent(true);
	//         }
	//         return () => {
	//             subscribe.unsubscribe();
	//         };
	//     });
	// }, [
	//     layoutName,
	//     beforeDropTargetComponent,
	//     afterDropTargetComponent,
	//     centerDropTargetComponent,
	// ]);
	const splitScreenLeafCounts = useSplitScreenLeafCounts();
	const isOnlyOneScreen =
		(splitScreenLeafCounts[rootName] || 0) <= 1 &&
		centerDropTargetComponent.length <= 1;

	useEffect(() => {
		addSplitScreenLeaf(rootName);
		return () => removeSplitScreenLeaf(rootName);
	}, [rootName]);

	return (
		<>
			{!isEmptyContent && (
				<div
					className={`${styles["flex-split-screen"]}`}
					ref={layoutRef}
				>
					<FlexLayout
						direction={direction}
						layoutName={`${layoutName}`}
						panelMovementMode="bulldozer"
					>
						{beforeDropTargetComponent.length != 0 ? (
							<>
								{beforeDropTargetComponent.map(
									(
										{
											containerName: cName,
											component,
											navigationTitle,
											dropDocumentOutsideOption,
											customData,
											screenKey,
										},
										i,
									) => (
										<FlexLayoutContainer
											containerName={cName}
											isInitialResizable
											isResizePanel
											key={cName}
										>
											<FlexLayoutSplitScreenChild
												parentDirection={direction}
												layoutName={`${layoutName}_before-${depth}`}
												parentLayoutName={layoutName}
												containerName={cName}
												depth={depth + 1}
												//isSplit={isSplit}
												rootRef={rootRef}
												screenKey={screenKey}
												initialCenterComponents={[
													{
														navigationTitle,
														component,
														containerName: cName,
														dropDocumentOutsideOption,
														customData,
														screenKey,
													},
												]}
												navigationTitleComponent={navigationTitleComponent}
												titleWrapperComponent={titleWrapperComponent}
												dropGuideComponent={dropGuideComponent}
												titleCloseButtonComponent={titleCloseButtonComponent}
												titleMoreButtonComponent={titleMoreButtonComponent}
												renderTitleMoreMenu={renderTitleMoreMenu}
												renderTitleMoreMenuItems={renderTitleMoreMenuItems}
												rootName={rootName}
											></FlexLayoutSplitScreenChild>
										</FlexLayoutContainer>
									),
								)}
							</>
						) : (
							<div></div>
						)}
						{centerDropTargetComponent.length != 0 ? (
							<>
								<FlexLayoutContainer
									containerName={`${(centerDropTargetComponent[activeIndex] || centerDropTargetComponent[0]).containerName}`}
									isInitialResizable
									isResizePanel={isSplit}
									key={
										(
											centerDropTargetComponent[
												activeIndex
											] || centerDropTargetComponent[0]
										).containerName
									}
								>
									{isSplit ? (
										<div data-key={screenKey}>
											<FlexLayoutSplitScreenChild
												parentDirection={direction}
												layoutName={`${layoutName}_center-${depth}`}
												parentLayoutName={layoutName}
												containerName={`${(centerDropTargetComponent[activeIndex] || centerDropTargetComponent[0]).containerName}`}
												depth={depth + 1}
												rootRef={rootRef}
												initialCenterComponents={centerDropTargetComponent.map(
													({
														navigationTitle,
														component,
														containerName: cName,
														dropDocumentOutsideOption,
														customData,
														screenKey:
															centerScreenKey,
													}) => ({
														navigationTitle,
														component,
														containerName: cName,
														dropDocumentOutsideOption,
														customData,
														screenKey:
															centerScreenKey,
													}),
												)}
												screenKey={screenKey}
												navigationTitleComponent={navigationTitleComponent}
												titleWrapperComponent={titleWrapperComponent}
												dropGuideComponent={dropGuideComponent}
												titleCloseButtonComponent={titleCloseButtonComponent}
												titleMoreButtonComponent={titleMoreButtonComponent}
												renderTitleMoreMenu={renderTitleMoreMenu}
												renderTitleMoreMenuItems={renderTitleMoreMenuItems}
												rootName={rootName}
											></FlexLayoutSplitScreenChild>
										</div>
									) : (
										<FlexLayoutSplitScreenScrollBox
											keyName={
												(
													centerDropTargetComponent[
														activeIndex
													] ||
													centerDropTargetComponent[0]
												).containerName
											}
										>
											{!isOnlyOneScreen && (
												<div
													className={`${styles["flex-split-screen-drag-box-title-wrapper-sticky"]}`}
												>
													<div
														data-is_split={isSplit}
														data-layout_name={
															layoutName
														}
														data-parent_layout_name={
															parentLayoutName
														}
														data-container_name={`${(centerDropTargetComponent[activeIndex] || centerDropTargetComponent[0]).containerName}`}
														data-flex-split-screen-title-layout-name={layoutName}
														className={`${styles["flex-split-screen-drag-box-title-wrapper"]}`}
													>
														<FlexLayoutSplitScreenScrollBox
															key={layoutName}
															keyName={layoutName}
															direction="x"
															className={
																styles[
																	"flex-split-screen-drag-box-title-container"
																]
															}
															data-layout_name={
																layoutName
															}
														>
															{centerDropTargetComponent.map(
																(
																	item,
																	index,
																) => (
																	<FlexLayoutSplitScreenDragBoxItem
																		onClose={() => closeCenterTab(index)}
																		key={
																			item.navigationTitle +
																			layoutName +
																			item.containerName
																		}
																		isActive={
																			activeIndex ===
																			index
																		}
																		layoutName={layoutName}
																		containerName={item.containerName}
																		titleWrapperComponent={titleWrapperComponent}
																		titleCloseButtonComponent={titleCloseButtonComponent}
																		onMove={moveCenterTab}
																	>
																		<FlexLayoutSplitScreenDragBox
																			screenKey={
																				item.screenKey
																			}
																			onClick={() => {
																				setActiveIndex(
																					index,
																				);
																			}}
																			containerName={
																				item.containerName
																			}
																			dropDocumentOutsideOption={
																				item.dropDocumentOutsideOption
																			}
																			targetComponent={
																				item.component
																			}
																			navigationTitle={
																				item.navigationTitle
																			}
																			customData={{
																				...item.customData,
																				__flexLayoutSplitScreenTitleLayoutName:
																					layoutName,
																				__flexLayoutSplitScreenTitleContainerName:
																					item.containerName,
																			}}
																			data-container-name={
																				item.containerName
																			}
																			data-layout-name={
																				layoutName
																			}
																			data-parent-layout-name={
																				parentLayoutName
																			}
																			dropEndCallback={({
																				x,
																				y,
																				containerName:
																					appendContainerName,
																			}) =>
																				//isDroppedInValidArea: boolean
																				{
																					if (
																						!rootRef.current ||
																						!layoutRef.current
																					)
																						return;

																					const isRootOver =
																						isOverDrop(
																							{
																								x,
																								y,
																								element:
																									rootRef.current,
																							},
																						);

																					const isLayoutInner =
																						isInnerDrop(
																							{
																								x,
																								y,
																								element:
																									layoutRef.current,
																							},
																						);

																					if (
																						(!isRootOver &&
																							!isLayoutInner) ||
																						(!isRootOver &&
																							isLayoutInner &&
																							centerDropTargetComponentRef
																								.current
																								.length >
																								1)
																					) {
																						const option =
																							{};
																						if (
																							centerDropTargetComponentRef
																								.current
																								.length >
																							1
																						) {
																							const {
																								adjacentItem,
																								adjacentIndex,
																							} =
																								getAdjacentItem(
																									centerDropTargetComponentRef.current,
																									activeIndexRef.current,
																								);

																							if (
																								adjacentItem &&
																								activeIndexRef.current ===
																									index
																							) {
																								//탭 이동이고 현재 활성화 된 탭인 경우우
																								Object.assign(
																									option,
																									{
																										x,
																										y,
																										targetComponent:
																											adjacentItem.component,
																										nextContainerName:
																											adjacentItem.containerName,
																										orderName:
																											"center",
																										dropTargetComponentEvent:
																											{
																												navigationTitle:
																													adjacentItem.navigationTitle,
																												dropDocumentOutsideOption:
																													adjacentItem.dropDocumentOutsideOption,
																												direction:
																													direction,
																												screenKey,
																												customData: adjacentItem.customData,
																											},
																									},
																								);
																							}
																						}
																						if (
																							index ===
																							0
																						) {
																							//이동하려는 탭이 첫번째일 때 (position = center)
																							dropMovementEventSubject.next(
																								{
																									state: "remove",
																									targetContainerName:
																										item.containerName,
																									targetParentLayoutName:
																										parentLayoutName,
																									targetLayoutName:
																										layoutName,
																									...option,
																								},
																							);
																						} else {
																							//이동하려는 탭이 첫번째가 아닐 때 (position = center > center)
																							dropMovementEventSubject.next(
																								{
																									state: "remove",
																									targetContainerName:
																										item.containerName,
																									targetParentLayoutName:
																										"",
																									targetLayoutName:
																										layoutName,
																									...option,
																								},
																							);
																						}
																					}
																				}
																			}
																		>
																			{navigationTitleComponent
																				? cloneElement(
																					navigationTitleComponent,
																					undefined,
																					item.navigationTitle,
																				)
																				: item.navigationTitle}
																		</FlexLayoutSplitScreenDragBox>
																	</FlexLayoutSplitScreenDragBoxItem>
																),
															)}
														</FlexLayoutSplitScreenScrollBox>
														<FlexLayoutSplitScreenDragBoxTitleMore
															rootName={rootName}
															layoutName={layoutName}
															containerName={containerName}
															screenKey={screenKey}
															activeItem={
																centerDropTargetComponent[activeIndex] ||
																centerDropTargetComponent[0]
															}
															activeIndex={activeIndex}
															items={centerDropTargetComponent}
															onCloseCurrentTab={() =>
																closeCenterTab(activeIndexRef.current)
															}
															onCloseOtherTabs={closeOtherCenterTabs}
															onCloseTabsToRight={closeRightCenterTabs}
															onCloseAllTabs={removeCurrentSplit}
															titleMoreButtonComponent={titleMoreButtonComponent}
															renderTitleMoreMenu={renderTitleMoreMenu}
															renderTitleMoreMenuItems={renderTitleMoreMenuItems}
														/>
													</div>
												</div>
											)}
											{(() => {
												const target =
													centerDropTargetComponent[
														activeIndex
													] ||
													centerDropTargetComponent[0];
												return target.component;
											})()}
										</FlexLayoutSplitScreenScrollBox>
									)}
								</FlexLayoutContainer>
							</>
						) : (
							<div></div>
						)}
						{afterDropTargetComponent.length != 0 ? (
							<>
								{afterDropTargetComponent.map(
									(
										{
											containerName: cName,
											component,
											navigationTitle,
											dropDocumentOutsideOption,
											customData,
											screenKey,
										},
										i,
									) => (
										<FlexLayoutContainer
											containerName={cName}
											isInitialResizable
											isResizePanel={
												i !==
												afterDropTargetComponent.length -
													1
											}
											key={cName}
										>
											<FlexLayoutSplitScreenChild
												parentDirection={direction}
												layoutName={`${layoutName}_after-${depth}`}
												parentLayoutName={layoutName}
												containerName={cName}
												depth={depth + 1}
												//isSplit={isSplit}
												rootRef={rootRef}
												screenKey={screenKey}
												initialCenterComponents={[
													{
														navigationTitle,
														component,
														containerName: cName,
														dropDocumentOutsideOption,
														customData,
														screenKey,
													},
												]}
												navigationTitleComponent={navigationTitleComponent}
												titleWrapperComponent={titleWrapperComponent}
												dropGuideComponent={dropGuideComponent}
												titleCloseButtonComponent={titleCloseButtonComponent}
												titleMoreButtonComponent={titleMoreButtonComponent}
												renderTitleMoreMenu={renderTitleMoreMenu}
												renderTitleMoreMenuItems={renderTitleMoreMenuItems}
												rootName={rootName}
											></FlexLayoutSplitScreenChild>
										</FlexLayoutContainer>
									),
								)}
							</>
						) : (
							<div></div>
						)}
					</FlexLayout>
					{boundaryContainerSize && (
						<div
							className={`${styles["flex-split-screen-boundary-container"]}`}
							style={{ ...boundaryContainerSize }}
						>
							{dropGuideComponent === undefined
								? "⬇️드롭하면 화면이 분할됩니다."
								: dropGuideComponent}
						</div>
					)}
				</div>
			)}
		</>
	);
}
