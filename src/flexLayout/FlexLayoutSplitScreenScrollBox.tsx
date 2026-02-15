'use client';

import { HTMLAttributes, memo, useEffect, useRef, useState } from 'react';
import { fromEvent, Subject } from 'rxjs';
import { take, throttleTime } from 'rxjs/operators';
import {
    getScrollPosition,
    removeScrollPosition,
    ScrollPosition,
    setScrollPosition,
} from './FlexLayoutContainerStore';
import listScroll from './styles/listScroll.module.css';

export interface FlexLayoutSplitScreenScrollBoxProps
    extends HTMLAttributes<HTMLDivElement> {
    keyName: string;
    className?: string;
    direction?: 'x' | 'y';
    isDefaultScrollStyle?: boolean;
}

const FlexLayoutSplitScreenScrollBox = ({
    className,
    children,
    keyName,
    direction,
    isDefaultScrollStyle = false,
    ...props
}: FlexLayoutSplitScreenScrollBoxProps) => {
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const [isMouseDown, setIsMouseDown] = useState<boolean>(false);
    const scrollEventSubject = useRef(new Subject<ScrollPosition>());

    // const handleScroll = throttle(
    //     (newScrollLeft: number, newScrollTop: number) => {
    //         setScrollPosition(layoutName, {
    //             x: newScrollLeft,
    //             y: newScrollTop,
    //         });
    //     },
    //     100
    // ); // 100ms 간격으로 호출

    useEffect(() => {
        const mouseUpSubscribe = fromEvent<MouseEvent>(window, 'mouseup').subscribe(() => {
            setIsMouseDown(false);
        });

        // 스크롤 이벤트 throttling 및 상태 업데이트
        const scrollEventSubscribe = scrollEventSubject.current
            .pipe(throttleTime(70)) // 70ms 간격으로 throttling
            .subscribe(position => {
                setScrollPosition(keyName, position);
            });

        const scrollSubscribe = getScrollPosition(keyName)
            .pipe(take(1)) // 한 번만 실행
            .subscribe(position => {
                if (scrollRef.current && position) {
                    scrollRef.current.scrollLeft = position.x;
                    scrollRef.current.scrollTop = position.y;
                }
            });

        return () => {
            removeScrollPosition(keyName);
            mouseUpSubscribe.unsubscribe();
            scrollSubscribe.unsubscribe();
            scrollEventSubscribe.unsubscribe();
        };
    }, [keyName]);
    useEffect(() => {
        if (!scrollRef.current) return;

        let animationFrameId: number | null = null;
        const handleWheel = (event: WheelEvent) => {
            if (!scrollRef.current || direction !== 'x') return;
            if (scrollRef.current.matches(':hover')) {
                event.preventDefault();
                const { deltaY } = event;
                const newScrollLeft = scrollRef.current.scrollLeft + deltaY;

                // 이미 애니메이션이 예약되어 있으면 취소
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                }

                animationFrameId = requestAnimationFrame(() => {
                    // 바로 scrollLeft 값을 업데이트 (smooth 대신,
                    // 혹은 native 스크롤로 처리)
                    scrollRef.current!.scrollLeft = newScrollLeft;
                    scrollEventSubject.current.next({
                        x: newScrollLeft,
                        y: scrollRef.current!.scrollTop,
                    });
                    animationFrameId = null;
                });
            }
        };

        // 수동으로 이벤트 리스너 추가
        scrollRef.current.addEventListener('wheel', handleWheel, {
            passive: false,
        });

        return () => {
            // 이벤트 리스너 제거
            scrollRef.current?.removeEventListener('wheel', handleWheel);
        };
    }, []);
    return (
        <div
            ref={scrollRef}
            onMouseUp={() => setIsMouseDown(false)}
            onMouseDown={() => setIsMouseDown(true)}
            onMouseMove={event => {
                if (!scrollRef.current || !isMouseDown || direction !== 'x')
                    return;
                scrollRef.current.scrollLeft += event.movementX * -1;
                scrollEventSubject.current.next({
                    x: scrollRef.current.scrollLeft,
                    y: scrollRef.current.scrollTop,
                });
            }}
            onScroll={() => {
                if (!scrollRef.current) return;
                scrollEventSubject.current.next({
                    x: scrollRef.current.scrollLeft,
                    y: scrollRef.current.scrollTop,
                });
            }}
            className={`${className || ''} ${isDefaultScrollStyle ? listScroll['default-scroll'] : listScroll['list-scroll']} ${direction ? listScroll[direction] : ''}`}
            {...props}
        >
            {children}
        </div>
    );
};

export default memo(FlexLayoutSplitScreenScrollBox);
