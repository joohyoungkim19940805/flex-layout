import { ReactNode } from "react";

export const getInitialNumberArray = (length: number, value: number) =>
	Array.from({ length }, () => value);

export const isSameNumberArray = (a: number[], b: number[]) =>
	a.length === b.length && a.every((value, index) => value === b[index]);

export const getVisibleTextNodes = (root: HTMLElement): Text[] => {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
		acceptNode: (node) =>
			node.textContent?.trim()
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_REJECT,
	});

	const textNodes: Text[] = [];

	while (walker.nextNode()) {
		textNodes.push(walker.currentNode as Text);
	}

	return textNodes;
};

export const measureTextRangeRect = (root: HTMLElement): DOMRect | null => {
	const textNodes = getVisibleTextNodes(root);

	if (textNodes.length === 0) return null;

	const range = document.createRange();
	range.setStartBefore(textNodes[0]);
	range.setEndAfter(textNodes[textNodes.length - 1]);

	const rect = range.getBoundingClientRect();
	range.detach();

	return rect;
};

export const getHorizontalBoxExtra = (element: HTMLElement) => {
	const style = window.getComputedStyle(element);

	return (
		parseFloat(style.paddingLeft || "0") +
		parseFloat(style.paddingRight || "0") +
		parseFloat(style.borderLeftWidth || "0") +
		parseFloat(style.borderRightWidth || "0")
	);
};

export const toCssPx = (value: number) => `${Math.ceil(value)}px`;

export type FlexLayoutTableCellValue = {
	content: ReactNode;
};

export type FlexLayoutTableState<TCell extends FlexLayoutTableCellValue> =
	Record<string, Record<string, TCell>>;
