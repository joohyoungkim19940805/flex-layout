"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { DropTargetComponent } from "../hooks/useDrag";

export interface FlexLayoutSplitScreenRuntimeContextValue {
	registerRoot: (
		layoutName: string,
		getRootComponent: () => DropTargetComponent,
	) => () => void;
	isRestoringRoot?: (layoutName: string) => boolean;
}

const FlexLayoutSplitScreenRuntimeContext =
	createContext<FlexLayoutSplitScreenRuntimeContextValue | null>(null);

export function FlexLayoutSplitScreenRuntimeProvider({
	children,
	value,
}: {
	children: ReactNode;
	value: FlexLayoutSplitScreenRuntimeContextValue;
}) {
	return (
		<FlexLayoutSplitScreenRuntimeContext.Provider value={value}>
			{children}
		</FlexLayoutSplitScreenRuntimeContext.Provider>
	);
}

export function useFlexLayoutSplitScreenRuntimeContext() {
	return useContext(FlexLayoutSplitScreenRuntimeContext);
}
