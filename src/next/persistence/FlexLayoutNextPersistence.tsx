"use client";

import type { LayoutSplitScreenState, SplitScreenComponents } from "../../flex-layout/store/FlexLayoutContainerStore";
import type { DropTargetComponent } from "../../flex-layout/hooks/useDrag";
import FlexLayoutNextPane from "../components/FlexLayoutNextPane";

export const FLEX_LAYOUT_NEXT_PROVIDER_ID = "__flexLayoutNextProviderId";
export const FLEX_LAYOUT_NEXT_URL = "__flexLayoutNextUrl";
export const FLEX_LAYOUT_NEXT_PERSISTABLE = "__flexLayoutNextPersistable";

export type FlexLayoutNextPersistedPane =
	| {
			kind: "root";
			screenKey: string;
	  }
	| {
			kind: "next-url";
			containerName: string;
			navigationTitle?: string;
			dropDocumentOutsideOption?: DropTargetComponent["dropDocumentOutsideOption"];
			screenKey: string;
			url: string;
	  };

export type FlexLayoutNextPersistedSplitScreen = {
	afterDropTargetComponent: FlexLayoutNextPersistedPane[];
	beforeDropTargetComponent: FlexLayoutNextPersistedPane[];
	centerDropTargetComponent: FlexLayoutNextPersistedPane[];
	direction: "row" | "column";
};

export type FlexLayoutNextPersistedRoot = {
	rootScreenKey: string;
	layouts: Record<string, FlexLayoutNextPersistedSplitScreen>;
};

export type FlexLayoutNextPersistedSnapshot = {
	version: 1;
	roots: Record<string, FlexLayoutNextPersistedRoot>;
};

export type FlexLayoutNextPersistedState = {
	version: 4;
	latest?: FlexLayoutNextPersistedSnapshot;
	byUrl?: Record<string, FlexLayoutNextPersistedSnapshot>;
};

export const EMPTY_FLEX_LAYOUT_NEXT_PERSISTED_STATE: FlexLayoutNextPersistedState = {
	version: 4,
};

function isProviderUrlPane(item: DropTargetComponent, providerId: string) {
	const paneProviderId = item.customData?.[FLEX_LAYOUT_NEXT_PROVIDER_ID];
	return (
		item.customData?.[FLEX_LAYOUT_NEXT_PERSISTABLE] === true &&
		typeof item.customData?.[FLEX_LAYOUT_NEXT_URL] === "string" &&
		(paneProviderId === undefined || paneProviderId === providerId)
	);
}

function serializePane(
	item: DropTargetComponent,
	providerId: string,
	rootScreenKey: string,
): FlexLayoutNextPersistedPane | undefined {
	if (item.screenKey === rootScreenKey) {
		return {
			kind: "root",
			screenKey: rootScreenKey,
		};
	}

	if (!isProviderUrlPane(item, providerId)) return undefined;

	return {
		kind: "next-url",
		containerName: item.containerName,
		navigationTitle: item.navigationTitle,
		dropDocumentOutsideOption: item.dropDocumentOutsideOption,
		screenKey: item.screenKey,
		url: item.customData![FLEX_LAYOUT_NEXT_URL] as string,
	};
}

function serializeSplitScreen(
	components: SplitScreenComponents,
	providerId: string,
	rootScreenKey: string,
): FlexLayoutNextPersistedSplitScreen {
	return {
		beforeDropTargetComponent: components.beforeDropTargetComponent
			.map((item) => serializePane(item, providerId, rootScreenKey))
			.filter((item): item is FlexLayoutNextPersistedPane => item !== undefined),
		centerDropTargetComponent: components.centerDropTargetComponent
			.map((item) => serializePane(item, providerId, rootScreenKey))
			.filter((item): item is FlexLayoutNextPersistedPane => item !== undefined),
		afterDropTargetComponent: components.afterDropTargetComponent
			.map((item) => serializePane(item, providerId, rootScreenKey))
			.filter((item): item is FlexLayoutNextPersistedPane => item !== undefined),
		direction: components.direction,
	};
}

function getLayoutKeyParts(rootName: string, layoutKey: string) {
	if (layoutKey === rootName) {
		return {
			baseLayoutName: rootName,
			depth: -1,
			screenKey: undefined as string | undefined,
		};
	}

	const separatorIndex = layoutKey.lastIndexOf("=");
	if (separatorIndex === -1) return undefined;

	const baseLayoutName = layoutKey.slice(0, separatorIndex);
	const screenKey = layoutKey.slice(separatorIndex + 1);
	const depthMatch = baseLayoutName.match(/_(?:before|center|after)-(\d+)$/);
	const depth = depthMatch
		? Number(depthMatch[1]) + 1
		: baseLayoutName === `${rootName}_center`
			? 0
			: 1;

	return { baseLayoutName, depth, screenKey };
}

function getChildLayoutKey({
	rootName,
	layoutKey,
	position,
	paneScreenKey,
	rootScreenKey,
}: {
	rootName: string;
	layoutKey: string;
	position: "before" | "center" | "after";
	paneScreenKey: string;
	rootScreenKey: string;
}) {
	if (layoutKey === rootName) {
		return position === "center"
			? `${rootName}_center=${rootScreenKey}`
			: `${rootName}_${position}=${paneScreenKey}`;
	}

	const parts = getLayoutKeyParts(rootName, layoutKey);
	if (!parts) return undefined;

	return `${parts.baseLayoutName}_${position}-${parts.depth}=${
		position === "center" ? parts.screenKey : paneScreenKey
	}`;
}

function collectProviderUrlPanes(
	rootLayouts: Record<string, SplitScreenComponents>,
	providerId: string,
) {
	const panes = new Map<string, FlexLayoutNextPersistedPane & { kind: "next-url" }>();
	Object.values(rootLayouts).forEach((components) => {
		[
			...components.beforeDropTargetComponent,
			...components.centerDropTargetComponent,
			...components.afterDropTargetComponent,
		].forEach((item) => {
			if (!isProviderUrlPane(item, providerId)) return;
			panes.set(item.screenKey, {
				kind: "next-url",
				containerName: item.containerName,
				navigationTitle: item.navigationTitle,
				dropDocumentOutsideOption: item.dropDocumentOutsideOption,
				screenKey: item.screenKey,
				url: item.customData![FLEX_LAYOUT_NEXT_URL] as string,
			});
		});
	});
	return panes;
}

export function serializeFlexLayoutNextRoot(
	state: LayoutSplitScreenState,
	rootName: string,
	providerId: string,
): FlexLayoutNextPersistedRoot | undefined {
	const rootLayouts = state[rootName];
	const rootComponent = rootLayouts?.[rootName]?.centerDropTargetComponent[0];
	if (!rootLayouts || !rootComponent) return undefined;

	const serializedLayouts: Record<string, FlexLayoutNextPersistedSplitScreen> = {};
	Object.entries(rootLayouts).forEach(([layoutKey, components]) => {
		serializedLayouts[layoutKey] = serializeSplitScreen(
			components,
			providerId,
			rootComponent.screenKey,
		);
	});

	const rootLayout = serializedLayouts[rootName];
	if (!rootLayout) return undefined;
	if (!rootLayout.centerDropTargetComponent.some((item) => item.kind === "root")) {
		rootLayout.centerDropTargetComponent.unshift({
			kind: "root",
			screenKey: rootComponent.screenKey,
		});
	}

	const reachableLayoutKeys = new Set<string>();
	const reachableUrlScreenKeys = new Set<string>();
	const visit = (layoutKey: string) => {
		if (reachableLayoutKeys.has(layoutKey)) return;
		const components = serializedLayouts[layoutKey];
		if (!components) return;
		if (
			layoutKey !== rootName &&
			components.centerDropTargetComponent.length === 0
		) {
			return;
		}

		reachableLayoutKeys.add(layoutKey);
		[
			...components.beforeDropTargetComponent,
			...components.centerDropTargetComponent,
			...components.afterDropTargetComponent,
		].forEach((pane) => {
			if (pane.kind === "next-url") reachableUrlScreenKeys.add(pane.screenKey);
		});

		components.beforeDropTargetComponent.forEach((pane) => {
			const childKey = getChildLayoutKey({
				rootName,
				layoutKey,
				position: "before",
				paneScreenKey: pane.screenKey,
				rootScreenKey: rootComponent.screenKey,
			});
			if (childKey) visit(childKey);
		});
		components.afterDropTargetComponent.forEach((pane) => {
			const childKey = getChildLayoutKey({
				rootName,
				layoutKey,
				position: "after",
				paneScreenKey: pane.screenKey,
				rootScreenKey: rootComponent.screenKey,
			});
			if (childKey) visit(childKey);
		});

		const centerPane = components.centerDropTargetComponent[0];
		if (centerPane) {
			const childKey = getChildLayoutKey({
				rootName,
				layoutKey,
				position: "center",
				paneScreenKey: centerPane.screenKey,
				rootScreenKey: rootComponent.screenKey,
			});
			if (childKey) visit(childKey);
		}
	};
	visit(rootName);

	const layouts = Object.fromEntries(
		Array.from(reachableLayoutKeys).map((layoutKey) => [
			layoutKey,
			serializedLayouts[layoutKey],
		]),
	) as Record<string, FlexLayoutNextPersistedSplitScreen>;

	const orphanPanes = Array.from(
		collectProviderUrlPanes(rootLayouts, providerId).values(),
	).filter((pane) => !reachableUrlScreenKeys.has(pane.screenKey));

	if (orphanPanes.length !== 0) {
		const centerLayoutKey = `${rootName}_center=${rootComponent.screenKey}`;
		const centerLayout = layouts[centerLayoutKey] ?? {
			beforeDropTargetComponent: [],
			centerDropTargetComponent: [
				{ kind: "root" as const, screenKey: rootComponent.screenKey },
			],
			afterDropTargetComponent: [],
			direction: "row" as const,
		};
		const existingKeys = new Set(
			centerLayout.centerDropTargetComponent.map((pane) => pane.screenKey),
		);
		centerLayout.centerDropTargetComponent.push(
			...orphanPanes.filter((pane) => !existingKeys.has(pane.screenKey)),
		);
		layouts[centerLayoutKey] = centerLayout;
	}

	return {
		rootScreenKey: rootComponent.screenKey,
		layouts,
	};
}

function restorePane(
	pane: FlexLayoutNextPersistedPane,
	providerId: string,
	rootComponent: DropTargetComponent,
): DropTargetComponent {
	if (pane.kind === "root") {
		return {
			...rootComponent,
			screenKey: pane.screenKey,
		};
	}

	return {
		containerName: pane.containerName,
		component: (
			<FlexLayoutNextPane
				key={pane.screenKey}
				screenKey={pane.screenKey}
				url={pane.url}
			/>
		),
		navigationTitle: pane.navigationTitle,
		dropDocumentOutsideOption: pane.dropDocumentOutsideOption,
		screenKey: pane.screenKey,
		customData: {
			[FLEX_LAYOUT_NEXT_PROVIDER_ID]: providerId,
			[FLEX_LAYOUT_NEXT_URL]: pane.url,
			[FLEX_LAYOUT_NEXT_PERSISTABLE]: true,
		},
	};
}

export function restoreFlexLayoutNextRoot({
	rootName,
	providerId,
	persistedRoot,
	rootComponent,
}: {
	rootName: string;
	providerId: string;
	persistedRoot: FlexLayoutNextPersistedRoot;
	rootComponent: DropTargetComponent;
}) {
	const restoredLayouts: Record<string, SplitScreenComponents> = {};

	Object.entries(persistedRoot.layouts).forEach(([layoutKey, components]) => {
		const restored: SplitScreenComponents = {
			beforeDropTargetComponent: components.beforeDropTargetComponent.map(
				(item) => restorePane(item, providerId, rootComponent),
			),
			centerDropTargetComponent: components.centerDropTargetComponent.map(
				(item) => restorePane(item, providerId, rootComponent),
			),
			afterDropTargetComponent: components.afterDropTargetComponent.map(
				(item) => restorePane(item, providerId, rootComponent),
			),
			direction: components.direction,
		};

		if (layoutKey === rootName && restored.centerDropTargetComponent.length === 0) {
			restored.centerDropTargetComponent = [
				{
					...rootComponent,
					screenKey: persistedRoot.rootScreenKey,
				},
			];
		}

		if (layoutKey === rootName || restored.centerDropTargetComponent.length !== 0) {
			restoredLayouts[layoutKey] = restored;
		}
	});

	return restoredLayouts;
}
