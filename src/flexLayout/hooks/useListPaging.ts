import {
    MutableRefObject,
    RefObject,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

export type OnReachTerminalType = {
    isFirst: boolean;
    isLast: boolean;
    observer: IntersectionObserver;
};
interface UseListPagingForInfinityProps {
    onReachTerminal?: (onReachTerminalData: OnReachTerminalType) => void;
}
export const useListPagingForSentinel = <E extends HTMLElement>({
    //initPageNumber,
    //initPageSize,
    onReachTerminal,
}: UseListPagingForInfinityProps): {
    firstChildRef: (node: E | null) => void;
    lastChildRef: (node: E | null) => void;
    //pageNumber: number;
    //pageSize: number;
    //setPageNumber: React.Dispatch<React.SetStateAction<number>>;
    //setPageSize: React.Dispatch<React.SetStateAction<number>>;
} => {
    const [firstChildNode, setFirstChildNode] = useState<E | null>(null);
    const [lastChildNode, setLastChildNode] = useState<E | null>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    const firstChildRef = useCallback((node: E | null) => {
        setFirstChildNode(node);
    }, []);

    const lastChildRef = useCallback((node: E | null) => {
        setLastChildNode(node);
    }, []);
    // 페이지 번호가 변경될 때마다 데이터 로드를 위한 콜백 호출

    useEffect(() => {
        if (firstChildNode && observerRef.current)
            observerRef.current.unobserve(firstChildNode);
        if (lastChildNode && observerRef.current)
            observerRef.current.unobserve(lastChildNode);
        const handleIntersect: IntersectionObserverCallback = (
            entries,
            observer
        ) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    if (entry.target === firstChildNode) {
                        if (onReachTerminal)
                            onReachTerminal({
                                isFirst: true,
                                isLast: false,
                                observer,
                            });
                    }

                    if (entry.target === lastChildNode) {
                        if (onReachTerminal)
                            onReachTerminal({
                                isFirst: false,
                                isLast: true,
                                observer,
                            });
                    }
                }
            });
        };

        const observer = new IntersectionObserver(handleIntersect, {
            threshold: 0.1,
        });

        observerRef.current = observer;

        if (firstChildNode) observer.observe(firstChildNode);
        if (lastChildNode) observer.observe(lastChildNode);

        return () => {
            if (observerRef.current) {
                // if (firstChildNode)
                //     observerRef.current.unobserve(firstChildNode);
                // if (lastChildNode) observerRef.current.unobserve(lastChildNode);
                observerRef.current.disconnect();
            }
        };
    }, [firstChildNode, lastChildNode]);

    return {
        firstChildRef,
        lastChildRef,
    };
};

export const usePaginationViewNumber = ({
    initPageNumber,
}: {
    initPageNumber: number;
}) => {
    const [showCurrentPageNumber, setShowCurrentPageNumber] =
        useState<number>(initPageNumber);

    const observerRef = useRef<IntersectionObserver | null>(null);
    const showCurrentPageObserveTarget = useCallback(
        (node: HTMLElement | null) => {
            if (!node) return;

            // 아직 observer가 없으면 새로 생성
            if (!observerRef.current) {
                observerRef.current = new IntersectionObserver(
                    entries => {
                        entries.forEach(entry => {
                            if (entry.isIntersecting) {
                                const pageIndexAttr =
                                    entry.target.getAttribute(
                                        'data-page-index'
                                    );
                                if (!pageIndexAttr) return;
                                // if (!entry.target.hasAttribute('data-is-first'))
                                //     return;
                                const pageIndex = parseInt(pageIndexAttr, 10);
                                setShowCurrentPageNumber(pageIndex);
                            }
                        });
                    },
                    {
                        threshold: 0.1, // 예: 10% 이상 보여야 intersect로 판단
                    }
                );
            }

            // 해당 노드를 관찰
            observerRef.current.observe(node);
        },
        []
    );
    useEffect(() => {
        const currentObserver = observerRef.current;
        return () => {
            if (currentObserver) {
                currentObserver.disconnect();
            }
        };
    }, []);
    return {
        showCurrentPageNumber,
        showCurrentPageObserveTarget,
    };
};

export const usePagingHandler = <T>({
    lastCallPageNumber,
    dataListRef,
}: {
    lastCallPageNumber: number;
    dataListRef: MutableRefObject<Array<T[] | null>>;
}) => {
    const jumpingPageNumberRef = useRef<number | null>(lastCallPageNumber);
    useEffect(() => {
        if (jumpingPageNumberRef.current) {
            setTimeout(() => {
                jumpingPageNumberRef.current = null;
            }, 1000);
        }
    }, [jumpingPageNumberRef]);
    const paginationScrollIntoViewTarget = useRef<
        Record<number, HTMLDivElement | null>
    >({});
    const pageNumberRef = useRef<number>(lastCallPageNumber);

    const setPaginationRef = useCallback(
        (i: number) => (node: HTMLDivElement | null) => {
            if (!node) return;

            paginationScrollIntoViewTarget.current[i] = node;

            // jumpingPageNumberRef에 값이 있고, 그 값이 현재 i와 같으면 스크롤
            if (
                jumpingPageNumberRef.current !== null &&
                i === jumpingPageNumberRef.current
            ) {
                node.scrollIntoView({
                    behavior: 'instant', // 필요한 경우 'smooth' 등으로 수정 가능
                    block: 'start',
                });
                jumpingPageNumberRef.current = null;
            }
        },
        []
    );

    //스크롤이 “첫 아이템” 혹은 “마지막 아이템”에 닿을 때 호출
    const handleReachTerminal = (
        { isFirst, isLast, observer }: OnReachTerminalType,
        dataCallFetch: (callPageNumber: number) => void
    ) => {
        // 이미 다른 페이지로 점프 중이면, 중복 호출 방지
        if (dataListRef.current.length === 0) return;
        if (jumpingPageNumberRef.current != null) return;
        if (!isFirst && !isLast) return;

        const callPageNumber = isFirst
            ? Math.max(pageNumberRef.current - 1, 0)
            : pageNumberRef.current + 1;

        if (
            dataListRef.current[callPageNumber] != null &&
            (dataListRef.current[callPageNumber]?.length || 0) > 0
        )
            return;
        jumpingPageNumberRef.current = callPageNumber;
        setTimeout(() => {
            jumpingPageNumberRef.current = null;
        }, 1000);
        dataCallFetch(callPageNumber);
    };

    //페이지네이션에서 페이지 번호를 직접 클릭했을 시
    const handleClickPageChange = (
        page: number,
        dataCallFetch: (callPageNumber: number) => void
    ) => {
        // PaginationLayer는 1-based, 내부 로직은 0-based
        // 이미 캐싱된 페이지가 있다면, 스크롤만 이동
        const pageData = dataListRef.current[page];

        // 이미 캐싱된 페이지가 있다면, 스크롤만 이동
        if (
            pageData != null &&
            Array.isArray(pageData) &&
            pageData.length > 0
        ) {
            paginationScrollIntoViewTarget.current[page]?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
            return;
        }
        jumpingPageNumberRef.current = page;
        setTimeout(() => {
            jumpingPageNumberRef.current = null;
        }, 1000);
        dataCallFetch(page);
    };
    return {
        jumpingPageNumberRef,
        paginationScrollIntoViewTarget,
        pageNumberRef,
        setPaginationRef,
        handleReachTerminal,
        handleClickPageChange,
    };
};
