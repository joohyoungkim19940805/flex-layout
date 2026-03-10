"use client";
import {
	Children,
	Fragment,
	isValidElement,
	ReactElement,
	ReactNode,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
} from "react";
import { ContainerOpenCloseProvider } from "../providers/FlexLayoutHooks";
import styles from "../styles/FlexLayout.module.css";
import {
	FitContent,
	FlexLayoutChildrenType,
	FlexLayoutProps,
} from "../types/FlexLayoutTypes";

import { useSize } from "../hooks/useSizes";
import { FlexLayoutProvider } from "../providers/FlexLayoutContext";
import { getGrow, mathGrow, mathWeight } from "../utils";

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

export default function FlexLayout({
	layoutName,
	direction,
	children,
	className,
	panelClassName,
	panelMovementMode = "divorce",
	scrollMode,
	...props
}: FlexLayoutProps) {
	const containerCount = Children.count(children);
	const fitContent = direction === "row" ? "width" : ("height" as FitContent);
	const prevLayoutSizeRef = useRef<number | undefined>(undefined);
	const fitRaf = useRef(0);
	const { ref, size } = useSize(fitContent);

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

	useEffect(() => {
		if (
			typeof document === "undefined" ||
			document.readyState !== "complete"
		)
			return;
		const containers = [...(ref.current?.children || [])].filter((el) =>
			(el as HTMLElement).hasAttribute("data-container_name"),
		) as HTMLElement[];
		let notGrowList: Array<HTMLElement> = [];
		let remainingGrow = containers.reduce((t, item, i) => {
			if (
				item.hasAttribute("data-grow") == false ||
				item.getAttribute("data-is_resize") === "true"
			) {
				notGrowList.push(item);
				return t;
			}
			let grow = parseFloat(item.dataset.grow || "");
			item.style.flex = `${grow} 1 0%`;
			t -= grow;
			return t;
		}, containers.length);
		if (notGrowList.length != 0) {
			let resizeWeight = mathWeight(notGrowList.length, remainingGrow);
			notGrowList.forEach((e) => {
				e.dataset.grow = resizeWeight.toString();
				e.style.flex = `${resizeWeight} 1 0%`;
			});
		}
	}, [children, ref]);

	const runLayoutResize = useCallback(() => {
		if (
			typeof document === "undefined" ||
			document.readyState !== "complete"
		)
			return;

		if (!size) return;

		if (prevLayoutSizeRef.current === undefined) {
			prevLayoutSizeRef.current = size;
			return;
		}

		const prevSize = prevLayoutSizeRef.current;
		prevLayoutSizeRef.current = size;

		if (!prevSize || prevSize <= 0) return;
		if (Math.abs(prevSize - size) < 0.1) return;

		const containers = [...(ref.current?.children || [])].filter((el) =>
			(el as HTMLElement).hasAttribute("data-container_name"),
		) as HTMLElement[];

		containers.forEach((e) => {
			const containerGrow = getGrow(e);
			const containerSize = size * (containerGrow / containers.length);
			const nextGrow = mathGrow(containerSize, size, containers.length);

			e.dataset.grow = `${nextGrow}`;
			e.style.flex = `${nextGrow} 1 0%`;
		});
	}, [size, ref]);

	const requestLayoutResize = useCallback(() => {
		if (fitRaf.current) cancelAnimationFrame(fitRaf.current);

		fitRaf.current = requestAnimationFrame(() => {
			fitRaf.current = 0;
			runLayoutResize();
		});
	}, [runLayoutResize]);

	useLayoutEffect(() => {
		requestLayoutResize();

		return () => {
			if (fitRaf.current) {
				cancelAnimationFrame(fitRaf.current);
				fitRaf.current = 0;
			}
		};
	}, [size, requestLayoutResize]);

	const contextValue = useMemo(
		() => ({
			layoutName,
			direction,
			panelMovementMode,
			panelClassName,
			containerCount,
			fitContent,
			requestLayoutResize,
		}),
		[
			layoutName,
			direction,
			panelMovementMode,
			panelClassName,
			containerCount,
			fitContent,
			requestLayoutResize,
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
					className={`${styles["flex-layout"]} ${className && className !== "" ? className : ""}`}
					ref={ref}
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
							<Fragment key={child.props.containerName ?? index}>
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
									containerName={child.props.containerName}
									sizeName={fitContent}
								></ContainerOpenCloseProvider>
							</Fragment>
						);
					})}
				</div>
			</FlexLayoutProvider>
		</>
	);
}
