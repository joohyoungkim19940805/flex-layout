"use client";
import {
	Children,
	Fragment,
	isValidElement,
	ReactElement,
	ReactNode,
	useEffect,
	useRef,
} from "react";
import { ContainerOpenCloseProvider } from "../providers/FlexLayoutHooks";
import styles from "../styles/FlexLayout.module.css";
import {
	FlexLayoutChildrenType,
	FlexLayoutProps,
} from "../types/FlexLayoutTypes";

import { useSize } from "../hooks/useSizes";
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
	const fitContent = direction === "row" ? "width" : "height";
	const prevLayoutSizeRef = useRef<number | undefined>(undefined);
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

	const hasFitResizeContainer = flattenedChildren.some(
		(child) => child.props.isFitResize,
	);

	useEffect(() => {
		const prevSize = prevLayoutSizeRef.current;
		prevLayoutSizeRef.current = size;

		if (!size) return;
		if (!hasFitResizeContainer) return;
		if (!prevSize || prevSize <= 0) return;
		if (Math.abs(prevSize - size) < 0.001) return;

		[...(ref.current?.children || [])].filter((el) =>
			(el as HTMLElement).hasAttribute("data-container_name"),
		) as HTMLElement[];
	}, [size, hasFitResizeContainer, ref]);

	if (flattenedChildren.length === 0) {
		return null;
	}

	//if (!childrenTemplate) return null;

	return (
		<>
			<FlexLayoutProvider
				value={{
					layoutName,
					direction,
					panelMovementMode,
					panelClassName,
					containerCount,
					fitContent,
				}}
			>
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
