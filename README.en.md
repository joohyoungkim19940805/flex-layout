# @byeolnaerim/flex-layout


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
- Next.js >= 14.2 < 17 (when using `@byeolnaerim/flex-layout/next`; optional peer dependency)

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

Split Screen supports the pattern: “drag a screen to the left/right/top/bottom/center → dynamically create a new split view at that position.” Multiple screens in the same center area are managed like tabs, and their titles can be reordered with drag and drop.

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
- `containerName: string`: key of the initial center screen
- `children: ReactElement`: screen rendered in the initial center
- `navigationTitle: string`: label of the initial screen in the tab/navigation area
- `navigationTitleComponent?: ReactElement<{ children?: ReactNode }>`: shared wrapper used when each tab's `navigationTitle` string is rendered
- `titleWrapperComponent?: ReactElement<{ children?: ReactNode }>`: shared wrapper around the rendered title content and close button. It does not replace the outer Drag & Drop root
- `dropGuideComponent?: ReactNode`: guide UI shown over an available split-drop area while dragging. Uses the default guide when omitted
- `titleCloseButtonComponent?: ReactNode`: tab close UI. `undefined` uses the default `X`; `null` hides the close button
- `titleMoreButtonComponent?: ReactNode`: More trigger at the right side of the title area. `undefined` uses the default `...`; `null` hides More
- `renderTitleMoreMenu?: (context) => ReactNode`: replaces the complete default More menu content
- `renderTitleMoreMenuItems?: (context) => ReactNode`: appends consumer-defined items after the default More menu items
- `dropDocumentOutsideOption?: { openUrl: string; widthRatio?: number; heightRatio?: number; isNewTap?: boolean }`: URL/window options used for document-outside drop and “Open in new window”
- `screenKey?: string`: screen identity key. Generated internally when omitted
- `preserveStateOnUnmount?: boolean`: keep the current root split-screen **in-memory** store when the component unmounts. Defaults to `false`. This is separate from browser-reload persistence
- `isResetOnChildrenChange?: boolean`: **deprecated**. It is no longer used at runtime and will be removed. `children` is always refreshed without resetting the current split structure
- `isRemoveStoreOnUnmount?: boolean`: **deprecated**. Use `preserveStateOnUnmount`. For compatibility, `false` maps to `preserveStateOnUnmount={true}` and `true` maps to `preserveStateOnUnmount={false}`; the new prop takes precedence

### 2) Roles of `navigationTitle` and `navigationTitleComponent`

`navigationTitle` is **label data for a screen**. `navigationTitleComponent` is a **shared wrapper** used by the receiving Split Screen when that label is actually rendered in the title UI.

`FlexLayoutSplitScreenDragBox` carries only the `navigationTitle` string. It does not carry `navigationTitleComponent`, so when a screen is moved to another Split Screen, its title adopts the **destination Split Screen's `navigationTitleComponent` styling**.

```tsx
import type { ReactNode } from "react";
import { FlexLayoutSplitScreen } from "@byeolnaerim/flex-layout";

function SplitScreenTitle({ children }: { children?: ReactNode }) {
	return <strong className="split-screen-title">{children}</strong>;
}

<FlexLayoutSplitScreen
	layoutName="rootSplitScreen"
	containerName="dashboard"
	navigationTitle="Dashboard"
	navigationTitleComponent={<SplitScreenTitle />}
>
	<div>Dashboard content</div>
</FlexLayoutSplitScreen>;
```

Conceptually, the initial title above is rendered as `<SplitScreenTitle>Dashboard</SplitScreenTitle>`. If a DragBox with `navigationTitle="Users"` is later dropped into the same Split Screen, `Users` is rendered through the same wrapper.

### 3) Customize the title wrapper / close button

`titleWrapperComponent` wraps only the **rendered title content + close button** for each tab. The outer title root that owns Drag & Drop remains unchanged, so tab movement and title reordering continue to work when a custom wrapper is used.

`titleCloseButtonComponent` replaces only the close-button UI. Split Screen still owns the click handling that closes the tab.

```tsx
<FlexLayoutSplitScreen
	layoutName="rootSplitScreen"
	containerName="dashboard"
	navigationTitle="Dashboard"
	titleWrapperComponent={<div className="split-screen-title-wrapper" />}
	titleCloseButtonComponent={<span aria-hidden>×</span>}
>
	<div>Dashboard content</div>
</FlexLayoutSplitScreen>
```

- omit `titleWrapperComponent`: no extra wrapper DOM is added
- `titleCloseButtonComponent === undefined`: use the default `X` button
- `titleCloseButtonComponent === null`: hide the close button
- pass a custom component to replace the UI while keeping the library-managed close behavior

### 4) Customize the split-drop guide

While dragging over an actual split-drop area, Split Screen shows the default `⬇️드롭하면 화면이 분할됩니다.` guide. Pass `dropGuideComponent` to replace only that UI.

```tsx
<FlexLayoutSplitScreen
	layoutName="rootSplitScreen"
	containerName="dashboard"
	navigationTitle="Dashboard"
	dropGuideComponent={<div>Drop here to create another view.</div>}
>
	<div>Dashboard content</div>
</FlexLayoutSplitScreen>
```

The title area is handled separately as the tab-reorder drop zone, so the split guide is not shown while reordering titles.

### 5) Reorder tab titles

Center tabs in the same Split Screen can be reordered by dragging their titles.

- Drop on the **left half** of a title → move before the target
- Drop on the **right half** of a title → move after the target
- The active tab is preserved by `screenKey` even when other tabs move around it
- Dragging out of the title area and into an actual Split Screen drop region continues to use the existing screen-splitting drag behavior

### 6) Default More menu

The default `...` button at the right side of the title area provides these actions for the active tab:

1. Close current tab
2. Close all other tabs
3. Close all tabs to the right
4. Close all tabs in the current split
5. Open in a new window when `dropDocumentOutsideOption.openUrl` is available

The More menu is rendered into `document.body` with a React Portal, so it is not clipped by Split Screen overflow. Its position is calculated from the trigger rectangle and actual menu size, clamped to the viewport, and recalculated on scroll/resize. Outside pointer down or `Escape` closes it.

### 7) Extend the More trigger and menu

`titleMoreButtonComponent`, `renderTitleMoreMenuItems`, and `renderTitleMoreMenu` customize different layers.

```tsx
<FlexLayoutSplitScreen
	layoutName="rootSplitScreen"
	containerName="dashboard"
	navigationTitle="Dashboard"
	titleMoreButtonComponent={<button type="button">Menu</button>}
	renderTitleMoreMenuItems={(context) => (
		<button
			type="button"
			onClick={() => {
				console.log(context.activeItem);
				context.closeMenu();
			}}
		>
			Custom action
		</button>
	)}
>
	<div>Dashboard content</div>
</FlexLayoutSplitScreen>
```

- `titleMoreButtonComponent`: replaces only the `...` trigger
- `renderTitleMoreMenuItems`: keeps the five built-in actions and appends custom menu items
- `renderTitleMoreMenu`: replaces all default menu content while retaining the library-managed Portal, positioning, outside-click handling, and Escape handling

The context passed to `renderTitleMoreMenu` / `renderTitleMoreMenuItems` includes:

- identity: `rootName`, `layoutName`, `containerName`, `screenKey`
- active tab: `activeItem`, `activeIndex`
- all center tabs: `items`
- menu control: `closeMenu()`
- built-in actions: `closeCurrentTab()`, `closeOtherTabs()`, `closeTabsToRight()`, `closeAllTabs()`, `openInNewWindow()`
- availability flags: `canCloseOtherTabs`, `canCloseTabsToRight`, `canOpenInNewWindow`

To replace the whole menu content:

```tsx
<FlexLayoutSplitScreen
	layoutName="rootSplitScreen"
	containerName="dashboard"
	navigationTitle="Dashboard"
	renderTitleMoreMenu={(context) => (
		<div role="menu">
			<button type="button" onClick={context.closeCurrentTab}>
				Close current view
			</button>
			<button type="button" onClick={context.closeMenu}>
				Close menu
			</button>
		</div>
	)}
>
	<div>Dashboard content</div>
</FlexLayoutSplitScreen>
```

#### Complete design customization example

For the complete `FlexLayoutSplitScreen` styling used by the site, see [`README.splitScreenCustomizeStyle.md`](./README.splitScreenCustomizeStyle.md). It shows `navigationTitleComponent`, `titleWrapperComponent`, `dropGuideComponent`, `titleCloseButtonComponent`, `titleMoreButtonComponent`, and `renderTitleMoreMenu` working together.

The example intentionally contains the actual site code, including MUI, MUI Icons, and site-specific i18n/theme utilities that are **not** dependencies of `@byeolnaerim/flex-layout`. It is documentation-only code and is not compiled into the library build/`dist`. Copy only the parts you need and adapt them to your project.

### 8) Cancel an active drag

Press `Escape` while dragging a `FlexLayoutSplitScreenDragBox` to cancel the current drag. The drag clone and pending drag state are cleared, `isDragging: false` / `isDrop: false` is emitted, the split-drop guide disappears immediately, and the following mouse/touch end does not perform a drop.

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
- `navigationTitle?: string`: label data for the dropped screen. Title rendering style belongs to the destination `FlexLayoutSplitScreen.navigationTitleComponent`, not the DragBox
- `dropDocumentOutsideOption?: { openUrl: string; widthRatio?: number; heightRatio?: number; isNewTap?: boolean }`
- `customData?: Record<string, string | number | boolean | undefined>`: custom data carried with the drag state
- `scrollTargetRef?: RefObject<HTMLElement>`: scroll target while dragging (optional)

Press `Escape` during a drag to cancel it without executing the drop callback or creating a split.

---

## Next.js App Router: URL-based Split Screen

The Next.js entry renders an `app/**/page.tsx` inside a split pane **from only its URL**, without requiring the consumer to build a target component.

- No `@split` Parallel Route is required.
- Only the `page.tsx` selected by the dropped URL is dynamically imported on the server.
- The generated registry contains literal static import paths, so Turbopack can discover every candidate at build time.
- RSC rendering is the default. `iframe` defaults to `false`.
- The generated `FlexLayoutNextSplitScreen` is the wrapper for URL-based RSC rendering and can also act as the persistence boundary for browser reload/history restoration.

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

Generated files use generic exports:

```ts
pageRegistry
resolvePage
FlexLayoutNextSplitScreen
```

Main generator options:

- `appDir`: Next.js App Router directory to scan
- `outFile`: generated TypeScript output
- `excludedRoutes`: URL patterns excluded from the registry
- `basePath`: set this when the Next.js app uses `basePath`
- `includeLayouts`: compose ancestor `layout.tsx` modules. Defaults to `false`
- `excludeRootLayout`: exclude `app/layout.tsx`. Defaults to `true`
- `excludedLayouts`: extensionless layout paths relative to `appDir`
- `providerId`: only needed when multiple generated wrappers share the same page tree
- `cookieOptions`: `path`, `domain`, `httpOnly`, `secure`, `sameSite`, and `maxAge` for the Server Action render-request cookie

`includeLayouts` is intentionally disabled by default. Root and upper layouts commonly contain headers, sidebars, providers, or the FlexLayout shell itself. Re-applying them inside a pane can duplicate the shell or create recursive UI. Enable it only when the required nested layouts are known and safe.

The generated `FlexLayoutNextSplitScreen` accepts a `persistence` prop at usage time, so browser persistence does not need to be hardcoded into the generator configuration.

### 2. Mount the generated FlexLayoutNextSplitScreen

`FlexLayoutNextSplitScreen` is not required around every regular `FlexLayout`. It is the Next.js-specific wrapper around the **`FlexLayoutSplitScreen` tree that receives URL-based server-rendered panes**.

```tsx
// app/layout.tsx or a shared Server Layout that renders FlexLayoutSplitScreen
import FlexLayoutNextSplitScreen from "@/generated/flexLayoutPageRegistry";
import { FlexLayoutSplitScreen } from "@byeolnaerim/flex-layout";
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<FlexLayoutNextSplitScreen>
			<FlexLayoutSplitScreen
				layoutName="root-split-screen"
				containerName="main-split-screen"
				navigationTitle="ROOT"
			>
				{children}
			</FlexLayoutSplitScreen>
		</FlexLayoutNextSplitScreen>
	);
}
```

On drop, the wrapper internally invokes a Server Action that records the requested URL in a short-lived HTTP-only cookie. The cookie mutation rerenders the current RSC tree, the generated registry resolves the URL, and the server-rendered `page.tsx` node is merged into the existing `FlexLayoutSplitScreen` pane.

### 3. Restore Split Screen across reloads / browser URLs

Pass `persistence` to serialize the restorable Next URL-pane split structure through `@byeolnaerim/global-rx-state` storage and restore it later.

```tsx
<FlexLayoutNextSplitScreen
	persistence={{
		storage: "auto",
		restoreOnReload: true,
		syncWithBrowserUrl: true,
	}}
>
	<FlexLayoutSplitScreen
		layoutName="root-split-screen"
		containerName="main-split-screen"
		navigationTitle="ROOT"
	>
		{children}
	</FlexLayoutSplitScreen>
</FlexLayoutNextSplitScreen>
```

`persistence` options:

- `storage: "auto" | "indexeddb" | "websql" | "localstorage" | "sessionstorage"` _(required)_: persistence backend. `"in-memory"` is intentionally unsupported
- `keyName?: string`: global-rx-state persistence key. Defaults to `__flexLayoutNextSplitScreen:${providerId}`
- `name?: string`, `storeName?: string`, `keyPrefix?: string`: storage-specific options
- `restoreOnReload?: boolean`: restore after a full reload. Defaults to `true`. When `false`, Split Screen persistence for this wrapper is disabled
- `syncWithBrowserUrl?: boolean`: keep a separate snapshot for each browser URL. Defaults to `false`

A pane is restorable only when all of the following are true:

- it belongs to a `FlexLayoutSplitScreen` registered under the `FlexLayoutNextSplitScreen` wrapper
- it was created with the Next-specific `FlexLayoutSplitScreenDragBox`
- `url` is provided
- no explicit `targetComponent` is provided
- `iframe !== true`
- `persistence` is enabled

Persistent snapshots do not store ReactElements, functions, refs, or other runtime objects. They store only restorable data such as split topology/order/direction, `screenKey`, `containerName`, `navigationTitle`, URL, and document-outside options.

Panes with an explicit `targetComponent` and iframe panes still work normally at runtime, including split and move operations, but they are omitted from persistent snapshots. They therefore disappear after a reload or URL-snapshot restore. If a restorable URL pane was structurally nested under one of those non-restorable panes, it is promoted to a root center tab when possible instead of being discarded.

The root ReactElement itself is also not persisted. During restore, the wrapper uses the **current route's root `children`** and reconnects it to the persisted root `screenKey` and split topology.

#### `syncWithBrowserUrl: false`

A single latest workspace snapshot is kept.

- route changes keep the current split workspace
- a full reload restores the most recently saved URL-backed split workspace

#### `syncWithBrowserUrl: true`

Snapshots are keyed by `pathname + search`.

- navigating or using back/forward to a URL with an existing snapshot restores that URL's complete URL-backed split workspace
- the first visit to a URL without a snapshot inherits the current workspace and saves it as that URL's initial snapshot
- the hash is not part of the snapshot key
- repeated entries for the same URL in browser history use the **latest snapshot for that URL**, not per-history-entry state

### 4. Pass only the URL to the DragBox

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

An explicitly supplied `targetComponent` takes precedence over automatic URL rendering. Such a pane still participates in the runtime split tree but is excluded from persistence restoration.

### 5. iframe rendering

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

The iframe automatically disables pointer events while a FlexLayout drag or resize operation is active. Standard iframe attributes and styles can be overridden through `iframeProps`. Iframe mode does not use RSC server rendering or Split Screen persistence restoration, so that pane itself does not require the `FlexLayoutNextSplitScreen` wrapper.

### Scope and limitations

- The RSC renderer accepts only local relative URLs in the current Next app. Use `iframe` for external or absolute URLs.
- Server Components, async pages, `cookies()`, `headers()`, and server-side data access execute on the server.
- Dynamic URL segments and query strings are passed to the page as `params` and `searchParams`.
- A pane is not an independent Next Router. Client Components inside the page still resolve `usePathname()`, `useParams()`, and `useSearchParams()` against the browser's real URL, not the pane URL.
- `redirect()` and `notFound()` inside an imported page can affect the containing Next route rather than only the pane.
- `loading.tsx`, `error.tsx`, `not-found.tsx`, and metadata are not automatically composed by the registry.
- Route segment configuration such as `dynamic`, `revalidate`, `runtime`, and `preferredRegion` is not applied independently to a pane; the containing route controls runtime and caching.
- Because `FlexLayoutNextSplitScreen` reads `cookies()`, the route tree containing the wrapper becomes dynamically rendered.
- Server Actions require a server, so URL-based RSC rendering does not work with `output: "export"`. Use `iframe` or an explicit `targetComponent` for static exports.

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
