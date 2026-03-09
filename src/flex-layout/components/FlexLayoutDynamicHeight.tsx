"use client";

import { useEffect, useRef, type RefObject } from "react";
import {
	Observable,
	Subject,
	Subscription,
	animationFrameScheduler,
	auditTime,
	bufferTime,
	filter,
	fromEvent,
	map,
	merge,
} from "rxjs";
import styles from "./../styles/sentinelStyle.module.css";

export default function FlexLayoutDynamicHeight({
	extraHeight = 0,
	extraHeightUnit = "px",
	targetRef,
}: {
	extraHeight?: number;
	extraHeightUnit?: "px" | "%";
	targetRef?: RefObject<HTMLElement | null>;
}) {
	const rafRef = useRef<number | null>(null);
	const lastAppliedRef = useRef<number>(-1);

	const anchorRef = useRef<HTMLDivElement | null>(null);

	const lastAppliedMinRef = useRef<number>(-1);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const anchorEl = anchorRef.current;
		if (!anchorEl) return;

		//  targetRef가 있으면 그걸 우선
		//  아니면 기존처럼 parentElement
		const target =
			(targetRef?.current
				? targetRef.current
				: (anchorEl.parentElement as HTMLElement | null)) ?? null;

		if (!target) return;

		// 기존 스타일 백업(원복용)
		const prevHeight = target.style.height;
		const prevMinHeight = target.style.minHeight;

		// height/minHeight를 만지는 동안 RO 스케줄을 막기 위한 플래그
		let suppressRO = false;
		let releaseSuppressRaf: number | null = null;

		// 루프 가드(“no-op 폭주” 감지용)
		const LOOP_GUARD_WINDOW_MS = 1000;
		const NOOP_LIMIT_IN_WINDOW = 30; // 1초 동안 no-op 30회 이상이면 루프 가능성 높음

		let cooldownUntil = 0;
		let pendingDuringCooldown = false;
		let cooldownTimer: number | null = null;

		const noop$ = new Subject<void>();
		const trigger$ = new Subject<void>();
		const sub = new Subscription();

		const measureAndApply = () => {
			rafRef.current = null;

			// cooldown 중에는 즉시 측정하지 않고, 끝나면 한 번만
			const now = performance.now();
			if (now < cooldownUntil) {
				pendingDuringCooldown = true;
				return;
			}

			// RO가 우리 변경으로 다시 schedule하지 않도록 "이번 프레임" suppress
			suppressRO = true;
			if (releaseSuppressRaf != null)
				cancelAnimationFrame(releaseSuppressRaf);
			releaseSuppressRaf = window.requestAnimationFrame(() => {
				suppressRO = false;
			});

			const measuringPrevHeight = target.style.height;
			const measuringPrevMinHeight = target.style.minHeight;

			try {
				// 실제 컨텐츠 높이를 얻기 위해 잠깐 auto로 풀기
				target.style.height = "auto";
				target.style.minHeight = "0px";

				const viewportH = Math.max(
					0,
					Math.round(
						window.visualViewport?.height ??
							window.innerHeight ??
							0,
					),
				);

				const cs = window.getComputedStyle(target);

				const targetRect = target.getBoundingClientRect();
				const targetTopInViewport = Math.max(
					0,
					Math.round(targetRect.top),
				);
				const minBorderBoxH = Math.max(
					0,
					viewportH - targetTopInViewport,
				);

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
					lastEl =
						lastEl.previousElementSibling as HTMLElement | null;
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
				const nextMinH = Math.max(0, Math.ceil(minHForHeight));

				const sameH = Math.abs(nextH - lastAppliedRef.current) < 1;
				const sameMinH =
					Math.abs(nextMinH - lastAppliedMinRef.current) < 1;

				if (sameH && sameMinH) {
					// 측정 때문에 건드린 걸 원복
					target.style.height = measuringPrevHeight;
					target.style.minHeight = measuringPrevMinHeight;

					// no-op 폭주 감지용 (루프 가드)
					noop$.next();
					return;
				}

				lastAppliedRef.current = nextH;
				lastAppliedMinRef.current = nextMinH;

				target.style.height = `${nextH}px`;
				target.style.minHeight = `${nextMinH}px`;
			} catch {
				// 에러 나도 원복은 되게
				target.style.height = measuringPrevHeight;
				target.style.minHeight = measuringPrevMinHeight;
			}
		};

		const schedule = () => {
			// cooldown 중에는 예약만 해두고, 끝날 때 1번
			const now = performance.now();
			if (now < cooldownUntil) {
				pendingDuringCooldown = true;
				return;
			}

			if (rafRef.current != null) return;
			rafRef.current = window.requestAnimationFrame(measureAndApply);
		};

		// 트리거들을 merge해서 한 군데로
		const mutation$ = new Observable<void>((subscriber) => {
			const mo = new MutationObserver((mutations) => {
				for (const m of mutations) {
					// 우리가 만지는 style(특히 target/anchor)은 트리거에서 제외
					if (
						m.type === "attributes" &&
						m.attributeName === "style" &&
						(m.target === target || m.target === anchorEl)
					) {
						continue;
					}
					subscriber.next();
					return;
				}
			});
			mo.observe(target, {
				subtree: true,
				childList: true,
				attributes: true,
				characterData: true,
			});
			return () => mo.disconnect();
		});

		const resize$ = new Observable<void>((subscriber) => {
			const ro = new ResizeObserver(() => {
				if (suppressRO) return;
				subscriber.next();
			});
			ro.observe(target);
			if (target.firstElementChild) ro.observe(target.firstElementChild);
			return () => ro.disconnect();
		});

		const winResize$ = fromEvent(window, "resize", { passive: true });

		const vv = window.visualViewport;
		const vvResize$ = vv ? fromEvent(vv, "resize") : new Observable<void>();
		const vvScroll$ = vv ? fromEvent(vv, "scroll") : new Observable<void>();

		const fonts = (document as any).fonts;
		const fontsDone$ = fonts?.addEventListener
			? fromEvent(fonts, "loadingdone")
			: new Observable<void>();
		const fontsErr$ = fonts?.addEventListener
			? fromEvent(fonts, "loadingerror")
			: new Observable<void>();

		// 여러 이벤트가 한 프레임에 몰리면 1번만(schedule은 rAF로 즉시 반영)
		sub.add(
			merge(
				mutation$,
				resize$,
				winResize$,
				vvResize$,
				vvScroll$,
				fontsDone$,
				fontsErr$,
				trigger$,
			)
				.pipe(auditTime(0, animationFrameScheduler))
				.subscribe(() => schedule()),
		);

		// 1000ms 내 no-op(동일 값 계산)이 과도하면 루프 가능성 → 1초 cooldown
		sub.add(
			noop$
				.pipe(
					bufferTime(LOOP_GUARD_WINDOW_MS),
					map((buf) => buf.length),
					filter((count) => count >= NOOP_LIMIT_IN_WINDOW),
				)
				.subscribe(() => {
					const now = performance.now();
					// 이미 cooldown이면 갱신만
					cooldownUntil = Math.max(
						cooldownUntil,
						now + LOOP_GUARD_WINDOW_MS,
					);
					pendingDuringCooldown = true;

					if (cooldownTimer != null)
						window.clearTimeout(cooldownTimer);
					cooldownTimer = window.setTimeout(() => {
						// cooldown 끝나면 1번만 재측정
						if (pendingDuringCooldown) {
							pendingDuringCooldown = false;
							schedule();
						}
					}, LOOP_GUARD_WINDOW_MS);
				}),
		);

		// 초기 1회
		schedule();

		return () => {
			if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
			if (releaseSuppressRaf != null)
				cancelAnimationFrame(releaseSuppressRaf);
			if (cooldownTimer != null) window.clearTimeout(cooldownTimer);

			sub.unsubscribe();
			noop$.complete();
			trigger$.complete();

			target.style.height = prevHeight;
			target.style.minHeight = prevMinHeight;
		};
	}, [extraHeight, extraHeightUnit, targetRef]);

	return (
		<div
			ref={anchorRef}
			data-flex-layout-dynamic-height-anchor="true"
			className={styles["flex-layout-sentinel-style"]}
			aria-hidden="true"
		/>
	);
}
