"use client";
import equal from "fast-deep-equal";
import { RefObject } from "react";
import { BehaviorSubject, combineLatest } from "rxjs";
import { distinctUntilChanged, filter, map } from "rxjs/operators";
import { DropTargetComponent } from "../hooks/useDrag";

/**
 * 이전 값과 새 값이 동일하지 않을 때만 store를 업데이트하는 유틸 함수
 */
function updateScrollStore<T>(subject: BehaviorSubject<T>, newValue: T) {
	const currentValue = subject.getValue();
	// deep 비교를 통해 실제 변경이 있는 경우만 next
	if (!equal(currentValue, newValue)) {
		subject.next(newValue);
	}
}

function updateSplitScreenStore(newValue: LayoutSplitScreenState) {
	// const prevValue = layoutSplitScreenStore.getValue();
	// deep-equal 로 비교
	// if (!equal(prevValue, newValue)) {
	layoutSplitScreenStore.next(newValue);
	// }
}

// 구독 시 이전 상태들을 축적하여 관리
// const stateWithHistory$ = flexContainerStore.pipe(
//     scan((acc, newState) => [...acc, newState], [] as RefStore[])
// );

export interface ScrollPosition {
	x: number;
	y: number;
}

export const scrollPositions: Record<string, ScrollPosition> = {};

const scrollPositionsSubject = new BehaviorSubject<
	Record<string, ScrollPosition>
>(scrollPositions);

/**
 * 스크롤 위치 업데이트 함수
 *
 * 기존: 항상 store.next()가 호출됨 → 바뀌지 않았다면 건너뛰도록 변경
 */
export const setScrollPosition = (
	layoutName: string,
	position: ScrollPosition,
) => {
	const current = scrollPositionsSubject.getValue();
	const prevPos = current[layoutName];

	// x, y 모두 동일하면 업데이트할 필요가 없으므로 조기 반환
	if (prevPos && prevPos.x === position.x && prevPos.y === position.y) {
		return;
	}

	// 변경사항이 있으면 새 객체를 만들어 넘김
	const newPositions = {
		...current,
		[layoutName]: position,
	};

	updateScrollStore(scrollPositionsSubject, newPositions);
};

/**
 * 스크롤 위치 구독
 */
export const getScrollPosition = (layoutName: string) => {
	return scrollPositionsSubject.pipe(
		// 해당 layoutName이 정의되지 않았을 때는 제외
		filter((e) => e[layoutName] !== undefined),
		map((positions) => positions[layoutName]),
		distinctUntilChanged(
			(prev, curr) => prev?.x === curr?.x && prev?.y === curr?.y,
		),
	);
};
export const removeScrollPosition = (layoutName: string) => {
	const current = scrollPositionsSubject.getValue();
	const { [layoutName]: _, ...rest } = current;
	updateScrollStore(scrollPositionsSubject, rest);
};

export type SplitScreenComponents = {
	afterDropTargetComponent: DropTargetComponent[];
	beforeDropTargetComponent: DropTargetComponent[];
	centerDropTargetComponent: DropTargetComponent[];
	direction: "row" | "column";
};

export type LayoutSplitScreenState = Record<
	string,
	Record<string, SplitScreenComponents>
>;

export const layoutSplitScreenStore =
	new BehaviorSubject<LayoutSplitScreenState>({});

export const setSplitScreen = (
	rootName: string,
	layoutName: string,
	newComponents: SplitScreenComponents,
) => {
	const current = layoutSplitScreenStore.getValue();
	const updatedLayout = { ...(current[rootName] || {}) };
	updatedLayout[layoutName] = newComponents;

	const newStoreValue = {
		...current,
		[rootName]: updatedLayout,
	};
	updateSplitScreenStore(newStoreValue);
};

export const resetRootSplitScreen = (rootName: string) => {
	const current = layoutSplitScreenStore.getValue();
	// rootName 아래만 초기화
	const newStoreValue = {
		...current,
		[rootName]: {},
	};
	updateSplitScreenStore(newStoreValue);
};

export const removeRootSplitScreen = (rootName: string) => {
	const current = layoutSplitScreenStore.getValue();
	if (!current[rootName]) return;
	const { [rootName]: _, ...rest } = current;
	updateSplitScreenStore(rest);
};

export const removeSplitScreenChild = (
	rootName: string,
	layoutName: string,
) => {
	const current = layoutSplitScreenStore.getValue();
	if (!current[rootName]) return;

	const updatedLayout = { ...current[rootName] };
	delete updatedLayout[layoutName];

	const newStoreValue = {
		...current,
		[rootName]: updatedLayout,
	};
	updateSplitScreenStore(newStoreValue);
};

export const getCurrentSplitScreenComponents = (
	rootName: string,
	layoutName: string,
) => {
	const current = layoutSplitScreenStore.getValue();
	if (!current[rootName]) return;
	return current[rootName][layoutName];
};

export const getSplitScreen = (rootName: string, layoutName: string) => {
	return layoutSplitScreenStore.pipe(
		map((splitScreen) => splitScreen[rootName]?.[layoutName]),
		distinctUntilChanged((prev, curr) => {
			// 이전 상태와 현재 상태를 비교하여 동일하면 필터링
			const filterChildren = (obj: any) => {
				// 객체 복사 후 children 속성 제거
				const { children, component, targetComponent, x, y, ...rest } =
					obj || {};
				return rest;
			};
			return equal(filterChildren(prev), filterChildren(curr));
		}),
	);
};

// 중첩된 객체 구조로 ref를 관리하는 타입
type RefStore = {
	[layoutName: string]: {
		[containerName: string]: RefObject<HTMLElement | null>;
	};
};

// 초기값으로 빈 객체를 설정한 BehaviorSubject 생성
export const flexContainerStore = new BehaviorSubject<RefStore>({});

export const flexResizePanelStore = new BehaviorSubject<RefStore>({});
/**
 * ref를 업데이트하는 함수
 * - 기존: 무조건 next() → 새/이전 상태 비교 후 다를 경우에만 next()
 */
export const setContainerRef = <T extends HTMLElement>(
	layoutName: string,
	containerName: string,
	ref: RefObject<T | null> | null,
) => {
	const currentRefs = flexContainerStore.getValue();
	const layoutRefs = currentRefs[layoutName] || {};

	if (ref === null) {
		if (!(containerName in layoutRefs)) return; //
		const { [containerName]: _, ...restLayout } = layoutRefs;
		const next =
			Object.keys(restLayout).length === 0
				? (() => {
						const { [layoutName]: __, ...rest } = currentRefs;
						return rest;
					})()
				: { ...currentRefs, [layoutName]: restLayout };
		flexContainerStore.next(next);
		return;
	}

	if (layoutRefs[containerName] === ref) return; // 동일 ref면 skip

	flexContainerStore.next({
		...currentRefs,
		[layoutName]: { ...layoutRefs, [containerName]: ref },
	});
};

export const setResizePanelRef = <T extends HTMLElement>(
	layoutName: string,
	containerName: string,
	ref: RefObject<T | null> | null,
) => {
	const currentRefs = flexResizePanelStore.getValue();
	const layoutRefs = currentRefs[layoutName] || {};

	if (ref === null) {
		if (!(containerName in layoutRefs)) return; //
		const { [containerName]: _, ...restLayout } = layoutRefs;
		const next =
			Object.keys(restLayout).length === 0
				? (() => {
						const { [layoutName]: __, ...rest } = currentRefs;
						return rest;
					})()
				: { ...currentRefs, [layoutName]: restLayout };
		flexResizePanelStore.next(next);
		return;
	}

	if (layoutRefs[containerName] === ref) return; // 동일 ref면 skip

	flexResizePanelStore.next({
		...currentRefs,
		[layoutName]: { ...layoutRefs, [containerName]: ref },
	});
};

export const getLayoutInfos = (layoutName: string) => {
	return combineLatest([flexContainerStore, flexResizePanelStore]).pipe(
		map(([containerRefs, resizePanelRefs]) => {
			// 두 Store에서 layoutName에 해당하는 값을 병합
			const containerData = containerRefs[layoutName] || {};
			const resizePanelData = resizePanelRefs[layoutName] || {};

			// container와 resizePanel 데이터 합치기
			return {
				container: containerData,
				resizePanel: resizePanelData,
			};
		}),
		filter(
			(result) =>
				result.container !== null &&
				Object.keys(result.container).length > 0,
		), // 빈 객체 제외
	);
};

// 특정 containerName의 ref를 구독하는 함수
// layoutName이 지정되지 않으면 전체 layout에서 해당하는 containerName의 ref를 찾음
export const getContainerRef = ({
	containerName,
	layoutName,
}: {
	containerName: string;
	layoutName?: string;
}) => {
	return flexContainerStore.pipe(
		map((refs: RefStore) => {
			if (layoutName) {
				// 지정된 layoutName에서 해당 containerName의 ref 반환
				return refs[layoutName]?.[containerName] || null;
			} else {
				// 모든 layout에서 해당 containerName의 ref 찾기
				return Object.entries(refs).find(
					([key, value]) => refs[key][containerName],
				)?.[1][containerName];
			}
			// else {
			//     // 모든 layout에서 해당 containerName의 ref 찾기
			//     for (const layout in refs) {
			//         if (refs[layout][containerName]) {
			//             return refs[layout][containerName];
			//         }
			//     }
			//     return null;
			// }
		}),
		filter((ref) => ref !== null),
	);
};

export const getResizePanelRef = ({
	containerName,
	layoutName,
}: {
	containerName: string;
	layoutName?: string;
}) => {
	return flexResizePanelStore.pipe(
		map((refs: RefStore) => {
			if (layoutName) {
				// 지정된 layoutName에서 해당 containerName의 ref 반환
				return refs[layoutName]?.[containerName] || null;
			} else {
				// 모든 layout에서 해당 containerName의 ref 찾기
				return Object.entries(refs).find(
					([key, value]) => refs[key][containerName],
				)?.[1][containerName];
			}
			// else {
			//     // 모든 layout에서 해당 containerName의 ref 찾기
			//     for (const layout in refs) {
			//         if (refs[layout][containerName]) {
			//             return refs[layout][containerName];
			//         }
			//     }
			//     return null;
			// }
		}),
		filter((ref) => ref !== null),
	);
};
