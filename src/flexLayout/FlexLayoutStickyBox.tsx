'use client';
import React, { useEffect, useRef, useState } from 'react';

type Edge = 'auto' | 'top' | 'bottom' | 'left' | 'right';

interface FlexLayoutStickyBoxProps
    extends React.HTMLAttributes<HTMLDivElement> {
    /** 어느 방향으로 붙일지. 기본은 'auto' (세로 스크롤이면 top, 가로 스크롤이면 left) */
    edge?: Edge;
    /** 화면 모서리와의 여백(px). 기본 16 */
    offset?: number;
    /** 스크롤 루트. 명시 안 하면 가장 흔한 케이스인 <main> → 없으면 window(=viewport) */
    scrollRoot?: Element | null;
    /** 디버그 보조선 표시 */
    debug?: boolean;
    /** 자식 */
    children: React.ReactNode;

    onTranslateChange?: (
        value: number,
        rootRef: React.RefObject<HTMLDivElement | null>,
        contentRef: React.RefObject<HTMLDivElement | null>
    ) => void;
}

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

function pickDefaultScrollRoot(): Element | null {
    if (typeof document === 'undefined') return null;

    let el: Element | null = document.body;
    while (el && el !== document.documentElement && el !== document.body) {
        const style = getComputedStyle(el);
        const oy = style.overflowY;
        const ox = style.overflowX;
        const scrollable =
            oy === 'auto' ||
            oy === 'scroll' ||
            ox === 'auto' ||
            ox === 'scroll';
        if (scrollable) return el;
        el = el.parentElement;
    }
    return null;
}

function isVerticalScroll(root: Element | null): boolean {
    if (typeof window == 'undefined') return true;
    if (!root) {
        return document.documentElement.scrollHeight > window.innerHeight + 1;
    }
    const el = root as HTMLElement;
    return el.scrollHeight > el.clientHeight + 1;
}

const dpr = typeof window != 'undefined' ? window.devicePixelRatio || 1 : 1;
function quantizeToDevicePixel(n: number) {
    return Math.round(n * dpr) / dpr;
}

/**
 * FlexLayoutStickyBox
 * 부모(실제 경계) 안에서만 움직이며, `transform`을 동적으로 부여해
 * “sticky처럼 보이도록” 만든다.
 *
 * 구조:
 * <div data-root>      // 이 박스가 부모 경계 안에서 공간을 차지
 * <div data-content> // 이 박스가 transform으로 부드럽게 움직임
 * {children}
 * </div>
 * </div>
 */
const FlexLayoutStickyBox: React.FC<FlexLayoutStickyBoxProps> = ({
    edge = 'auto',
    offset = 16,
    scrollRoot = null,
    debug = false,
    children,
    style,
    className,
    onTranslateChange = () => {},
    ...rest
}) => {
    const offsetRef = useRef(offset);
    const rootRef = useRef<HTMLDivElement>(null); // 내가 들어있는 박스(부모의 자식)
    const contentRef = useRef<HTMLDivElement>(null); // 실제 내용
    const mutatingRef = useRef(false);
    const lastOffsetRef = useRef(0);
    const [resolvedEdge, setResolvedEdge] = useState<Edge>('top');
    const rafId = useRef<number | null>(null);

    //  마운트 이후에만(클라이언트에서만) 터치 스타일을 적용
    const [contentDynamicStyle, setContentDynamicStyle] =
        useState<React.CSSProperties>({});
    useEffect(() => {
        // if (
        //     typeof navigator !== 'undefined' &&
        //     (navigator.maxTouchPoints ?? 0) > 0
        // ) {
        setContentDynamicStyle({
            willChange: 'transform',
            transition: 'transform 50ms linear',
        });
        // }
    }, []);

    useEffect(() => {
        offsetRef.current = offset;
        scheduleUpdate();
    }, [offset]);
    const [ioRoot, setIoRoot] = useState<Element | null>(null);
    useEffect(() => {
        // CSR로 전환된 후에 반드시 최신 scroll root를 계산
        const root = scrollRoot ?? pickDefaultScrollRoot();
        setResolvedEdge(
            edge === 'auto' ? (isVerticalScroll(root) ? 'top' : 'left') : edge
        );

        setIoRoot(root);
    }, [edge, scrollRoot]);
    useEffect(() => {
        if (edge !== 'auto') {
            setResolvedEdge(edge);
            return;
        }
        const vertical = isVerticalScroll(ioRoot);
        setResolvedEdge(vertical ? 'top' : 'left');
    }, [edge, ioRoot]);

    useEffect(() => {}, []);

    const scheduleUpdate = () => {
        if (rafId.current != null) return;
        rafId.current = requestAnimationFrame(() => {
            rafId.current = null;
            doUpdate();
        });
    };

    const doUpdate = () => {
        if (mutatingRef.current) return;
        mutatingRef.current = true;

        const rootEl = rootRef.current;
        const contentEl = contentRef.current;
        if (!rootEl || !contentEl) {
            mutatingRef.current = false;
            return;
        }

        const parentEl = rootEl.parentElement;
        if (!parentEl) {
            mutatingRef.current = false;
            return;
        }

        const rootBounds =
            ioRoot && 'getBoundingClientRect' in ioRoot
                ? (ioRoot as Element).getBoundingClientRect()
                : new DOMRect(0, 0, window.innerWidth, window.innerHeight);

        const parentRect = parentEl.getBoundingClientRect();
        const contentRect = contentEl.getBoundingClientRect();

        let newOffset = 0;

        if (resolvedEdge === 'top' || resolvedEdge === 'bottom') {
            const maxTranslate = Math.max(
                0,
                parentRect.height - contentRect.height
            );
            let desiredTop = 0;

            if (resolvedEdge === 'top') {
                desiredTop =
                    rootBounds.top + offsetRef.current - parentRect.top;
            } else {
                // bottom
                const targetBottomFromParentTop =
                    Math.min(
                        parentRect.bottom,
                        rootBounds.bottom - offsetRef.current
                    ) - parentRect.top;
                desiredTop = targetBottomFromParentTop - contentRect.height;
            }
            newOffset = clamp(desiredTop, 0, maxTranslate);
        } else {
            // left or right
            const maxTranslate = Math.max(
                0,
                parentRect.width - contentRect.width
            );
            let desiredLeft = 0;

            if (resolvedEdge === 'left') {
                desiredLeft =
                    rootBounds.left + offsetRef.current - parentRect.left;
            } else {
                // right
                const targetRightFromParentLeft =
                    Math.min(
                        parentRect.right,
                        rootBounds.right - offsetRef.current
                    ) - parentRect.left;
                desiredLeft = targetRightFromParentLeft - contentRect.width;
            }
            newOffset = clamp(desiredLeft, 0, maxTranslate);
        }

        const nextOffset = quantizeToDevicePixel(newOffset);

        // 변화가 거의 없으면 업데이트 건너뛰기 (미세한 떨림 방지)
        if (Math.abs(lastOffsetRef.current - nextOffset) > 0.5) {
            if (resolvedEdge === 'top' || resolvedEdge === 'bottom') {
                contentEl.style.transform = `translateY(${nextOffset}px)`;
            } else {
                contentEl.style.transform = `translateX(${nextOffset}px)`;
            }
            lastOffsetRef.current = nextOffset;
            onTranslateChange(nextOffset, rootRef, contentRef);
        }

        if (debug) {
            rootEl.style.outline = '1px dashed rgba(0,0,0,.2)';
            contentEl.style.outline = '1px solid rgba(0,128,255,.35)';
        }

        queueMicrotask(() => {
            mutatingRef.current = false;
        });
    };

    // IntersectionObserver, ResizeObserver, Event Listeners 설정
    useEffect(() => {
        if (typeof window == 'undefined') return;
        const rootEl = rootRef.current;
        if (!rootEl) return;

        const parentEl = rootEl.parentElement;

        console.log(parentEl);
        if (!parentEl) return;

        const targets: Element[] = [parentEl];

        const observerCallback = () => {
            if (!mutatingRef.current) scheduleUpdate();
        };

        const io = new IntersectionObserver(observerCallback, {
            root: ioRoot instanceof Element ? ioRoot : null,
            threshold: 0,
            rootMargin: '1px',
        });

        const ro = new ResizeObserver(observerCallback);

        targets.forEach(t => io.observe(t));
        ro.observe(parentEl);
        if (contentRef.current) {
            ro.observe(contentRef.current);
        }

        const scrollTarget = ioRoot || window;
        scrollTarget.addEventListener('scroll', scheduleUpdate, {
            passive: true,
        });
        window.addEventListener('resize', scheduleUpdate);

        // 최초 1회 계산
        scheduleUpdate();

        return () => {
            io.disconnect();
            ro.disconnect();
            scrollTarget.removeEventListener('scroll', scheduleUpdate);
            window.removeEventListener('resize', scheduleUpdate);
            if (rafId.current != null) {
                cancelAnimationFrame(rafId.current);
                rafId.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ioRoot, resolvedEdge, offset, debug]);

    return (
        <div
            ref={rootRef}
            className={className}
            style={{
                display: 'block',
                minWidth: 0,
                minHeight: 0,
                height: '100%', // 부모 높이를 채우도록 설정
                ...style,
            }}
            {...rest}
        >
            <div
                ref={contentRef}
                //  SSR/클라이언트 첫 렌더 동일 → 마운트 후에만 스타일 부여
                style={contentDynamicStyle}
            >
                {children}
            </div>
        </div>
    );
};

export default FlexLayoutStickyBox;
