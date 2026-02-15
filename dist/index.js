import { useState, useEffect, useRef, useCallback } from 'react';
import equal from 'fast-deep-equal';
import { BehaviorSubject, Subject, combineLatest, map as map$1, filter as filter$1, switchMap, EMPTY, fromEvent, buffer, debounceTime, distinctUntilChanged as distinctUntilChanged$1 } from 'rxjs';
import { filter, map, distinctUntilChanged } from 'rxjs/operators';

// src/flex-layout/providers/FlexLayoutHooks.tsx
function updateScrollStore(subject, newValue) {
  const currentValue = subject.getValue();
  if (!equal(currentValue, newValue)) {
    subject.next(newValue);
  }
}
function updateRefStore(store, newState) {
  const prevState = store.getValue();
  if (!equal(prevState, newState)) {
    store.next(newState);
  }
}
function updateSplitScreenStore(newValue) {
  const prevValue = layoutSplitScreenStore.getValue();
  if (!equal(prevValue, newValue)) {
    layoutSplitScreenStore.next(newValue);
  }
}
var scrollPositions = {};
var scrollPositionsSubject = new BehaviorSubject(scrollPositions);
var setScrollPosition = (layoutName, position) => {
  const current = scrollPositionsSubject.getValue();
  const prevPos = current[layoutName];
  if (prevPos && prevPos.x === position.x && prevPos.y === position.y) {
    return;
  }
  const newPositions = {
    ...current,
    [layoutName]: position
  };
  updateScrollStore(scrollPositionsSubject, newPositions);
};
var getScrollPosition = (layoutName) => {
  return scrollPositionsSubject.pipe(
    // 해당 layoutName이 정의되지 않았을 때는 제외
    filter((e) => e[layoutName] !== void 0),
    map((positions) => positions[layoutName]),
    distinctUntilChanged(
      (prev, curr) => prev?.x === curr?.x && prev?.y === curr?.y
    )
  );
};
var removeScrollPosition = (layoutName) => {
  const current = scrollPositionsSubject.getValue();
  delete current[layoutName];
  const newPositions = { ...current };
  updateScrollStore(scrollPositionsSubject, newPositions);
};
var layoutSplitScreenStore = new BehaviorSubject({});
var setSplitScreen = (rootName, layoutName, newComponents) => {
  const current = layoutSplitScreenStore.getValue();
  const updatedLayout = { ...current[rootName] || {} };
  updatedLayout[layoutName] = newComponents;
  const newStoreValue = {
    ...current,
    [rootName]: updatedLayout
  };
  updateSplitScreenStore(newStoreValue);
};
var resetRootSplitScreen = (rootName) => {
  const current = layoutSplitScreenStore.getValue();
  const newStoreValue = {
    ...current,
    [rootName]: {}
  };
  updateSplitScreenStore(newStoreValue);
};
var removeSplitScreenChild = (rootName, layoutName) => {
  const current = layoutSplitScreenStore.getValue();
  if (!current[rootName]) return;
  const updatedLayout = { ...current[rootName] };
  delete updatedLayout[layoutName];
  const newStoreValue = {
    ...current,
    [rootName]: updatedLayout
  };
  updateSplitScreenStore(newStoreValue);
};
var getCurrentSplitScreenComponents = (rootName, layoutName) => {
  const current = layoutSplitScreenStore.getValue();
  if (!current[rootName]) return;
  return current[rootName][layoutName];
};
var getSplitScreen = (rootName, layoutName) => {
  return layoutSplitScreenStore.pipe(
    map((splitScreen) => splitScreen[rootName][layoutName]),
    distinctUntilChanged((prev, curr) => {
      const filterChildren2 = (obj) => {
        const { children, component, targetComponent, x, y, ...rest } = obj || {};
        return rest;
      };
      return equal(filterChildren2(prev), filterChildren2(curr));
    })
  );
};
var flexContainerStore = new BehaviorSubject({});
var flexResizePanelStore = new BehaviorSubject({});
var setContainerRef = (layoutName, containerName, ref) => {
  const currentRefs = flexContainerStore.getValue();
  const updatedLayoutRefs = { ...currentRefs[layoutName] || {} };
  if (ref === null) {
    delete updatedLayoutRefs[containerName];
  } else {
    updatedLayoutRefs[containerName] = ref;
  }
  const newRefs = {
    ...currentRefs,
    [layoutName]: updatedLayoutRefs
  };
  updateRefStore(flexContainerStore, newRefs);
};
var setResizePanelRef = (layoutName, containerName, ref) => {
  const currentRefs = flexResizePanelStore.getValue();
  const updatedLayoutRefs = { ...currentRefs[layoutName] || {} };
  if (ref === null) {
    delete updatedLayoutRefs[containerName];
  } else {
    updatedLayoutRefs[containerName] = ref;
  }
  const newRefs = {
    ...currentRefs,
    [layoutName]: updatedLayoutRefs
  };
  updateRefStore(flexResizePanelStore, newRefs);
};
var getLayoutInfos = (layoutName) => {
  return combineLatest([flexContainerStore, flexResizePanelStore]).pipe(
    map(([containerRefs, resizePanelRefs]) => {
      const containerData = containerRefs[layoutName] || {};
      const resizePanelData = resizePanelRefs[layoutName] || {};
      return {
        container: containerData,
        resizePanel: resizePanelData
      };
    }),
    filter((result) => result.container !== null)
    // 빈 객체 제외
  );
};
var getContainerRef = ({
  containerName,
  layoutName
}) => {
  return flexContainerStore.pipe(
    map((refs) => {
      if (layoutName) {
        return refs[layoutName]?.[containerName] || null;
      } else {
        return Object.entries(refs).find(
          ([key, value]) => refs[key][containerName]
        )?.[1][containerName];
      }
    }),
    filter((ref) => ref !== null)
  );
};
var getResizePanelRef = ({
  containerName,
  layoutName
}) => {
  return flexResizePanelStore.pipe(
    map((refs) => {
      if (layoutName) {
        return refs[layoutName]?.[containerName] || null;
      } else {
        return Object.entries(refs).find(
          ([key, value]) => refs[key][containerName]
        )?.[1][containerName];
      }
    }),
    filter((ref) => ref !== null)
  );
};

// src/flex-layout/utils/FlexLayoutUtils.ts
function isDocumentOut({ x, y }) {
  if (typeof window == "undefined") return;
  const { innerWidth, innerHeight, scrollX, scrollY } = window;
  return x < 0 || y < 0 || x > innerWidth + scrollX || y > innerHeight + scrollY;
}
var lastTouchEvent;
function getClientXy(event) {
  let clientX;
  let clientY;
  if (window.MouseEvent && event instanceof window.MouseEvent) {
    clientX = event.clientX;
    clientY = event.clientY;
  } else if (window.TouchEvent && event instanceof window.TouchEvent) {
    const _event = event.touches.length == 0 ? lastTouchEvent : event;
    clientX = _event.touches[0].clientX;
    clientY = _event.touches[0].clientY;
    lastTouchEvent = event;
  } else {
    return;
  }
  return { clientX, clientY };
}
function isOverMove(elementSize, elementMinSize) {
  return Math.floor(elementSize) <= 0 || (isNaN(elementMinSize) ? false : elementMinSize >= Math.floor(elementSize));
}
function findNotCloseFlexContent(target, direction) {
  if (!target) return target;
  let _target = target;
  const isCloseCheck = () => {
    let grow = parseFloat(window.getComputedStyle(_target).flex.split(" ")[0]) || 0;
    if (grow == 0) {
      return true;
    } else {
      return false;
    }
  };
  while (isCloseCheck()) {
    let nextTarget = _target[direction]?.[direction];
    _target = nextTarget;
    if (!_target) {
      break;
    }
  }
  return _target;
}
function remain(flexContainerList) {
  return new Promise((resolve) => {
    let notGrowList = [];
    let totalGrow = flexContainerList.reduce((t, e, i) => {
      if (e.hasAttribute("data-grow") == false) {
        notGrowList.push(e);
        return t;
      }
      let grow = parseFloat(e.dataset.grow || "");
      e.style.flex = `${grow} 1 0%`;
      t -= grow;
      return t;
    }, flexContainerList.length);
    if (notGrowList.length != 0) {
      resize(notGrowList, totalGrow);
    }
    resolve(flexContainerList);
  });
}
function resize(list, totalGrow) {
  return new Promise((resolve) => {
    let resizeWeight = totalGrow / list.length;
    list.forEach((e) => {
      e.dataset.grow = resizeWeight.toString();
      e.style.flex = `${resizeWeight} 1 0%`;
    });
    resolve(resizeWeight);
  });
}
function mathWeight(totalCount, totalGrow) {
  return 1 + (totalGrow - totalCount) / totalCount;
}
function mathGrow(childSize, parentSize, containerCount) {
  return containerCount * (childSize / parentSize);
}
function getGrow(growTarget) {
  const target = growTarget instanceof Element ? growTarget : growTarget;
  return parseFloat(target.style.flex.split(" ")[0]) || parseFloat(target.dataset.grow || "");
}
function closeFlex(resizeTarget, containers, {
  isResize = false,
  isDsiabledResizePanel = false,
  sizeName
}) {
  return new Promise((resolve) => {
    if (!resizeTarget.hasAttribute("data-is_resize_panel")) ; else if (isDsiabledResizePanel) {
      resizeTarget.dataset.is_resize_panel = "false";
    }
    resizeTarget.dataset.prev_grow = getGrow(resizeTarget).toString();
    let notCloseList = containers.filter(
      (e) => e.style.flex != "0 1 0%" && e != resizeTarget
    );
    let notCloseAndOpenTargetList = [...notCloseList, resizeTarget];
    notCloseAndOpenTargetList.forEach((e) => {
      e.style.transition = "flex 0.5s";
      e.ontransitionend = (event) => {
        if (event.propertyName != "flex-grow") {
          return;
        }
        notCloseAndOpenTargetList.forEach(
          (e2) => e2.style.transition = ""
        );
        e.ontransitionend = () => {
        };
      };
      if (e == resizeTarget) {
        e.dataset.grow = "0";
        e.style.flex = `0 1 0%`;
        return;
      }
      if (isResize) {
        return;
      }
      let percent = getGrow(e) / containers.length;
      if (notCloseList.length == 1) {
        e.dataset.grow = containers.length.toString();
        e.style.flex = `${containers.length} 1 0%`;
        return;
      }
      e.dataset.grow = (containers.length * percent).toString();
      e.style.flex = `${containers.length * percent} 1 0%`;
    });
    if (isResize) {
      resize(notCloseList, containers.length);
    }
    resolve(resizeTarget);
  });
}
function openFlex(resizeTarget, containers, {
  isPrevSizeOpen = false,
  isResize = false,
  openGrowImportant = 0,
  sizeName
}) {
  return new Promise((resolve) => {
    if (!resizeTarget.hasAttribute("data-is_resize_panel")) ; else if (resizeTarget.hasAttribute("data-is_resize_panel") && resizeTarget.dataset.is_resize_panel == "false") {
      resizeTarget.dataset.is_resize_panel = "true";
    }
    let notCloseList = containers.filter(
      (e) => e.style.flex != "0 1 0%" && e != resizeTarget
    );
    let notCloseAndOpenTargetList = [...notCloseList, resizeTarget];
    let openTargetGrow = 1;
    const sizeStyleName = "client" + sizeName.charAt(0).toUpperCase() + sizeName.substring(1);
    const parentSize = sizeName && resizeTarget.parentElement && resizeTarget.parentElement[sizeStyleName] || 0;
    if (isPrevSizeOpen && resizeTarget.hasAttribute("data-prev_grow")) {
      openTargetGrow = parseFloat(resizeTarget.dataset.prev_grow || "1") || 1;
    } else if (parentSize && parentSize !== 0) {
      openTargetGrow = parentSize / notCloseList.length / (parentSize - 1) * containers.length;
    } else {
      openTargetGrow = 1;
    }
    if (openGrowImportant) {
      openTargetGrow = openGrowImportant;
    }
    openTargetGrow = openTargetGrow === Infinity ? 1 : openTargetGrow;
    notCloseAndOpenTargetList.forEach((e) => {
      e.style.transition = "flex 0.5s";
      e.ontransitionend = (event) => {
        if (event.propertyName != "flex-grow") {
          return;
        }
        notCloseAndOpenTargetList.forEach(
          (e2) => e2.style.transition = ""
        );
        e.ontransitionend = () => {
        };
      };
      if (e == resizeTarget) {
        resizeTarget.dataset.grow = openTargetGrow.toString();
        resizeTarget.style.flex = `${openTargetGrow} 1 0%`;
        return;
      }
      if (isResize) {
        return;
      }
      let grow = parentSize / notCloseList.length / (parentSize - 1) * (containers.length - openTargetGrow);
      grow = grow === Infinity ? 1 : grow;
      e.dataset.grow = grow.toString();
      e.style.flex = `${grow} 1 0%`;
    });
    if (isResize) {
      resize(notCloseAndOpenTargetList, containers.length);
    }
    resolve(openTargetGrow);
  });
}
var g = globalThis;
g.__FLEX_SUBJECTS__ ?? (g.__FLEX_SUBJECTS__ = { openClose: {}, spread: {} });
var containerOpenCloseSubjectMap = g.__FLEX_SUBJECTS__.openClose;
var containerSpreadSubjectMap = g.__FLEX_SUBJECTS__.spread;
var ContainerOpenCloseProvider = ({
  layoutName,
  containerName,
  sizeName
}) => {
  if (!containerOpenCloseSubjectMap[containerName]) {
    containerOpenCloseSubjectMap[containerName] = new Subject();
  }
  if (!containerSpreadSubjectMap[containerName]) {
    containerSpreadSubjectMap[containerName] = new Subject();
  }
  const [containers, setContainers] = useState([]);
  const [container, setContainer] = useState();
  useEffect(() => {
    const subscription = getLayoutInfos(layoutName).subscribe(
      (layout) => {
        if (!layout || !layout.container[containerName] || !layout.container[containerName].current)
          return;
        setContainers(
          Object.values(layout.container).filter(
            (e) => e.current !== null
          ).map((e) => e.current)
        );
        setContainer(layout.container[containerName].current);
      }
    );
    return () => subscription.unsubscribe();
  }, [containerName, layoutName]);
  useEffect(() => {
    const styleName = `${sizeName.charAt(0).toUpperCase() + sizeName.substring(1)}`;
    const clientSize = "client" + styleName;
    const outerSize = "outer" + styleName;
    const maxSize = "max" + styleName;
    const subscribe = containerOpenCloseSubjectMap[containerName].subscribe(
      ({
        mode,
        initOpenState: isOpenState,
        onClose,
        onOpen,
        openOption = {},
        closeOption = {}
      }) => {
        if (!container || containers.length === 0) return;
        const currentGrow = getGrow(container);
        const styleMap = window.getComputedStyle(container);
        const maxSizeGrow = mathGrow(
          parseInt(styleMap[maxSize]),
          container.parentElement && container.parentElement[clientSize] || window[outerSize],
          containers.length
        );
        const open = () => openFlex(container, containers, {
          sizeName,
          ...isNaN(maxSizeGrow) ? {} : {
            openGrowImportant: maxSizeGrow
          },
          ...openOption
        }).then((openTargetGrow) => {
          if (onOpen) onOpen();
          containerSpreadSubjectMap[containerName].next({
            isOpen: true,
            grow: openTargetGrow,
            targetContainer: container
          });
        });
        const close = () => closeFlex(container, containers, {
          sizeName,
          ...closeOption
        }).then(() => {
          if (onClose) onClose();
          containerSpreadSubjectMap[containerName].next({
            isOpen: false,
            grow: 0,
            targetContainer: container
          });
        });
        if (mode === "toggle") {
          if (currentGrow === 0) {
            open();
          } else {
            close();
          }
        } else if (mode === "open") {
          if (currentGrow === 0) {
            open();
          }
        } else if (mode === "close") {
          if (currentGrow !== 0) {
            close();
          }
        }
      }
    );
    return () => {
      subscribe.unsubscribe();
    };
  }, [containerName, container, containers, sizeName]);
  return null;
};
var useContainers = (layoutName) => {
  const [containers, setContainers] = useState([]);
  useEffect(() => {
    const subscription = getLayoutInfos(layoutName).subscribe(
      (layout) => {
        setContainers(
          Object.values(layout.container).filter(
            (e) => e.current !== null
          ).map((e) => e.current)
        );
      }
    );
    return () => subscription.unsubscribe();
  }, [layoutName]);
  return containers;
};
var useLayoutName = (containerName) => {
  const [layoutName, setLayoutName] = useState();
  useEffect(() => {
    const subscribe = flexContainerStore.pipe(
      map$1(
        (layouts) => Object.entries(layouts).filter(([_, v]) => v[containerName]).map(([k]) => k)[0]
        // 첫 번째 결과 가져오기
      )
    ).subscribe(setLayoutName);
    return () => subscribe.unsubscribe();
  }, [containerName]);
  return layoutName;
};
var useDecompositionLayout = ({
  layoutName: initialLayoutName,
  containerName
}) => {
  const derivedLayoutName = useLayoutName(containerName);
  const finalLayoutName = initialLayoutName || derivedLayoutName;
  const [containers, setContainers] = useState([]);
  const [container, setContainer] = useState();
  const [resizePanel, setResizePanel] = useState();
  useEffect(() => {
    if (!finalLayoutName) return;
    const subscription = getLayoutInfos(finalLayoutName).subscribe(
      (layout) => {
        if (!layout) return;
        setContainers(
          Object.values(layout.container).filter(
            (e) => e.current !== null
          ).map((e) => e.current)
        );
        if (containerName && layout.container[containerName] && layout.container[containerName].current) {
          setContainer(layout.container[containerName].current);
          if (layout.resizePanel[containerName] && layout.resizePanel[containerName].current) {
            setResizePanel(
              layout.resizePanel[containerName].current
            );
          }
        }
      }
    );
    return () => subscription.unsubscribe();
  }, [containerName, finalLayoutName]);
  return { layout: containers, container, resizePanel };
};
var useContainerSize = (containerName) => {
  const { layout, container, resizePanel } = useDecompositionLayout({
    containerName
  });
  const [size, setSize] = useState();
  useEffect(() => {
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [container]);
  return { size };
};
var useDoubleClick = (containerName, opt) => {
  const [isOpen, setIsOpen] = useState();
  const [isDoubleClick, setIsDoubleClick] = useState();
  useEffect(() => {
    const resizePanelClickEvent = getResizePanelRef({
      containerName
    }).pipe(
      filter$1(
        (resizePanelref) => resizePanelref != void 0 && resizePanelref.current != void 0
      ),
      //take(1),
      switchMap((resizePanelref) => {
        if (!resizePanelref || !resizePanelref.current) return EMPTY;
        return fromEvent(resizePanelref.current, "click");
      })
    );
    const subscribe = resizePanelClickEvent.pipe(
      buffer(resizePanelClickEvent.pipe(debounceTime(500))),
      filter$1((clickEventArray) => clickEventArray.length >= 2),
      map$1((events) => {
        containerOpenCloseSubjectMap[containerName].next({
          ...opt,
          openOption: {
            ...opt.openOption,
            isPrevSizeOpen: false
          },
          onClose: () => {
            if (opt.onClose) opt.onClose();
            setIsOpen(false);
            setIsDoubleClick(true);
          },
          onOpen: () => {
            if (opt.onOpen) opt.onOpen();
            setIsOpen(true);
            setIsDoubleClick(true);
          }
        });
      })
    ).subscribe();
    return () => {
      subscribe.unsubscribe();
    };
  }, [containerName]);
  return { isOpen, isDoubleClick, setIsDoubleClick };
};
var dragState = new Subject();
var filterChildren = (obj) => {
  const { children, ...rest } = obj || {};
  return rest;
};
var useDragCapture = (targetRef) => {
  const stateRef = useRef(null);
  const forceUpdate = useRef(0);
  useEffect(() => {
    const subscription = dragState.pipe(
      map$1((value) => {
        if (!targetRef || !targetRef.current) return null;
        const { x, y } = value;
        const rect = targetRef.current.getBoundingClientRect();
        const {
          width,
          height,
          x: rectX,
          y: rectY,
          right,
          bottom
        } = rect;
        let isOver = false;
        if (x < rectX || x > right || y < rectY || y > bottom) {
          isOver = true;
        }
        const leftBoundary = rectX + width * 0.2;
        const rightBoundary = right - width * 0.2;
        const topBoundary = rectY + height * 0.2;
        const bottomBoundary = bottom - height * 0.2;
        let position = "centerBoundary";
        if (x < leftBoundary) {
          position = "leftBoundary";
        } else if (x > rightBoundary) {
          position = "rightBoundary";
        } else if (y < topBoundary) {
          position = "topBoundary";
        } else if (y > bottomBoundary) {
          position = "bottomBoundary";
        }
        return {
          positionName: position,
          isOver,
          ...value
        };
      }),
      distinctUntilChanged$1(
        (prev, curr) => equal(filterChildren(prev), filterChildren(curr))
      )
    ).subscribe({
      next: (value) => {
        if (value && !equal(
          filterChildren(stateRef.current),
          filterChildren(value)
        )) {
          stateRef.current = value;
          forceUpdate.current++;
        }
      },
      error: (err) => console.error(err)
    });
    return () => subscription.unsubscribe();
  }, [targetRef]);
  const [, rerender] = useState({});
  useEffect(() => {
    const interval = setInterval(() => {
      rerender({});
    }, 50);
    return () => clearInterval(interval);
  }, []);
  return stateRef.current;
};
var dropMovementEventSubject = new Subject();
var allSplitScreenCount = new BehaviorSubject(0);
var useDragEvents = ({
  isBlockingActiveInput = false
}) => {
  const dragResumeTimer = useRef(null);
  const scrollThreshold = 10;
  const isScrolling = useRef(false);
  const isPending = useRef(false);
  const isMouseDown = useRef(false);
  const isDragging = useRef(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const handleStart = useCallback(
    ({
      event: _event,
      dragStartCallback
    }) => {
      const event = _event instanceof Event ? _event : _event.nativeEvent;
      if (dragResumeTimer.current) {
        clearTimeout(dragResumeTimer.current);
        dragResumeTimer.current = null;
      }
      if (event.target.contentEditable === "true" || isBlockingActiveInput && document.activeElement === event.target) {
        return;
      }
      if (event.cancelable) {
        event.preventDefault();
      }
      isPending.current = true;
      isMouseDown.current = true;
      if (event instanceof globalThis.TouchEvent) {
        const touch = event.touches[0];
        touchStartX.current = touch.clientX;
        touchStartY.current = touch.clientY;
      } else if (event instanceof globalThis.MouseEvent) {
        touchStartX.current = event.clientX;
        touchStartY.current = event.clientY;
      }
      setTimeout(() => {
        if (!isPending.current || isScrolling.current) return;
        isPending.current = false;
        isDragging.current = true;
        const xy = getClientXy(event);
        if (!xy) return;
        const { clientX, clientY } = xy;
        dragStartCallback({ x: clientX, y: clientY });
      }, 300);
    },
    [isBlockingActiveInput]
  );
  const handleMove = useCallback(
    ({
      event: _event,
      notDragCallback,
      dragStartCallback,
      moveingCallback
    }) => {
      if (!isMouseDown.current) return;
      const event = _event instanceof Event ? _event : _event.nativeEvent;
      const xy = getClientXy(event);
      if (!xy) return;
      const { clientX, clientY } = xy;
      const deltaX = Math.abs(clientX - touchStartX.current);
      const deltaY = Math.abs(clientY - touchStartY.current);
      if (isPending.current && (deltaX > scrollThreshold || deltaY > scrollThreshold)) {
        isScrolling.current = true;
        isPending.current = false;
        isDragging.current = false;
        if (notDragCallback)
          notDragCallback({ x: clientX, y: clientY });
        if (dragResumeTimer.current) {
          clearTimeout(dragResumeTimer.current);
          dragResumeTimer.current = null;
        }
        dragResumeTimer.current = setTimeout(() => {
          if (!isMouseDown.current) return;
          if (dragStartCallback)
            dragStartCallback({ x: clientX, y: clientY });
          isPending.current = true;
          isScrolling.current = false;
          handleStart({ event: _event, dragStartCallback });
        }, 400);
        return;
      }
      if (!isDragging.current || isPending.current) return;
      moveingCallback({ x: clientX, y: clientY });
    },
    [isBlockingActiveInput]
  );
  const handleEnd = useCallback(
    ({
      event: _event,
      dragEndCallback
    }) => {
      isScrolling.current = false;
      isMouseDown.current = false;
      if (isPending.current) {
        isPending.current = false;
        return;
      }
      const event = _event instanceof Event ? _event : _event.nativeEvent;
      if (!isDragging.current) return;
      isDragging.current = false;
      const xy = getClientXy(event);
      if (!xy) return;
      const { clientX, clientY } = xy;
      dragEndCallback({ x: clientX, y: clientY });
    },
    [isBlockingActiveInput]
  );
  return {
    handleStart,
    handleMove,
    handleEnd
  };
};
var folderEventSubject = new Subject();
var setFolderEvent = (newValue) => {
  folderEventSubject.next(newValue);
};
var useFolderEvent = () => {
  const [folderEvent, setFolderEvent2] = useState(
    null
  );
  useEffect(() => {
    const subscription = folderEventSubject.subscribe((e) => {
      if (!e) return;
      setFolderEvent2(e);
    });
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);
  return { folderEvent };
};

export { ContainerOpenCloseProvider, allSplitScreenCount, closeFlex, containerOpenCloseSubjectMap, containerSpreadSubjectMap, dragState, dropMovementEventSubject, findNotCloseFlexContent, flexContainerStore, flexResizePanelStore, folderEventSubject, getClientXy, getContainerRef, getCurrentSplitScreenComponents, getGrow, getLayoutInfos, getResizePanelRef, getScrollPosition, getSplitScreen, isDocumentOut, isOverMove, layoutSplitScreenStore, mathGrow, mathWeight, openFlex, remain, removeScrollPosition, removeSplitScreenChild, resetRootSplitScreen, resize, scrollPositions, setContainerRef, setFolderEvent, setResizePanelRef, setScrollPosition, setSplitScreen, useContainerSize, useContainers, useDecompositionLayout, useDoubleClick, useDragCapture, useDragEvents, useFolderEvent, useLayoutName };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map