import { createElement, type ElementType, type ReactNode } from "react";
import type {
	FlexLayoutNextParams,
	FlexLayoutNextResolvedPage,
	FlexLayoutNextSearchParams,
} from "../types";

function createRouteValue<T extends FlexLayoutNextParams | FlexLayoutNextSearchParams>(
	value: T,
): Promise<T> & T {
	return Object.assign(Promise.resolve(value), value);
}

export async function renderResolvedPage(
	resolvedPage: FlexLayoutNextResolvedPage,
): Promise<ReactNode> {
	const [pageModule, layoutModules] = await Promise.all([
		resolvedPage.page(),
		Promise.all(resolvedPage.layouts.map((importer) => importer())),
	]);
	const params = createRouteValue(resolvedPage.params);

	let content: ReactNode = createElement(
		pageModule.default as ElementType,
		{
			params,
			searchParams: createRouteValue(resolvedPage.searchParams),
		},
	);

	for (let index = layoutModules.length - 1; index >= 0; index -= 1) {
		content = createElement(
			layoutModules[index].default as ElementType,
			{
				params,
				children: content,
			},
		);
	}

	return content;
}
