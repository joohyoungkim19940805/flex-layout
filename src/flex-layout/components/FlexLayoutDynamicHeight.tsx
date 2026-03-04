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

	const lastAppliedMinRef = useRef<number>(-1);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const anchorEl = anchorRef.current;
		if (!anchorEl) return;

		const target = anchorEl.parentElement as HTMLElement | null;
		if (!target) return;

		// 기존 스타일 백업(원복용)
		const prevHeight = target.style.height;
		const prevMinHeight = target.style.minHeight;

		// ✅ sentinel을 항상 target의 "맨 마지막 자식"으로 유지
		const ensureAnchorLast = () => {
			// 이미 마지막이면 패스
			if (target.lastElementChild === anchorEl) return;
			// React와 싸우는 상황을 최소화하려고 "필요할 때만" 이동
			target.appendChild(anchorEl);
		};

		const measureAndApply = () => {
			rafRef.current = null;

			// 라우트 변경/DOM 삽입으로 sentinel 뒤에 뭐가 붙었으면 끝으로 다시 밀기
			ensureAnchorLast();

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

			//  scrollHeight 대신 "sentinel의 위치"로 컨텐츠 끝을 잡음
			// sentinel이 마지막 자식이면, sentinel의 top은 '마지막 컨텐츠 + (margin 포함한) 다음 위치'가 됨
			const anchorRect = anchorEl.getBoundingClientRect();

			// target이 자체 스크롤 컨테이너인 경우까지 커버
			const anchorOffsetInTarget =
				anchorRect.top - targetRect.top + (target.scrollTop || 0);

			const paddingTop = parseFloat(cs.paddingTop) || 0;
			const paddingBottom = parseFloat(cs.paddingBottom) || 0;
			const borderTop = parseFloat(cs.borderTopWidth) || 0;
			const borderBottom = parseFloat(cs.borderBottomWidth) || 0;

			let contentHForHeight = 0;
			let minHForHeight = 0;

			// sentinel의 top은 "border-top부터 sentinel까지" 거리라서
			// border-box 기준 높이로 만들려면 paddingBottom/borderBottom만 더해주면 끝
			const contentEndBorderBoxH = Math.max(
				0,
				Math.ceil(anchorOffsetInTarget + paddingBottom + borderBottom),
			);

			if (cs.boxSizing === "border-box") {
				contentHForHeight = contentEndBorderBoxH;
				minHForHeight = minBorderBoxH;
			} else {
				contentHForHeight = Math.max(
					0,
					contentEndBorderBoxH -
						paddingTop -
						paddingBottom -
						borderTop -
						borderBottom,
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

			const safeExtraHeight = Number.isFinite(extraHeight)
				? extraHeight
				: 0;
			const safeUnit = extraHeightUnit === "%" ? "%" : "px";

			const baseH = Math.max(minHForHeight, contentHForHeight);

			const appliedH =
				safeUnit === "px"
					? baseH + safeExtraHeight
					: baseH * (1 + safeExtraHeight / 100);

			const nextH = Math.max(0, Math.ceil(appliedH));
			const nextMinH = Math.max(0, Math.ceil(minHForHeight));

			const sameH = Math.abs(nextH - lastAppliedRef.current) < 1;
			const sameMinH = Math.abs(nextMinH - lastAppliedMinRef.current) < 1;

			if (sameH && sameMinH) return;

			lastAppliedRef.current = nextH;
			lastAppliedMinRef.current = nextMinH;

			target.style.height = `${nextH}px`;
			target.style.minHeight = `${nextMinH}px`;
		};

		const schedule = () => {
			if (rafRef.current != null) return;
			rafRef.current = window.requestAnimationFrame(measureAndApply);
		};

		// 초기 1회
		schedule();

		// subtree는 유지 (라우팅 시 내부 DOM이 바뀌는 케이스 커버)
		const mo = new MutationObserver((mutations) => {
			// sentinel이 항상 마지막이 되도록 보정하고, 한번만 schedule
			let shouldSchedule = false;

			for (const m of mutations) {
				if (
					m.type === "attributes" &&
					m.attributeName === "style" &&
					m.target === target
				) {
					// target 자신의 height/minHeight 쓰는 건 무시 무한 루프 방지
					continue;
				}
				shouldSchedule = true;
			}

			if (shouldSchedule) schedule();
		});

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
		// 스크롤로 targetTop이 바뀌는 케이스까지 커버
		window.addEventListener("scroll", schedule, { passive: true });

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
			window.removeEventListener("scroll", schedule as any);

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
