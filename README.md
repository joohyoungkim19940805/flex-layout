# @byeolnaerim/flex-layout

> This document was drafted by ChatGPT using the codebase and real-world usage examples provided by the FlexLayout developer. It may contain inaccuracies, and the developer will verify and update it after review.

A set of components to quickly build **flex-based resizable panels + split screen + Drag & Drop** UI in React (Next.js).

The core of this library is **`<FlexLayout />`**.  
With `FlexLayout` + `FlexLayoutContainer`, you can build layouts where panels are split in one direction (`row` / `column`), resized by dragging, and optionally opened/closed.  
On top of that, it provides **Split Screen** (dynamic multi-pane views) and Drag & Drop based on **`FlexLayoutSplitScreenDragBox`** / **`useDragCapture`**.

> ℹ️ **Next.js App Router note**  
> The main components of `@byeolnaerim/flex-layout` include `"use client"` internally, so they can usually be imported and rendered from Server Components such as `app/layout.tsx`.
>
> If your environment or build setup still pulls the package into a server-side scope and causes an error, create a small client wrapper or use `dynamic(..., { ssr: false })`.

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

### Requirements

- React >= 18
- React DOM >= 18

`rxjs (>= 7)` and `fast-deep-equal (3.1.3)` are included as runtime dependencies, so you normally do not need to install them separately.

Type definitions (`.d.ts`) are included in the package and can be used directly from TypeScript.

Styles are imported by the components through CSS Modules, so no separate global CSS import is required.

### Next.js fallback patterns

Most Next.js App Router projects can import the main components directly.

If your build/runtime environment still reports a server-side import issue, use one of the following patterns.

#### Option 1. Client wrapper

```tsx
// FlexLayoutClient.tsx
"use client";

export {
	FlexLayout,
	FlexLayoutContainer,
	FlexLayoutSplitScreen,
} from "@byeolnaerim/flex-layout";
```

Then import from that wrapper in a Server Component:

```tsx
import {
	FlexLayout,
	FlexLayoutContainer,
	FlexLayoutSplitScreen,
} from "@/components/FlexLayoutClient";
```

#### Option 2. Dynamic import

```tsx
import dynamic from "next/dynamic";

const FlexLayout = dynamic(
	() => import("@byeolnaerim/flex-layout").then((m) => m.FlexLayout),
	{ ssr: false },
);
```

---

## Next.js App Router: URL-based Split Screen

The Next.js entry renders an `app/**/page.tsx` inside a split pane **from only its URL**, without requiring the consumer to build a target component.

- No `@split` Parallel Route is required.
- No per-page `split.tsx` or `CallUrlClientComponent` is required.
- Only the `page.tsx` selected by the dropped URL is dynamically imported on the server.
- The generated registry contains literal static import paths, so Turbopack can discover every candidate at build time.
- RSC rendering is the default. `iframe` defaults to `false`.

### 1. Generate the registry

Keep the app-specific values as a hardcoded configuration at the top of the consuming project's script. No CLI arguments are required.

```js
// scripts/generateFlexLayoutSplitScreenPageRegistry.mjs
import { generateFlexLayoutSplitScreenPageRegistry } from "@byeolnaerim/flex-layout/next/generator";

const registryConfigs = [
	{
		appDir: "apps/admin/src/app",
		outFile: "apps/admin/src/generated/flexLayoutPageRegistry.ts",
		excludedRoutes: [
			"default-menu/auction-management/analysis-management/register-analysis-target",
		],
	},
	{
		appDir: "apps/asset_manager/src/app",
		outFile: "apps/asset_manager/src/generated/flexLayoutPageRegistry.ts",
		excludedRoutes: [],
	},
];

registryConfigs.forEach((config) => {
	generateFlexLayoutSplitScreenPageRegistry(config);
});
```

```json
{
	"scripts": {
		"generate:flex-layout-pages": "node scripts/generateFlexLayoutSplitScreenPageRegistry.mjs",
		"prebuild": "npm run generate:flex-layout-pages"
	}
}
```

Generated files use generic exports rather than app-prefixed names:

```ts
pageRegistry
resolvePage
FlexLayoutNextProvider
```

Main generator options:

- `appDir`: Next.js App Router directory to scan
- `outFile`: generated TypeScript output
- `excludedRoutes`: URL patterns excluded from the registry
- `basePath`: set this when the Next.js app uses `basePath`
- `includeLayouts`: compose ancestor `layout.tsx` modules. Defaults to `false`
- `excludeRootLayout`: exclude `app/layout.tsx`. Defaults to `true`
- `excludedLayouts`: extensionless layout paths relative to `appDir`
- `providerId`: only needed when multiple generated providers share the same page tree
- `cookieOptions`: `path`, `domain`, `secure`, `sameSite`, and `maxAge` for the Server Action render-request cookie

`includeLayouts` is intentionally disabled by default. Root and upper layouts commonly contain headers, sidebars, providers, or the FlexLayout shell itself. Re-applying them inside a pane can duplicate the shell or create recursive UI. Enable it only when the required nested layouts are known and safe.

### 2. Mount the generated Provider once

Wrap the shared Server Layout that contains the FlexLayout, menu drag boxes, and split screen.

```tsx
// app/layout.tsx
import FlexLayoutNextProvider from "@/generated/flexLayoutPageRegistry";
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body>
				<FlexLayoutNextProvider>
					{children}
				</FlexLayoutNextProvider>
			</body>
		</html>
	);
}
```

On drop, the Provider internally invokes a Server Action that records the requested URL in a short-lived HTTP-only cookie. The cookie mutation rerenders the current RSC tree, the generated registry resolves the URL, and the server-rendered `page.tsx` node is merged into the existing FlexLayout pane.

### 3. Pass only the URL to the DragBox

Import `FlexLayoutSplitScreenDragBox` from the Next.js entry.

```tsx
"use client";

import { FlexLayoutSplitScreenDragBox } from "@byeolnaerim/flex-layout/next";
import Link from "next/link";

export function MenuItem({ url, title }: { url: string; title: string }) {
	return (
		<FlexLayoutSplitScreenDragBox
			url={url}
			containerName={`menu-${url}`}
			navigationTitle={title}
			dropDocumentOutsideOption={{
				openUrl: url,
				widthRatio: 0.7,
				heightRatio: 0.5,
			}}
		>
			<Link href={url}>{title}</Link>
		</FlexLayoutSplitScreenDragBox>
	);
}
```

An explicitly supplied `targetComponent` takes precedence over automatic URL rendering.

### 4. iframe rendering

An iframe is used only when `iframe` is explicitly set to `true`. The default is `false`.

```tsx
<FlexLayoutSplitScreenDragBox
	url="https://example.com"
	iframe
	iframeProps={{
		title: "External page",
		sandbox: "allow-same-origin allow-scripts allow-forms allow-popups",
		referrerPolicy: "no-referrer",
	}}
	containerName="external-page"
	navigationTitle="External page"
>
	<div>External page</div>
</FlexLayoutSplitScreenDragBox>
```

The iframe automatically disables pointer events while a FlexLayout drag or resize operation is active. Standard iframe attributes and styles can be overridden through `iframeProps`.

### Scope and limitations

- The RSC renderer accepts only local relative URLs in the current Next app. Use `iframe` for external or absolute URLs.
- Server Components, async pages, `cookies()`, `headers()`, and server-side data access execute on the server.
- Dynamic URL segments and query strings are passed to the page as `params` and `searchParams`.
- A pane is not an independent Next Router. Client Components inside the page still resolve `usePathname()`, `useParams()`, and `useSearchParams()` against the browser's real URL, not the pane URL.
- `redirect()` and `notFound()` inside an imported page can affect the containing Next route rather than only the pane.
- `loading.tsx`, `error.tsx`, `not-found.tsx`, and metadata are not automatically composed by the registry.
- Route segment configuration such as `dynamic`, `revalidate`, `runtime`, and `preferredRegion` is not applied independently to a pane; the containing route controls runtime and caching.
- Because the Provider reads `cookies()`, the route tree containing it becomes dynamically rendered.
- Server Actions require a server and do not work with `output: "export"`. Use `iframe` or an explicit `targetComponent` for static exports.

---

## Quick Start

`FlexLayout` basically manages a split layout in a single direction.

### 1) Basic row split

```tsx
import { FlexLayout, FlexLayoutContainer } from "@byeolnaerim/flex-layout";

export default function BasicRow() {
	return (
		<FlexLayout layoutName="basic-row_1" direction="row">
			<FlexLayoutContainer containerName="basic-row_1-left" isResizePanel>
				<div>Left</div>
			</FlexLayoutContainer>

			<FlexLayoutContainer containerName="basic-row_1-mid" isResizePanel>
				<div>Mid</div>
			</FlexLayoutContainer>

			<FlexLayoutContainer containerName="basic-row_1-right">
				<div>Right</div>
			</FlexLayoutContainer>
		</FlexLayout>
	);
}
```

- `direction="row"`: left/right split
- `direction="column"`: top/bottom split
- When `isResizePanel` is `true`, a resize panel is rendered as a sibling of that container.
- In most cases, you do not need to add `isResizePanel` to the last container. Doing so can conflict with the browser's own resize behavior and degrade the user experience.
- When containers are rendered dynamically, prefer controlling `isResizePanel` with state instead of always rendering it as `true`.

> **Important:** `layoutName` and `containerName` are used as DOM `id` values and as keys for internal Store/Subject-based APIs such as `getLayoutInfos` and `useDecompositionLayout`.
>
> They should be unique and stable within the page. Avoid whitespace or unusual special characters; prefer letters, numbers, `-`, and `_`.

### 2) Column split + grow

```tsx
import { FlexLayout, FlexLayoutContainer } from "@byeolnaerim/flex-layout";

export default function BasicColumn() {
	return (
		<FlexLayout layoutName="basic-column_3" direction="column">
			<FlexLayoutContainer
				containerName="basic-column_3-top"
				isResizePanel
				grow={0.45}
			>
				<div>Top</div>
			</FlexLayoutContainer>

			<FlexLayoutContainer
				containerName="basic-column_3-mid"
				isResizePanel
			>
				<div>Mid</div>
			</FlexLayoutContainer>

			<FlexLayoutContainer containerName="basic-column_3-bottom">
				<div>Bottom</div>
			</FlexLayoutContainer>
		</FlexLayout>
	);
}
```

If `grow` is not specified, containers without an explicit value receive an equal share of the remaining grow value after explicitly assigned grow values are excluded.

As a rule of thumb, avoid assigning a `grow` value greater than the number of containers.

### 3) Nested split layout

`FlexLayout` manages one direction at a time. If you need both horizontal and vertical splits, nest another `FlexLayout` inside a `FlexLayoutContainer`.

```tsx
import { FlexLayout, FlexLayoutContainer } from "@byeolnaerim/flex-layout";

export default function NestedSplit() {
	return (
		<FlexLayout layoutName="nested-root" direction="row">
			<FlexLayoutContainer containerName="nested-left" isResizePanel>
				<FlexLayout layoutName="nested-left-column" direction="column">
					<FlexLayoutContainer
						containerName="nested-left-top"
						isResizePanel
					>
						<div>Left Top</div>
					</FlexLayoutContainer>
					<FlexLayoutContainer containerName="nested-left-bottom">
						<div>Left Bottom</div>
					</FlexLayoutContainer>
				</FlexLayout>
			</FlexLayoutContainer>

			<FlexLayoutContainer containerName="nested-right">
				<div>Right</div>
			</FlexLayoutContainer>
		</FlexLayout>
	);
}
```

Because `FlexLayout` is based on CSS flex, a `column` layout needs a parent height that can actually be calculated. If the parent height is `auto` or there is no resizable free space, resizing may not work as expected.

### 4) min/max + isFitContent

You can constrain the resize range by applying CSS min/max size to a container.

```ts
import { getLayoutInfos } from "@byeolnaerim/flex-layout/providers";

const [handleSizeTarget, setHandleSizeTarget] = useState<HTMLElement | null>(
	null,
);

useEffect(() => {
	const layoutSubscribe = getLayoutInfos("basic-row_7").subscribe(
		(layout) => {
			const leftContainer =
				layout.container?.["basic-row_7-left"]?.current;
			if (leftContainer) {
				setHandleSizeTarget(leftContainer);
			}
		},
	);

	return () => {
		layoutSubscribe.unsubscribe();
	};
}, []);

useEffect(() => {
	if (!handleSizeTarget) return;
	handleSizeTarget.style.minWidth = "25px";
	handleSizeTarget.style.maxWidth = "180px";
}, [handleSizeTarget]);
```

Or use `useDecompositionLayout`.

```ts
import { useDecompositionLayout } from "@byeolnaerim/flex-layout/providers";

const {
	layout: containers,
	container,
	resizePanel,
} = useDecompositionLayout({
	layoutName: "basic-row_7",
	containerName: "basic-row_7-left",
});

useEffect(() => {
	if (!container) return;
	container.style.minWidth = "25px";
	container.style.maxWidth = "180px";
}, [container]);
```

Use `isFitContent` when you want a container's internal content size to act as its maximum size.

```tsx
<FlexLayout layoutName="basic-row_7" direction="row">
	<FlexLayoutContainer containerName="basic-row_7-left" isResizePanel>
		<div>Left</div>
	</FlexLayoutContainer>

	<FlexLayoutContainer containerName="basic-row_7-mid" isResizePanel>
		<div>Mid</div>
	</FlexLayoutContainer>

	<FlexLayoutContainer containerName="basic-row_7-right" isFitContent>
		<div style={{ whiteSpace: "nowrap", paddingRight: "1rem" }}>
			I'm Using Fit Content
		</div>
	</FlexLayoutContainer>
</FlexLayout>
```

Do not apply max-size constraints such as `isFitContent` to every container unless that is intentional. At least one container should usually remain without a max-size constraint so the layout has room to resize.

### 5) Panel movement mode

`panelMovementMode` controls how adjacent panels interact while resizing. The default is `"divorce"`.

```tsx
const [mode, setMode] = useState<"bulldozer" | "divorce" | "stalker">(
	"bulldozer",
);

<FlexLayout
	layoutName={`panel-movement-demo-${mode}`}
	direction="column"
	panelMovementMode={mode}
>
	<FlexLayoutContainer containerName="panel-top" isResizePanel>
		<div>Top</div>
	</FlexLayoutContainer>
	<FlexLayoutContainer containerName="panel-mid1" isResizePanel>
		<div>Mid 1</div>
	</FlexLayoutContainer>
	<FlexLayoutContainer containerName="panel-mid2" isResizePanel>
		<div>Mid 2</div>
	</FlexLayoutContainer>
	<FlexLayoutContainer containerName="panel-bottom">
		<div>Bottom</div>
	</FlexLayoutContainer>
</FlexLayout>;
```

- `"bulldozer"`: pushes adjacent panels but does not stick them together.
- `"divorce"`: pushes adjacent panels and sticks them together, but separates them again when the resize returns to the starting point. This is the default mode.
- `"stalker"`: keeps adjacent panels fully attached, but separates them again when the edge is reached.

---

## FlexLayout

### import

```ts
import { FlexLayout } from "@byeolnaerim/flex-layout";
```

### Props

- `layoutName: string`  
  A key to identify the layout instance. It is also used as a DOM `id` and as a key for internal Store/Subject APIs.
- `direction: "row" | "column"`  
  Flex direction. `"row"` creates a horizontal split and `"column"` creates a vertical split.
- `children: ReactNode`
- `className?: string`
- `panelClassName?: string`  
  Class name for customizing the resize panel style.
- `panelMovementMode?: "bulldozer" | "divorce" | "stalker"`  
  Controls how adjacent panels interact while resizing. The default is `"divorce"`.
- `rememberResize?: { storage: "auto" | "indexeddb" | "websql" | "localstorage" | "sessionstorage"; keyName?: string; name?: string; storeName?: string; keyPrefix?: string }`  
  Persists the latest resize `grow` map for all containers in this layout. Resize memory is configured on `FlexLayout`, not on each `FlexLayoutContainer`, because each grow value is part of the same distributed layout. When omitted, resize memory is disabled and no in-memory store is created.

```tsx
<FlexLayout
	layoutName="basic-row_1"
	direction="row"
	rememberResize={{ storage: "sessionstorage" }}
>
	<FlexLayoutContainer containerName="left" isResizePanel>
		<div>Left</div>
	</FlexLayoutContainer>
	<FlexLayoutContainer containerName="right">
		<div>Right</div>
	</FlexLayoutContainer>
</FlexLayout>
```

By default, the persistence key is `__flexLayoutResizeGrow:${layoutName}`. Use `keyName` when multiple layouts need to share or separate a custom persisted resize state.

---

## FlexLayoutContainer (paired with FlexLayout)

### import

```ts
import { FlexLayoutContainer } from "@byeolnaerim/flex-layout";
```

### Props

- `containerName: string` _(required)_  
  Panel/container key. It is also used as a DOM `id` and as a key for internal Store/Subject APIs.
- `children: ReactNode`
- `grow?: number`  
  Defines the initial ratio for a specific container. Containers without an explicit `grow` value receive an equal share of the remaining grow value after explicitly assigned grow values are excluded. Prefer not to assign a `grow` value greater than the number of containers.
- `className?: string`
- `style?: React.CSSProperties`
- `isResizePanel?: boolean`  
  Renders a resize panel as a sibling of this container. The resize panel belongs to the container that declares `isResizePanel`, but it controls the sibling panels on both sides. In most cases, avoid adding it to the last container.
- `panelMode?: "default" | "left-cylinder" | "right-cylinder" | "top-cylinder" | "bottom-cylinder"`  
  Controls the **visual orientation/anchor** of the resize panel and the open/close motion.
- `isFitContent?: boolean`  
  Prevents the container from being resized larger than the size of its child content.

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
It is useful for cases like: “only the selected tab container has grow=1, the others have grow=0”, with transitions.

```ts
import { useContainers } from "@byeolnaerim/flex-layout/providers";

const containers = useContainers(layoutName);
// e.g. containers.forEach((el) => (el.style.flex = "1 1 0%"));
```

---

## Split Screen

Split Screen supports the pattern:  
“drag and drop to left/right/top/bottom/center → dynamically create a new split view at that position.”

⚠️ Note: `FlexLayoutSplitScreen` has not been thoroughly validated for stability in real-world usage. It may not behave as you expect.

### 1) FlexLayoutSplitScreen (split root)

```tsx
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
- `screenKey?: string`: a unique value used to identify a screen inside `FlexLayoutSplitScreen`. If empty, a 32-character random default is generated. For dynamic split-screen views you cannot control, leaving it empty is recommended.

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
- `targetComponent?: ReactElement`: component to render in the new split pane
- `url?: string`: URL rendered by iframe mode or by the Next.js-specific DragBox
- `iframe?: boolean`: render the URL in an iframe. Defaults to `false`
- `iframeProps?: IframeHTMLAttributes<HTMLIFrameElement>`: iframe attributes and styles
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

- Use a meaningful prefix for `containerName` (e.g. `left-container-${id}`, `menu:${identifierId}`).
- In Next.js App Router, the main components already include `"use client"` internally, so you usually do not need to add `"use client"` only because you render `FlexLayout`.
- If your page also uses client-only hooks such as `useState`, `useEffect`, or event handlers directly, that file still needs to be a Client Component.
- If a build/environment issue occurs because the package is included in a server-side scope, use a client wrapper or `dynamic(..., { ssr: false })`.

---

## The internal implementation/style structure is still evolving, so the API may change over time.
