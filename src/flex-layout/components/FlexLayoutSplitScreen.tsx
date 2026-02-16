"use client";
import {
	cloneElement,
	ReactElement,
	RefObject,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	dropMovementEventSubject,
	DropPositionOrderName,
	DropTargetComponent,
} from "../hooks/useDrag";
import { useFlexLayoutSplitScreen } from "../hooks/useFlexLayoutSplitScreen";
import {
	getCurrentSplitScreenComponents,
	getSplitScreen,
	removeSplitScreenChild,
	resetRootSplitScreen,
	setSplitScreen,
} from "../store/FlexLayoutContainerStore";
import styles from "../styles/FlexLayout.module.css";
import FlexLayout from "./FlexLayout";
import FlexLayoutContainer from "./FlexLayoutContainer";
import FlexLayoutSplitScreenDragBox, {
	DropDocumentOutsideOption,
} from "./FlexLayoutSplitScreenDragBox";

import equal from "fast-deep-equal";
import { distinctUntilChanged, take } from "rxjs";
import FlexLayoutSplitScreenDragBoxContainer from "./FlexLayoutSplitScreenDragBoxContainer";
import FlexLayoutSplitScreenDragBoxItem from "./FlexLayoutSplitScreenDragBoxItem";
import FlexLayoutSplitScreenDragBoxTitleMore from "./FlexLayoutSplitScreenDragBoxTitleMore";
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
	screenKey = Array.from(
		window.crypto.getRandomValues(new Uint32Array(16)),
		(e) => e.toString(32).padStart(2, "0"),
	).join(""),
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
		screenKey:
			screenKey ||
			Array.from(
				window.crypto.getRandomValues(new Uint32Array(16)),
				(e) => e.toString(32).padStart(2, "0"),
			).join(""),
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
	dropDocumentOutsideOption?: DropDocumentOutsideOption;
	screenKey?: string;
};

export default function FlexLayoutSplitScreen({
	children,
	containerName,
	layoutName,
	navigationTitle,
	dropDocumentOutsideOption,
	screenKey,
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

	useEffect(() => {
		resetRootSplitScreen(layoutName);
		const subscribe = getSplitScreen(layoutName, layoutName)
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
					}
				} else {
					// const screenKey = Array.from(
					//     window.crypto.getRandomValues(new Uint32Array(16)),
					//     e => e.toString(32).padStart(2, '0')
					// ).join('');
					setSplitScreen(layoutName, layoutName, {
						afterDropTargetComponent: [],
						beforeDropTargetComponent: [],
						centerDropTargetComponent: [
							{
								containerName,
								component: children,
								navigationTitle,
								dropDocumentOutsideOption,
								screenKey: screenKey
									? screenKey
									: Array.from(
											window.crypto.getRandomValues(
												new Uint32Array(16),
											),
											(e) =>
												e.toString(32).padStart(2, "0"),
										).join(""),
							},
						],
						direction: direction,
					});
				}
			});

		return () => {
			subscribe.unsubscribe();
			resetRootSplitScreen(layoutName);
		};
	}, [layoutName]);

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
													screenKey:
														centerDropTargetComponent[0]
															.screenKey,
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
												screenKey,
											},
										]}
										rootName={layoutName}
									></FlexLayoutSplitScreenChild>
								</FlexLayoutContainer>
							),
						)}
					</>
				) : (
					<div></div>
				)}
				{centerDropTargetComponent.length === 0 ? (
					<div></div>
				) : (
					<FlexLayoutContainer
						containerName={`${centerDropTargetComponent[0].containerName}`}
						isInitialResizable
						isResizePanel={isSplit}
					>
						{isSplit ? (
							<FlexLayoutSplitScreenChild
								parentDirection={direction}
								layoutName={`${layoutName}_center`}
								parentLayoutName={layoutName}
								containerName={`${centerDropTargetComponent[0].containerName}`}
								depth={0}
								rootRef={layoutRef}
								screenKey={
									centerDropTargetComponent[0].screenKey
								}
								initialCenterComponents={[
									{
										navigationTitle:
											centerDropTargetComponent[0]
												.navigationTitle,
										component:
											centerDropTargetComponent[0]
												.component,
										containerName:
											centerDropTargetComponent[0]
												.containerName,
										dropDocumentOutsideOption:
											centerDropTargetComponent[0]
												.dropDocumentOutsideOption,
										screenKey:
											centerDropTargetComponent[0]
												.screenKey,
									},
								]}
								rootName={layoutName}
							></FlexLayoutSplitScreenChild>
						) : (
							<FlexLayoutSplitScreenScrollBox
								keyName={
									centerDropTargetComponent[0].containerName
								}
								isDefaultScrollStyle={true}
							>
								{centerDropTargetComponent[0].component}
							</FlexLayoutSplitScreenScrollBox>
						)}
					</FlexLayoutContainer>
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
												screenKey,
											},
										]}
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
					⬇️드롭하면 화면이 분할됩니다.
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

	const [isEmptyContent, setIsEmptyContent] = useState<boolean>(false);
	const [activeIndex, setActiveIndex] = useState<number>(0);
	const centerDropTargetComponentRef = useRef(centerDropTargetComponent);
	const activeIndexRef = useRef(activeIndex);
	useEffect(() => {
		const subscribe = getSplitScreen(rootName, `${layoutName}=${screenKey}`)
			.pipe(take(1))
			.subscribe((layoutInfo) => {
				setSplitScreen(rootName, `${layoutName}=${screenKey}`, {
					afterDropTargetComponent:
						layoutInfo?.afterDropTargetComponent || [],
					beforeDropTargetComponent:
						layoutInfo?.beforeDropTargetComponent || [],
					centerDropTargetComponent:
						layoutInfo?.centerDropTargetComponent ||
						initialCenterComponents ||
						[],
					direction: layoutInfo?.direction || direction,
				});
			});
		return () => {
			removeSplitScreenChild(rootName, layoutName);
			subscribe.unsubscribe();
		};
	}, [rootName, layoutName, initialCenterComponents]);
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
		};
	}, [rootName, layoutName]);

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
	const [isOnlyOneScreen, setIsOnlyOneScreen] = useState<boolean>(false);
	// useEffect(() => {
	//     const subscribe = allSplitScreenCount.subscribe(allSplitScreenCount => {
	//         setIsOnlyOneScreen(allSplitScreenCount === 1);
	//     });
	//     return () => subscribe.unsubscribe();
	// }, []);

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
														screenKey,
													},
												]}
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
														screenKey:
															centerScreenKey,
													}) => ({
														navigationTitle,
														component,
														containerName: cName,
														dropDocumentOutsideOption,
														screenKey:
															centerScreenKey,
													}),
												)}
												screenKey={screenKey}
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
											isDefaultScrollStyle={true}
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
														className={`${styles["flex-split-screen-drag-box-title-wrapper"]}`}
													>
														<FlexLayoutSplitScreenDragBoxContainer
															key={layoutName}
															data-layout_name={
																layoutName
															}
															layoutName={
																layoutName
															}
														>
															{centerDropTargetComponent.map(
																(
																	item,
																	index,
																) => (
																	<FlexLayoutSplitScreenDragBoxItem
																		onClose={(
																			ev,
																		) => {
																			if (
																				activeIndexRef.current ===
																					index &&
																				centerDropTargetComponent.length ===
																					1
																			) {
																				dropMovementEventSubject.next(
																					{
																						state: "remove",
																						targetContainerName:
																							containerName,
																						targetParentLayoutName:
																							parentLayoutName,
																						targetLayoutName:
																							layoutName,
																					},
																				);
																			} else {
																				if (
																					centerDropTargetComponent.length ===
																					activeIndexRef.current +
																						1
																				) {
																					setActiveIndex(
																						activeIndexRef.current -
																							1,
																					);
																				}
																				setCenterDropTargetComponent(
																					(
																						prev,
																					) => {
																						const result =
																							handleRemove(
																								prev,
																								item.containerName,
																								() => {},
																							);
																						return result;
																					},
																				);
																			}
																		}}
																		key={
																			item.navigationTitle +
																			layoutName +
																			item.containerName
																		}
																		isActive={
																			activeIndex ===
																			index
																		}
																	>
																		<FlexLayoutSplitScreenDragBox
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
																			{
																				item.navigationTitle
																			}
																		</FlexLayoutSplitScreenDragBox>
																	</FlexLayoutSplitScreenDragBoxItem>
																),
															)}
														</FlexLayoutSplitScreenDragBoxContainer>
														<FlexLayoutSplitScreenDragBoxTitleMore></FlexLayoutSplitScreenDragBoxTitleMore>
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
														screenKey,
													},
												]}
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
							⬇️드롭하면 화면이 분할됩니다.
						</div>
					)}
				</div>
			)}
		</>
	);
}
