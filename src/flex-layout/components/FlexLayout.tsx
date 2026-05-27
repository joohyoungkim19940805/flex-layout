"use client";
import {
	Children,
	forwardRef,
	Fragment,
	isValidElement,
	ReactElement,
	ReactNode,
	useCallback,
	useMemo,
	useRef,
} from "react";
import { createRxStateTuple } from "@byeolnaerim/global-rx-state";
import { ContainerOpenCloseProvider } from "../providers/FlexLayoutHooks";
import styles from "../styles/FlexLayout.module.css";
import {
	FitContent,
	FlexLayoutChildrenType,
	FlexLayoutProps,
} from "../types/FlexLayoutTypes";

import { FlexLayoutProvider } from "../providers/FlexLayoutContext";

// const withFlexLayout =
// 	(
// 		layoutName: string,
// 		fitContent: "width" | "height",
// 		containerCount: number,
// 	) =>
// 	(WrappedComponent: ReactElement<FlexLayoutChildrenType>) => {
// 		if (
// 			WrappedComponent.type === Fragment ||
// 			WrappedComponent.type === "div" ||
// 			WrappedComponent.type === "span"
// 		) {
// 			return WrappedComponent; // Fragment는 수정 없이 반환
// 		}
// 		return cloneElement(WrappedComponent, {
// 			layoutName,
// 			fitContent,
// 			containerCount,
// 		} as Partial<FlexContainerProps>);
// 	};

const FlexLayout = forwardRef<HTMLDivElement, FlexLayoutProps>(
	function FlexLayout(
		{
			layoutName,
			direction,
			children,
			className,
			panelClassName,
			panelMovementMode = "divorce",
			scrollMode,
			rememberResize,
			...props
		},
		forwardedRef,
	) {
		const containerCount = Children.count(children);
		const fitContent =
			direction === "row" ? "width" : ("height" as FitContent);

		const resizeMemory = useMemo(() => {
			if (!rememberResize?.storage) {
				return undefined;
			}

			const [setGrowMap, getGrowMap, , , ready] = createRxStateTuple<
				Record<string, number>
			>(
				{},
				rememberResize.keyName ?? `__flexLayoutResizeGrow:${layoutName}`,
				{
					storage: rememberResize.storage,
					name: rememberResize.name,
					storeName: rememberResize.storeName,
					keyPrefix: rememberResize.keyPrefix,
				},
			);

			return {
				getGrowMap,
				setGrowMap,
				ready,
			};
		}, [
			layoutName,
			rememberResize?.keyName,
			rememberResize?.keyPrefix,
			rememberResize?.name,
			rememberResize?.storage,
			rememberResize?.storeName,
		]);

		const innerRef = useRef<HTMLDivElement | null>(null);
		const setLayoutRef = useCallback(
			(node: HTMLDivElement | null) => {
				innerRef.current = node;

				if (typeof forwardedRef === "function") {
					forwardedRef(node);
					return;
				}

				if (forwardedRef) {
					forwardedRef.current = node;
				}
			},
			[forwardedRef],
		);
		// Flatten children and unwrap Fragments
		type FragmentElement = ReactElement<
			{ children?: ReactNode },
			typeof Fragment
		>;
		const isFragmentElement = (node: ReactNode): node is FragmentElement =>
			isValidElement(node) && node.type === Fragment;

		// ...

		// Flatten children and unwrap Fragments (타입 안전)
		const nodes = Children.toArray(children).flatMap((node) =>
			isFragmentElement(node)
				? Children.toArray(node.props.children)
				: [node],
		);

		// 엘리먼트만 남기고, props 타입을 FlexLayoutChildrenType으로 고정
		const flattenedChildren = nodes.filter(
			isValidElement,
		) as ReactElement<FlexLayoutChildrenType>[];

		// useEffect(() => {
		// 	if (!innerRef.current) return;
		// 	const containers = [...(innerRef.current.children || [])].filter(
		// 		(el) => (el as HTMLElement).hasAttribute("data-container_name"),
		// 	) as HTMLElement[];
		// 	let notGrowList: Array<HTMLElement> = [];
		// 	let remainingGrow = containers.reduce((t, item, i) => {
		// 		if (
		// 			item.hasAttribute("data-grow") == false ||
		// 			item.getAttribute("data-is_resize") === "true"
		// 		) {
		// 			notGrowList.push(item);
		// 			return t;
		// 		}
		// 		let grow = parseFloat(item.dataset.grow || "");
		// 		item.style.flex = `${grow} 1 0%`;
		// 		t -= grow;
		// 		return t;
		// 	}, containers.length);
		// 	if (notGrowList.length != 0) {
		// 		let resizeWeight = mathWeight(
		// 			notGrowList.length,
		// 			remainingGrow,
		// 		);
		// 		notGrowList.forEach((e) => {
		// 			e.dataset.grow = resizeWeight.toString();
		// 			e.style.flex = `${resizeWeight} 1 0%`;
		// 		});
		// 	}
		// }, [containerCount]);

		const contextValue = useMemo(
			() => ({
				layoutName,
				direction,
				panelMovementMode,
				panelClassName,
				containerCount,
				fitContent,
				resizeMemory,
			}),
			[
				layoutName,
				direction,
				panelMovementMode,
				panelClassName,
				containerCount,
				fitContent,
				resizeMemory,
			],
		);

		if (flattenedChildren.length === 0) {
			return null;
		}

		//if (!childrenTemplate) return null;

		return (
			<>
				<FlexLayoutProvider value={contextValue}>
					<div
						ref={setLayoutRef}
						className={`${styles["flex-layout"]} ${className && className !== "" ? className : ""}`}
						{...props}
						data-scroll-mode={scrollMode}
						data-layout_name={layoutName}
						data-direction={direction}
					>
						{flattenedChildren.map((child, index) => {
							if (!child || !isValidElement(child)) return null;
							//const key = child.key || `flex-child-${index}`;
							// const wrappedChild = withFlexLayout(
							//     layoutName,
							//     fitContent,
							//     containerCount
							// )(child);
							return (
								<Fragment
									key={child.props.containerName ?? index}
								>
									{child}
									{/*wrappedChild*/}
									{/*<FlexLayoutContainer
                                {...containerProps}
                                fitContent={fitContent}
                                containerCount={
                                    (children && children.length) || 0
                                }
                                layoutName={props.layoutName}
                            >
                                {child}
                            </FlexLayoutContainer>*/}
									{/* 클라이언트 사이드에서만 리사이즈 패널 처리 */}
									<ContainerOpenCloseProvider
										layoutName={layoutName}
										containerName={
											child.props.containerName
										}
										sizeName={fitContent}
									></ContainerOpenCloseProvider>
								</Fragment>
							);
						})}
					</div>
				</FlexLayoutProvider>
			</>
		);
	},
);
export default FlexLayout;
