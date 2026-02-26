"use client";

import { useEffect, useRef } from "react";
import styles from "./../styles/sentinelStyle.module.css";

export default function FlexLayoutDynamicHeight({
	extraHeight = 0,
	extraHeightUnit = "px",
}: {
	extraHeight?: number;
	extraHeightUnit?: "px" | "%";
}) {
	const rafRef = useRef<number | null>(null);
	const lastAppliedRef = useRef<number>(-1);

	const anchorRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const anchorEl = anchorRef.current;
		if (!anchorEl) return;

		const target = anchorEl.parentElement as HTMLElement | null;
		if (!target) return;

		// 기존 스타일 백업(원복용)
		const prevHeight = target.style.height;
		const prevMinHeight = target.style.minHeight;

		const measureAndApply = () => {
			rafRef.current = null;

			const viewportH = Math.max(
				0,
				Math.round(
					window.visualViewport?.height ?? window.innerHeight ?? 0,
				),
			);

			const cs = window.getComputedStyle(target);

			const targetRect = target.getBoundingClientRect();
			const targetTopInViewport = Math.max(0, Math.round(targetRect.top));
			const minBorderBoxH = Math.max(0, viewportH - targetTopInViewport);

			const scrollH = Math.max(0, Math.ceil(target.scrollHeight));

			const paddingTop = parseFloat(cs.paddingTop) || 0;
			const paddingBottom = parseFloat(cs.paddingBottom) || 0;
			const borderTop = parseFloat(cs.borderTopWidth) || 0;
			const borderBottom = parseFloat(cs.borderBottomWidth) || 0;

			let contentHForHeight = 0;
			let minHForHeight = 0;

			if (cs.boxSizing === "border-box") {
				contentHForHeight = scrollH + borderTop + borderBottom;
				minHForHeight = minBorderBoxH;
			} else {
				contentHForHeight = Math.max(
					0,
					scrollH - paddingTop - paddingBottom,
				);
				minHForHeight = Math.max(
					0,
					minBorderBoxH -
						paddingTop -
						paddingBottom -
						borderTop -
						borderBottom,
				);
			}

			let extraBottomMargin = 0;
			let lastEl = target.lastElementChild as HTMLElement | null;
			while (
				lastEl &&
				lastEl.dataset.flexLayoutDynamicHeightAnchor === "true"
			) {
				lastEl = lastEl.previousElementSibling as HTMLElement | null;
			}
			if (lastEl) {
				const lastCs = window.getComputedStyle(lastEl);
				extraBottomMargin = parseFloat(lastCs.marginBottom) || 0;
			}

			const safeExtraHeight = Number.isFinite(extraHeight)
				? extraHeight
				: 0;
			const safeUnit = extraHeightUnit === "%" ? "%" : "px";

			const baseH = Math.max(
				minHForHeight,
				Math.ceil(contentHForHeight + extraBottomMargin),
			);

			const appliedH =
				safeUnit === "px"
					? baseH + safeExtraHeight
					: baseH * (1 + safeExtraHeight / 100);

			const nextH = Math.max(0, Math.ceil(appliedH));
			if (Math.abs(nextH - lastAppliedRef.current) < 1) return;
			lastAppliedRef.current = nextH;

			target.style.height = `${nextH}px`;
			target.style.minHeight = `${minHForHeight}px`;
		};

		const schedule = () => {
			if (rafRef.current != null) return;
			rafRef.current = window.requestAnimationFrame(measureAndApply);
		};

		schedule();

		const mo = new MutationObserver(schedule);
		mo.observe(target, {
			subtree: true,
			childList: true,
			attributes: true,
			characterData: true,
		});

		const ro = new ResizeObserver(schedule);
		ro.observe(target);
		if (target.firstElementChild) ro.observe(target.firstElementChild);

		window.addEventListener("resize", schedule, { passive: true });
		window.visualViewport?.addEventListener("resize", schedule);
		window.visualViewport?.addEventListener("scroll", schedule);

		const anyDoc = document as any;
		const fonts = anyDoc.fonts;
		const onFontsDone = () => schedule();
		fonts?.addEventListener?.("loadingdone", onFontsDone);
		fonts?.addEventListener?.("loadingerror", onFontsDone);

		return () => {
			if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
			mo.disconnect();
			ro.disconnect();

			window.removeEventListener("resize", schedule as any);
			window.visualViewport?.removeEventListener(
				"resize",
				schedule as any,
			);
			window.visualViewport?.removeEventListener(
				"scroll",
				schedule as any,
			);

			fonts?.removeEventListener?.("loadingdone", onFontsDone);
			fonts?.removeEventListener?.("loadingerror", onFontsDone);

			target.style.height = prevHeight;
			target.style.minHeight = prevMinHeight;
		};
	}, [extraHeight, extraHeightUnit]);

	return (
		<div
			ref={anchorRef}
			data-flex-layout-dynamic-height-anchor="true"
			className={styles["flex-layout-sentinel-style"]}
			aria-hidden="true"
		/>
	);
}
