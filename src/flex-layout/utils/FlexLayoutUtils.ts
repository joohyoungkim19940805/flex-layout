export function isDocumentOut({ x, y }: { x: number; y: number }) {
	if (typeof window == "undefined") return;
	const { innerWidth, innerHeight, scrollX, scrollY } = window;

	return (
		x < 0 || y < 0 || x > innerWidth + scrollX || y > innerHeight + scrollY
	);
}

let lastTouchEvent: globalThis.TouchEvent;
export function getClientXy(event: Event) {
	let clientX: number;
	let clientY: number;
	if (window.MouseEvent && event instanceof window.MouseEvent) {
		clientX = event.clientX;
		clientY = event.clientY;
	} else if (window.TouchEvent && event instanceof window.TouchEvent) {
		const _event = event.touches.length == 0 ? lastTouchEvent : event;
		clientX = _event!.touches[0].clientX;
		clientY = _event!.touches[0].clientY;
		lastTouchEvent = event;
	} else {
		return; // 해당 이벤트 타입이 MouseEvent나 TouchEvent가 아니라면 무시
	}
	return { clientX, clientY };
}

export function isOverMove(elementSize: number, elementMinSize: number) {
	return (
		Math.floor(elementSize) <= 0 ||
		(isNaN(elementMinSize)
			? false
			: elementMinSize >= Math.floor(elementSize))
	);
}

export function findNotCloseFlexContent(
	target: HTMLElement | Element | null,
	direction: "previousElementSibling" | "nextElementSibling",
) {
	if (!target) return target;
	let _target = target as HTMLElement;
	const isCloseCheck = () => {
		let grow =
			parseFloat(window.getComputedStyle(_target).flex.split(" ")[0]) ||
			0;
		if (grow == 0) {
			return true;
		} else {
			return false;
		}
	};
	while (isCloseCheck()) {
		let nextTarget = _target[direction]?.[direction];
		_target = nextTarget as HTMLElement;
		if (!_target) {
			break;
		}
	}
	return _target as HTMLElement | HTMLDivElement | null;
}

export function remain(flexContainerList: Array<HTMLElement>) {
	return new Promise((resolve) => {
		let notGrowList: Array<HTMLElement> = [];
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

export function resize(list: Array<HTMLElement>, totalGrow: number) {
	return new Promise((resolve) => {
		// totalGrow 값을 리스트의 개수로 나누어 균등 할당
		let resizeWeight = totalGrow / list.length;
		list.forEach((e) => {
			e.dataset.grow = resizeWeight.toString();
			e.style.flex = `${resizeWeight} 1 0%`;
		});
		resolve(resizeWeight);
	});
}

export function mathWeight(totalCount: number, totalGrow: number) {
	return 1 + (totalGrow - totalCount) / totalCount;
}
export function mathGrow(
	childSize: number,
	parentSize: number,
	containerCount: number,
) {
	return containerCount * (childSize / parentSize);
}

export function getGrow(el: HTMLElement | Element) {
	const target = el instanceof Element ? (el as HTMLElement) : el;
	const a = parseFloat(target.style.flex.split(" ")[0]);
	if (!Number.isNaN(a)) return a; // 0도 정상값
	const b = parseFloat(target.dataset.grow ?? "0");
	return Number.isNaN(b) ? 0 : b;
}

export function closeFlex(
	resizeTarget: HTMLElement,
	containers: HTMLElement[],
	{
		isResize = false,
		isDsiabledResizePanel = false,
		sizeName,
	}: {
		isResize?: boolean;
		isDsiabledResizePanel?: boolean;
		sizeName: "width" | "height";
	},
) {
	return new Promise((resolve) => {
		if (!resizeTarget.hasAttribute("data-is_resize_panel")) {
			// resolve(resizeTarget);
			// return;
		} else if (isDsiabledResizePanel) {
			resizeTarget.dataset.is_resize_panel = "false";
		}

		resizeTarget.dataset.prev_grow = getGrow(resizeTarget).toString();

		let notCloseList = containers.filter(
			(e) => e.style.flex != "0 1 0%" && e != resizeTarget,
		);
		let notCloseAndOpenTargetList = [...notCloseList, resizeTarget];
		//let resizeWeight = this.mathWeight(notCloseList, this.#forResizeList.length);
		notCloseAndOpenTargetList.forEach((e) => {
			e.style.transition = "flex 0.5s";
			e.ontransitionend = (event) => {
				if (event.propertyName != "flex-grow") {
					return;
				}
				notCloseAndOpenTargetList.forEach(
					(e) => (e.style.transition = ""),
				);
				//e.style.transition = '';
				e.ontransitionend = () => {};
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
			//let percentWeight = this.#forResizeList.length * percent;
			//let remainWeight = resizeWeight * percent;
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

export function openFlex(
	resizeTarget: HTMLElement,
	containers: HTMLElement[],
	{
		isPrevSizeOpen = false,
		isResize = false,
		openGrowImportant = 0,
		sizeName,
	}: {
		isPrevSizeOpen?: boolean;
		isResize?: boolean;
		openGrowImportant?: number;
		sizeName?: "width" | "height"; // 유니언 타입으로 수정
	},
) {
	return new Promise((resolve) => {
		if (!resizeTarget.hasAttribute("data-is_resize_panel")) {
			// resolve(resizeTarget);
			// return;
		} else if (
			resizeTarget.hasAttribute("data-is_resize_panel") &&
			resizeTarget.dataset.is_resize_panel == "false"
		) {
			resizeTarget.dataset.is_resize_panel = "true";
		}

		let notCloseList = containers.filter(
			(e) => e.style.flex != "0 1 0%" && e != resizeTarget,
		);
		let notCloseAndOpenTargetList = [...notCloseList, resizeTarget];
		//let resizeWeight = this.mathWeight(notCloseAndOpenTargetList, this.#forResizeList.length);
		let openTargetGrow = 1;
		const sizeStyleName = ("client" +
			sizeName!.charAt(0).toUpperCase() +
			sizeName!.substring(1)) as "clientHeight" | "clientWidth";
		const parentSize =
			(sizeName &&
				resizeTarget.parentElement &&
				resizeTarget.parentElement[sizeStyleName]) ||
			0;
		if (isPrevSizeOpen && resizeTarget.hasAttribute("data-prev_grow")) {
			openTargetGrow =
				parseFloat(resizeTarget.dataset.prev_grow || "1") || 1;
			//resizeTarget.removeAttribute('data-prev_grow');
		} else if (parentSize && parentSize !== 0) {
			openTargetGrow =
				(parentSize / notCloseList.length / (parentSize - 1)) *
				containers.length;
		} else {
			openTargetGrow = 1;
		}
		if (openGrowImportant) {
			openTargetGrow = openGrowImportant;
		}
		openTargetGrow = openTargetGrow === Infinity ? 1 : openTargetGrow;
		//notCloseList.forEach(e=>{
		notCloseAndOpenTargetList.forEach((e) => {
			e.style.transition = "flex 0.5s";
			e.ontransitionend = (event) => {
				if (event.propertyName != "flex-grow") {
					return;
				}
				notCloseAndOpenTargetList.forEach(
					(e) => (e.style.transition = ""),
				);
				//e.style.transition = '';
				e.ontransitionend = () => {};
			};

			if (e == resizeTarget) {
				resizeTarget.dataset.grow = openTargetGrow.toString();
				resizeTarget.style.flex = `${openTargetGrow} 1 0%`;
				return;
			}

			if (isResize) {
				return;
			}

			let grow =
				(parentSize / notCloseList.length / (parentSize - 1)) *
				(containers.length - openTargetGrow);
			grow = grow === Infinity ? 1 : grow;
			//let percent = getGrow(e) / totalGrow - openTargetGrow / totalGrow;
			e.dataset.grow = grow.toString();

			e.style.flex = `${grow} 1 0%`;
		});

		if (isResize) {
			resize(notCloseAndOpenTargetList, containers.length);
		}

		resolve(openTargetGrow);
	});
}
