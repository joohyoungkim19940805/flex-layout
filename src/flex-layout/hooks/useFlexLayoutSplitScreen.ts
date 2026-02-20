// useFlexLayoutSplitScreen.js
import { useEffect, useRef, useState } from "react";
import {
	dropMovementEventSubject,
	DropTargetComponent,
	useDragCapture,
} from "./useDrag";

export function useFlexLayoutSplitScreen({
	isSplitInitial = false,
	parentDirection,
	directionInitial = "row",
	selfContainerName,
	parentLayoutName,
	layoutName,
}: {
	isSplitInitial: boolean;
	parentDirection?: "row" | "column" | null;
	directionInitial: "row" | "column";
	selfContainerName: string;
	parentLayoutName: string;
	layoutName: string;
}) {
	const [direction, setDirection] = useState<"row" | "column">(
		directionInitial,
	);

	const [isSplit, setIsSplit] = useState<boolean>(isSplitInitial);
	const [boundaryContainerSize, setBoundaryContainerSize] = useState<{
		left: string;
		top: string;
		width: string;
		height: string;
	} | null>(null);
	const [centerDropTargetComponent, setCenterDropTargetComponent] = useState<
		DropTargetComponent[]
	>([]);
	const [afterDropTargetComponent, setAfterDropTargetComponent] = useState<
		DropTargetComponent[]
	>([]);
	const [beforeDropTargetComponent, setBeforeDropTargetComponent] = useState<
		DropTargetComponent[]
	>([]);
	const layoutRef = useRef<HTMLDivElement>(null);

	const dragState = useDragCapture(layoutRef);

	useEffect(() => {
		if (!dragState) {
			setBoundaryContainerSize(null);
			return;
		}
		const {
			isDrop,
			isDragging,
			positionName,
			containerName,
			children: dropComponent,
			isOver,
			navigationTitle,
			dropEndCallback,
			x,
			y,
			screenKey,
		} = dragState;

		const orderName =
			positionName === "leftBoundary" || positionName === "topBoundary"
				? "before"
				: positionName === "rightBoundary" ||
					  positionName === "bottomBoundary"
					? "after"
					: "center";
		// if (selfContainerName === containerName) {
		//     setBoundaryContainerSize(null);
		//     return;
		// }

		if ((isOver || isDrop) && boundaryContainerSize) {
			setBoundaryContainerSize(null);
		}

		if (
			selfContainerName === containerName ||
			selfContainerName.startsWith(containerName + "_")
		) {
			return;
		}

		if (isDrop && screenKey) {
			// if (isDuplication) {
			//     setDuplicationInfo({ isDuplication, containerName });
			// }
			// console.log('isDuplication:::', isDuplication);
			const dropDirection =
				positionName === "leftBoundary" ||
				positionName === "rightBoundary"
					? "row"
					: "column";
			// if (!parentDirection) {
			//     console.log(isSplit, positionName !== 'centerBoundary', isOver);
			// }
			if (
				!isSplit &&
				!isOver
				//!isDuplication
			) {
				//setDirection(dropDirection);
				//if (positionName !== 'centerBoundary') {
				if (
					positionName !== "centerBoundary" &&
					dropDirection !== parentDirection
				) {
					setIsSplit(true);
					setDirection(dropDirection);
				}
				dropMovementEventSubject.next({
					state: "append",
					targetContainerName: containerName,
					targetParentLayoutName: parentLayoutName,
					targetLayoutName: layoutName,
					targetComponent: dropComponent,
					orderName,
					x,
					y,
					dropEndCallback,
					dropTargetComponentEvent: {
						navigationTitle,
						dropDocumentOutsideOption:
							dragState?.dropDocumentOutsideOption,
						direction: dropDirection,
						screenKey,
					},
				});
				// } else {
				//     dropMovementEventSubject.next({
				//         state: 'append',
				//         targetContainerName: containerName,
				//         targetParentLayoutName: parentLayoutName,
				//         targetLayoutName: layoutName,
				//         targetComponent: dropComponent,
				//         orderName: orderName,
				//         x,
				//         y,
				//         dropEndCallback,
				//         dropTargetComponentEvent: {
				//             navigationTitle,
				//             dropDocumentOutsideOption:
				//                 dragState?.dropDocumentOutsideOption,
				//             direction: direction,
				//         },
				//     });
				// }
			}
			// else if (
			//     isSplit &&
			//     positionName !== 'centerBoundary' &&
			//     !isOver
			// ) {
			//     if (!isFirstSplitUpdatedRef.current) {
			//         isFirstSplitUpdatedRef.current = true;
			//         return;
			//     }
			//     updateDropTargetComponents(
			//         positionName,
			//         containerName,
			//         dropComponent
			//     );
			// }
		}
		if (isDragging && !isSplit && !isOver) {
			const newSize = {
				left: positionName === "rightBoundary" ? "50%" : "0",
				top: positionName === "bottomBoundary" ? "50%" : "0",
				width:
					positionName === "leftBoundary" ||
					positionName === "rightBoundary"
						? "50%"
						: "100%",
				height:
					positionName === "topBoundary" ||
					positionName === "bottomBoundary"
						? "50%"
						: "100%",
			};
			// 이전 상태와 비교
			if (
				JSON.stringify(boundaryContainerSize) !==
				JSON.stringify(newSize)
			) {
				setBoundaryContainerSize(newSize);
			}
		}
	}, [
		dragState,
		isSplit,
		boundaryContainerSize,
		parentLayoutName,
		layoutName,
		selfContainerName,
		direction,
	]);
	return {
		direction,
		setDirection,
		isSplit,
		setIsSplit,
		boundaryContainerSize,
		//setBoundaryContainerSize,
		centerDropTargetComponent,
		afterDropTargetComponent,
		beforeDropTargetComponent,
		setAfterDropTargetComponent,
		setBeforeDropTargetComponent,
		setCenterDropTargetComponent,
		//dropTargetComponent,
		//setDropTargetComponent,
		//setDropPosition,
		isOver: dragState?.isOver,
		layoutRef,
	};
}
