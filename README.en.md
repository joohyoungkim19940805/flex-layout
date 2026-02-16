# @byeolnaerim/flex-layout

> This document was drafted by ChatGPT based on the provided codebase and real-world usage examples. Some parts may be inaccurate, and the FlexLayout developer will review and revise it.

A set of components to quickly build **flex-based resizable panels + split screen + Drag & Drop** UI in React (Next.js).

The core of this library is **`<FlexLayout />`**.  
With `FlexLayout` + `FlexLayoutContainer`, you can build layouts where panels are split (row/column), resized by dragging, and optionally opened/closed.  
On top of that, it provides **Split Screen** (dynamic multi-pane views) and Drag & Drop based on **`FlexLayoutSplitScreenDragBox`** / **`useDragCapture`**.

> ⚠️ Many components rely on `window`, `ResizeObserver`, etc. For Next.js (App Router), using them as **Client Components** is recommended. (`"use client"`)

---

## Installation

```bash
# npm
npm i @byeolnaerim/flex-layout

# yarn
yarn add @byeolnaerim/flex-layout

# pnpm
pnpm add @byeolnaerim/flex-layout
```

---

## Quick Start

### 1) FlexLayout + FlexLayoutContainer (basic resizable layout)

```tsx
"use client";

import { FlexLayout, FlexLayoutContainer } from "@byeolnaerim/flex-layout";

export default function Basic() {
	return (
		<div style={{ height: 500 }}>
			<FlexLayout layoutName="basic" direction="row">
				<>
					<FlexLayoutContainer
						containerName="left"
						grow={1}
						isResizePanel
					>
						<div>Left</div>
					</FlexLayoutContainer>

					<FlexLayoutContainer containerName="right" grow={1}>
						<div>Right</div>
					</FlexLayoutContainer>
				</>
			</FlexLayout>
		</div>
	);
}
```

- `direction="row"`: left/right split
- `direction="column"`: top/bottom split
- A container with `isResizePanel={true}` will render a **resize panel** after it.

> **Important:** `layoutName` and `containerName` are used as keys in internal Store/Subjects.  
> If multiple instances of the same layout can appear on the screen, use a stable unique value (e.g. `useId()`) to avoid collisions.

---

## FlexLayout

### import

```ts
import { FlexLayout } from "@byeolnaerim/flex-layout";
```

### Props

- `layoutName: string`  
  A key to identify the layout instance.
- `direction: "row" | "column"`  
  Flex direction (horizontal/vertical split).
- `children: ReactNode`
- `className?: string`
- `panelClassName?: string`  
  Class name for customizing the resize panel style.
- `panelMovementMode?: "default" | "bulldozer"`  
  How adjacent panels are pushed during resizing.

---

## FlexLayoutContainer (paired with FlexLayout)

### import

```ts
import { FlexLayoutContainer } from "@byeolnaerim/flex-layout";
```

### Props

- `containerName: string` _(required)_  
  Panel/container key.
- `children: ReactNode`
- `grow?: number`  
  Flex-grow ratio (e.g. left 2, right 1).
- `className?: string`
- `style?: React.CSSProperties`
- `isResizePanel?: boolean`  
  Whether to place a resize panel after this container.
- `panelMode?: "default" | "left-cylinder" | "right-cylinder" | "top-cylinder" | "bottom-cylinder"`  
  Controls the **visual orientation/anchor** of the resize panel (and the open/close motion).
- `isFitContent?: boolean`  
  Fit based on content size.

---

## (Advanced) Open/Close panels + dynamic grow control

The library provides an RxJS Subject map keyed by `containerName` to send **open/close** events to panels.

### Open/Close with containerOpenCloseSubjectMap

```ts
import { containerOpenCloseSubjectMap } from "@byeolnaerim/flex-layout/providers";

// Example: open right-panel
containerOpenCloseSubjectMap["right-panel"].next({
	mode: "open",
	openOption: { isPrevSizeOpen: true }, // restore previous size
});

// Example: close right-panel
containerOpenCloseSubjectMap["right-panel"].next({
	mode: "close",
});
```

- `mode: "toggle" | "open" | "close"`
- `openOption.isPrevSizeOpen?: boolean`: restore previous opened size
- Optional callbacks: `onOpen?`, `onClose?`

### Control grow directly with useContainers

`useContainers(layoutName)` returns the actual DOM containers for that layout.  
It’s useful for cases like: “only the selected tab container has grow=1, the others have grow=0”, with transitions.

```ts
import { useContainers } from "@byeolnaerim/flex-layout/providers";

const containers = useContainers(layoutName);
// e.g. containers.forEach(el => el.style.flex = "1 1 0%");
```

---

## Split Screen

Split Screen supports the pattern:  
“drag and drop to left/right/top/bottom/center → dynamically create a new split view at that position.”

⚠️ Note: `FlexLayoutSplitScreen` has not been thoroughly validated for stability in real-world usage. It may not behave as you expect.

### 1) FlexLayoutSplitScreen (split root)

```tsx
"use client";

import { FlexLayoutSplitScreen } from "@byeolnaerim/flex-layout";

export default function Page() {
	return (
		<FlexLayoutSplitScreen
			layoutName="rootSplitScreen"
			containerName="dashboard"
			navigationTitle="Dashboard"
			dropDocumentOutsideOption={{
				openUrl: "/",
				widthRatio: 0.7,
				heightRatio: 0.5,
			}}
		>
			<div>Dashboard content</div>
		</FlexLayoutSplitScreen>
	);
}
```

**Props (summary)**

- `layoutName: string`: root key of the split-screen tree
- `containerName: string`: key for this screen/container
- `children: ReactNode`
- `navigationTitle?: string`: title for tabs/navigation
- `dropDocumentOutsideOption?: { openUrl: string; widthRatio?: number; heightRatio?: number }`  
  If dropped “outside the screen”, open it as a new window/document.
- `screenKey?: string`: a unique value used to identify a screen inside `FlexLayoutSplitScreen`. If empty, a 32-character random default is generated. For dynamic split-screen views you can’t control, leaving it empty is recommended.

---

## FlexLayoutSplitScreenDragBox (Split Screen drag source)

`FlexLayoutSplitScreenDragBox` is a **draggable source component**.  
When you drag it and drop on a Split Screen boundary, it renders `targetComponent` at the drop position and creates a new split view.

```tsx
import { FlexLayoutSplitScreenDragBox } from "@byeolnaerim/flex-layout";

<FlexLayoutSplitScreenDragBox
	containerName="menu:users"
	navigationTitle="Users"
	targetComponent={<UsersPage />}
	dropDocumentOutsideOption={{
		openUrl: "/admin/users",
		widthRatio: 0.7,
		heightRatio: 0.5,
	}}
>
	<button>Open Users</button>
</FlexLayoutSplitScreenDragBox>;
```

**Props (summary)**

- `containerName: string` _(required)_: unique key for the draggable item
- `children: ReactNode`: the visible UI
- `targetComponent?: ReactNode`: component to render in the new split pane
- `navigationTitle?: string`
- `dropDocumentOutsideOption?: { openUrl: string; widthRatio?: number; heightRatio?: number }`
- `customData?: any`: arbitrary data passed along on drop
- `scrollTargetRef?: RefObject<HTMLElement>`: scroll target while dragging (optional)

---

## (Advanced) Use Drag & Drop only with FlexLayoutSplitScreenDragBox + useDragCapture

You can use it as **pure Drag & Drop**, without creating Split Screen.

- Drag source: `FlexLayoutSplitScreenDragBox`
- Drop target: `useDragCapture(ref)`

### Example: drop unitCard → slotCard to insert info

```tsx
import { useDragCapture } from "@byeolnaerim/flex-layout";

const dropRef = useRef<HTMLDivElement>(null);
const dragState = useDragCapture(dropRef);

useEffect(() => {
	if (!dragState) return;
	const {
		isDrop,
		containerName, // containerName of the dragged item
		positionName, // boundary position (left/top/right/bottom/center)
		customData, // customData passed from DragBox
	} = dragState;

	if (isDrop) {
		// TODO: handle “equip/insert” logic based on containerName/customData
	}
}, [dragState]);
```

`dragState` includes `isDrop`, `isDragging`, `isOver`, `positionName`, and coordinates (`x`, `y`).

---

## Practical patterns (ideas)

- **Tabs + FlexLayout**  
  Control container `flex` values via `useContainers(layoutName)` and animate  
  “selected tab grow=1, others grow=0”.
- **Master–Detail (left list / right detail)**  
  Open/close the detail panel with  
  `containerOpenCloseSubjectMap["right"].next({ mode: selected ? "open" : "close" })`.
- **Admin Split Screen**  
  Drag sidebar items (`FlexLayoutSplitScreenDragBox`) → create a new split view at the desired position.

---

## Export paths

Use whichever import style you prefer.

```ts
// 1) unified imports from root
import {
	FlexLayout,
	FlexLayoutContainer,
	FlexLayoutSplitScreen,
	FlexLayoutSplitScreenDragBox,
} from "@byeolnaerim/flex-layout";

// 2) components subpath (if preferred)
import {
	FlexLayout,
	FlexLayoutContainer,
} from "@byeolnaerim/flex-layout/components";
```

---

## Tips

- Use a meaningful prefix for `containerName` (e.g. `left-container-${id}`, `menu:${identifierId}`)  
  This makes debugging and preventing collisions much easier in Split Screen.
- In Next.js, add `"use client"` at the top of files that use these layout components.

---

## The internal implementation/style structure is still evolving, so the API may change over time.
