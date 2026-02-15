import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { auditTime, distinctUntilChanged, filter, fromEvent } from "rxjs";

export const useSize = (sizeName: "height" | "width") => {
	const ref = useRef<HTMLDivElement>(null);
	const [size, setSize] = useState<number | undefined>(undefined);

	useLayoutEffect(() => {
		if (!ref.current) return;

		const handleResize = () => {
			if (ref.current) {
				const newSize = ref.current.getBoundingClientRect()[
					sizeName as keyof DOMRect
				] as number;
				setSize(newSize);
			}
		};

		// 초기 측정
		handleResize();

		// ResizeObserver 설정
		const resizeObserver = new ResizeObserver(() => {
			handleResize();
		});
		resizeObserver.observe(ref.current);

		// 윈도우 리사이즈 이벤트도 청취
		window.addEventListener("resize", handleResize);

		// 클린업
		return () => {
			resizeObserver.disconnect();
			window.removeEventListener("resize", handleResize);
		};
	}, [sizeName]);

	return { ref, size };
};
export const useFirstChildSize = (sizeName: string) => {
	const ref = useRef<HTMLDivElement>(null);
	const [sizes, setSizes] = useState<Array<number>>();
	useEffect(() => {
		if (!ref.current || !ref.current.children[0]) return;
		if (!sizes || sizes.length === 0) {
			setSizes([
				ref.current.getBoundingClientRect()[
					sizeName as keyof DOMRect
				] as number,
				ref.current.children[0].getBoundingClientRect()[
					sizeName as keyof DOMRect
				] as number,
			]);
		}
	}, []);
	useEffect(() => {
		if (!ref.current || !ref.current.children[0]) return;
		const childrenChangeObserver = new MutationObserver(
			(mutationList, observer) => {
				mutationList.forEach((mutation) => {
					if (!ref.current || !sizes || !ref.current.children[0])
						return;
					const newSize = ref.current.getBoundingClientRect()[
						sizeName as keyof DOMRect
					] as number;
					//if (newSize === sizes[0]) return;
					setSizes([
						newSize,
						ref.current.children[0].getBoundingClientRect()[
							sizeName as keyof DOMRect
						] as number,
					]);
				});
			},
		);
		childrenChangeObserver.observe(ref.current, {
			childList: true,
			subtree: true,
		});
		let isFocus = false;

		const windowResizeSubscribe = fromEvent<UIEvent>(window, "resize")
			.pipe(
				distinctUntilChanged(),
				filter(
					() =>
						document.activeElement?.tagName !== "INPUT" && !isFocus,
				),
			)
			.subscribe((ev) => {
				if (!ref.current || !ref.current.children[0]) return;
				setSizes([
					ref.current.getBoundingClientRect()[
						sizeName as keyof DOMRect
					] as number,
					ref.current.children[0].getBoundingClientRect()[
						sizeName as keyof DOMRect
					] as number,
				]);
			});

		const documentFocusoutSubscribe = fromEvent<FocusEvent>(
			document,
			"focusout",
		)
			.pipe(
				auditTime(1000),
				filter((ev) => document.activeElement?.tagName !== "INPUT"),
			)
			.subscribe({
				next: () => {
					if (isFocus) isFocus = false;
				},
			});

		const documentFocusinSubscribe = fromEvent<FocusEvent>(
			document,
			"focusin",
		).subscribe({
			next: (ev) =>
				(isFocus = (ev.target as Element).tagName === "INPUT"),
		});

		return () => {
			windowResizeSubscribe.unsubscribe();
			documentFocusoutSubscribe.unsubscribe();
			documentFocusinSubscribe.unsubscribe();
			childrenChangeObserver.disconnect();
		};
	}, [sizeName, sizes]);
	return { ref, sizes };
};
