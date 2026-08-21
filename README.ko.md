# @byeolnaerim/flex-layout

React(Next.js)에서 **flex 기반 리사이즈 패널 + 스플릿 스크린 + Drag & Drop** UI를 빠르게 만들기 위한 컴포넌트 모음입니다.

이 라이브러리의 핵심은 **`<FlexLayout />`** 입니다.  
`FlexLayout` + `FlexLayoutContainer`로 한 방향(`row` / `column`)의 분할 레이아웃을 구성하고, 패널 크기를 드래그로 조절하며, 필요하면 패널을 열고/닫을 수 있습니다.  
그 위에 **Split Screen**(동적 분할 화면)과, 이를 위한 **`FlexLayoutSplitScreenDragBox`** / **`useDragCapture`** 기반 Drag & Drop을 제공합니다.

> ℹ️ **Next.js App Router 참고**  
> `@byeolnaerim/flex-layout`의 주요 컴포넌트는 내부적으로 `"use client"`가 선언되어 있어, 일반적으로 `app/layout.tsx` 같은 Server Component에서 import 후 바로 렌더링해도 동작합니다.
>
> 다만 환경/빌드 설정에 따라 패키지가 server-side scope에 포함되어 오류가 난다면, 작은 client wrapper를 만들거나 `dynamic(..., { ssr: false })`를 사용하세요.

---

## 설치

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
- Next.js >= 14.2 < 17 (`@byeolnaerim/flex-layout/next` 사용 시, optional peer dependency)

`rxjs (>= 7)`와 `fast-deep-equal (3.1.3)`은 라이브러리 런타임 의존성으로 포함되어 있어 보통 따로 설치할 필요가 없습니다.

타입 정의(`.d.ts`)가 패키지에 포함되어 있어 TypeScript에서 바로 사용할 수 있습니다.

스타일은 CSS Modules 기반으로 컴포넌트에서 import되며, 별도 글로벌 CSS import 없이 동작합니다.

### Next.js fallback 패턴

대부분의 Next.js App Router 프로젝트에서는 주요 컴포넌트를 바로 import해서 사용할 수 있습니다.

그래도 빌드/런타임 환경에서 server-side import 문제가 발생한다면 아래 방식 중 하나를 사용하세요.

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

그리고 Server Component에서는 wrapper에서 import합니다.

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

## 빠른 시작

`FlexLayout`은 기본적으로 한 방향에 대한 분할 화면을 담당합니다.

### 1) 기본 Row 분할

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

- `direction="row"`: 좌/우 분할
- `direction="column"`: 상/하 분할
- `isResizePanel`이 `true`인 경우 컨테이너의 형제로 resize panel이 렌더링됩니다.
- 대부분의 사용 사례에서 마지막 요소에 `isResizePanel`을 붙일 필요는 없습니다. 마지막 요소에 붙이면 웹 브라우저 자체의 리사이즈 기능과 겹치면서 사용자 경험을 저해할 수 있습니다.
- 컨테이너를 동적으로 렌더링해야 할 때에는 `isResizePanel`을 항상 `true`로 렌더링하기보다 state로 제어하는 것을 권장합니다.

> **중요:** `layoutName`과 `containerName`은 렌더링된 DOM Element의 `id`로 사용되며, `getLayoutInfos`, `useDecompositionLayout` 같은 내부 Store/Subject 기반 API의 key로도 사용됩니다.
>
> 페이지 내에서 unique하고 stable해야 합니다. 공백/특수문자는 지양하고, 영문/숫자와 `-`, `_` 위주의 값을 권장합니다.

### 2) Column 분할 + grow

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

`grow`를 지정하지 않으면, 명시적으로 지정된 `grow` 값을 제외한 나머지 값이 `grow`가 지정되지 않은 컨테이너들에게 균등 분배됩니다.

가급적 props로 지정하는 `grow` 값은 컨테이너의 개수보다 크게 지정하지 않는 것을 권장합니다.

### 3) 멀티 크로스(중첩)

`FlexLayout`은 한 번에 한 방향을 담당합니다. 가로/세로 분할이 함께 필요하다면 `FlexLayoutContainer` 내부에 다른 `FlexLayout`을 중첩해서 구성합니다.

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

`FlexLayout`은 CSS flex를 기반으로 하기 때문에 `direction="column"`을 사용할 때에는 기준이 되는 부모의 높이가 결정되어 있어야 합니다. 부모 높이가 `auto`이거나 리사이즈 가능한 여유공간이 없으면 리사이즈가 의도대로 동작하지 않을 수 있습니다.

### 4) min/max + isFitContent

`FlexLayoutContainer`에 CSS로 최소/최대 사이즈를 지정하면 리사이즈 범위를 조절할 수 있습니다.

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

또는 `useDecompositionLayout`을 사용할 수 있습니다.

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

내부 콘텐츠의 동적 크기를 max size로 잡고 싶은 경우 `isFitContent`를 사용할 수 있습니다.

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

의도한 것이 아니라면 모든 컨테이너에 `isFitContent` 같은 max-size 제약을 부여하지 마세요. 보통 최소한 하나 이상의 컨테이너는 max-size 제약 없이 남아 있어야 레이아웃이 리사이즈될 여유공간을 가질 수 있습니다.

### 5) 패널 이동 모드

`panelMovementMode`는 패널을 리사이즈할 때 인접한 패널과 어떻게 상호작용하는지를 제어하는 속성입니다. 기본값은 `"divorce"`입니다.

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

- `"bulldozer"`: 인접한 패널을 밀어내지만 서로 달라붙지 않습니다.
- `"divorce"`: 인접한 패널을 밀어내고 서로 달라붙지만, 리사이즈를 시작했던 위치로 되돌아오면 다시 분리됩니다. 기본값입니다.
- `"stalker"`: 인접한 패널끼리 완전히 달라붙지만 가장 끝에 도달했을 때는 다시 분리됩니다.

---

## FlexLayout

### import

```ts
import { FlexLayout } from "@byeolnaerim/flex-layout";
```

### Props

- `layoutName: string`  
  레이아웃 인스턴스를 구분하는 이름입니다. DOM `id`이자 내부 Store/Subject API의 key로도 사용됩니다.
- `direction: "row" | "column"`  
  flex 방향입니다. `"row"`는 좌/우 분할, `"column"`은 상/하 분할을 만듭니다.
- `children: ReactNode`
- `className?: string`
- `panelClassName?: string`  
  리사이즈 패널 커스텀 스타일을 위한 클래스입니다.
- `panelMovementMode?: "bulldozer" | "divorce" | "stalker"`  
  패널 리사이즈 시 인접 패널과의 상호작용 방식을 설정합니다. 기본값은 `"divorce"`입니다.
- `rememberResize?: { storage: "auto" | "indexeddb" | "websql" | "localstorage" | "sessionstorage"; keyName?: string; name?: string; storeName?: string; keyPrefix?: string }`  
  이 레이아웃에 포함된 모든 컨테이너의 최신 리사이즈 `grow` map을 기억합니다. `grow` 값은 `FlexLayout` 전체에서 함께 분배되는 값이므로, 기억 옵션은 개별 `FlexLayoutContainer`가 아니라 `FlexLayout`에 설정합니다. 생략하면 리사이즈 기억 기능은 꺼지고, in-memory store도 만들지 않습니다.

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

  기본 persistence key는 `__flexLayoutResizeGrow:${layoutName}`입니다. 여러 레이아웃이 resize 기억값을 공유하거나 분리해야 한다면 `keyName`을 지정하세요.

---

## FlexLayoutContainer (FlexLayout과 세트)

### import

```ts
import { FlexLayoutContainer } from "@byeolnaerim/flex-layout";
```

### Props

- `containerName: string` _(필수)_  
  컨테이너(패널) 이름입니다. DOM `id`이자 내부 Store/Subject API의 key로도 사용됩니다.
- `children: ReactNode`
- `grow?: number`  
  특정 컨테이너의 초기 비율을 명시합니다. `grow`가 지정되지 않은 컨테이너들은 명시된 `grow` 값을 제외한 나머지를 균등 분배받습니다. 가급적 컨테이너 개수보다 큰 `grow` 값은 지정하지 않는 것을 권장합니다.
- `className?: string`
- `style?: React.CSSProperties`
- `isResizePanel?: boolean`  
  이 컨테이너의 형제로 resize panel을 렌더링합니다. resize panel의 소유권은 `isResizePanel`을 선언한 컨테이너에 있지만, 실제로는 양 옆 형제 패널을 핸들링합니다. 대부분의 경우 마지막 컨테이너에는 붙이지 않는 것을 권장합니다.
- `panelMode?: "default" | "left-cylinder" | "right-cylinder" | "top-cylinder" | "bottom-cylinder"`  
  리사이즈 패널 및 open/close 모션의 **UI 방향/앵커(기준)** 를 결정하는 옵션입니다.
- `isFitContent?: boolean`  
  컨테이너가 내부 자식 요소들의 크기보다 크게 리사이즈되지 않도록 제한합니다.

---

## (응용) 패널 열고/닫기 + grow 동적 제어

라이브러리는 `containerName`을 키로 **패널 open/close** 이벤트를 보낼 수 있도록 RxJS Subject 맵을 제공합니다.

### containerOpenCloseSubjectMap으로 열고 닫기

```ts
import { containerOpenCloseSubjectMap } from "@byeolnaerim/flex-layout/providers";

// 예: right-panel 열기
containerOpenCloseSubjectMap["right-panel"].next({
	mode: "open",
	openOption: { isPrevSizeOpen: true }, // 이전 사이즈로 열기
});

// 예: right-panel 닫기
containerOpenCloseSubjectMap["right-panel"].next({
	mode: "close",
});
```

- `mode: "toggle" | "open" | "close"`
- `openOption.isPrevSizeOpen?: boolean`: 이전에 열려있던 크기 복원 여부
- `onOpen?`, `onClose?` 콜백 제공

### useContainers로 grow를 직접 조절하기

`useContainers(layoutName)`은 해당 레이아웃의 실제 DOM 컨테이너 배열을 줍니다.  
탭에 따라 특정 컨테이너만 `grow=1`, 나머지는 `grow=0`으로 애니메이션 처리할 때 유용합니다.

```ts
import { useContainers } from "@byeolnaerim/flex-layout/providers";

const containers = useContainers(layoutName);
// containers.forEach((el) => (el.style.flex = "1 1 0%")); 같은 방식으로 제어
```

---

## Split Screen

Split Screen은 “드래그로 화면을 좌/우/상/하/중앙에 드롭 → 해당 위치에 새 화면을 동적으로 분할 생성”하는 패턴을 제공합니다. 같은 center 영역에 여러 화면이 들어오면 탭처럼 관리되며, 탭 타이틀은 드래그해서 순서를 바꿀 수 있습니다.

⚠️ 주의: `FlexLayoutSplitScreen`은 실제 사용 환경에서의 안정성을 충분히 검증하지 않았습니다. 의도한 대로 동작하지 않을 수도 있습니다.

### 1) FlexLayoutSplitScreen (스플릿 루트)

```tsx
import { FlexLayoutSplitScreen } from "@byeolnaerim/flex-layout";

export default function Page() {
	return (
		<FlexLayoutSplitScreen
			layoutName="rootSplitScreen"
			containerName="dashboard"
			navigationTitle="대시보드"
			dropDocumentOutsideOption={{
				openUrl: "/",
				widthRatio: 0.7,
				heightRatio: 0.5,
			}}
		>
			<div>대시보드 콘텐츠</div>
		</FlexLayoutSplitScreen>
	);
}
```

**Props (요약)**

- `layoutName: string`: 스플릿 화면 트리의 루트 키
- `containerName: string`: 최초 center 화면의 키
- `children: ReactElement`: 최초 center에 렌더링할 화면
- `navigationTitle: string`: 최초 화면의 탭/내비게이션 라벨
- `navigationTitleComponent?: ReactElement<{ children?: ReactNode }>`: 각 탭의 `navigationTitle` 문자열을 렌더링할 때 사용하는 공통 래퍼 컴포넌트
- `titleWrapperComponent?: ReactElement<{ children?: ReactNode }>`: 타이틀 내용과 닫기 버튼을 감싸는 공통 래퍼. 바깥 Drag & Drop 루트는 교체하지 않음
- `dropGuideComponent?: ReactNode`: 드래그 중 분할 가능한 영역에 표시할 안내 UI. 생략하면 기본 안내 문구를 사용
- `titleCloseButtonComponent?: ReactNode`: 탭 닫기 UI. `undefined`면 기본 `X`, `null`이면 닫기 버튼을 숨김
- `titleMoreButtonComponent?: ReactNode`: 타이틀 영역 오른쪽의 More 트리거 UI. `undefined`면 기본 `...`, `null`이면 More 기능을 숨김
- `renderTitleMoreMenu?: (context) => ReactNode`: 기본 More 메뉴 전체를 교체하는 renderer
- `renderTitleMoreMenuItems?: (context) => ReactNode`: 기본 More 메뉴 아래에 사용자 메뉴 항목을 추가하는 renderer
- `dropDocumentOutsideOption?: { openUrl: string; widthRatio?: number; heightRatio?: number; isNewTap?: boolean }`: 문서 바깥 drop 및 “새 창에서 열기”에 사용할 URL/창 옵션
- `screenKey?: string`: 화면 식별 key. 생략하면 내부에서 생성
- `preserveStateOnUnmount?: boolean`: 언마운트 시 현재 root split screen의 **in-memory** store를 유지할지 여부. 기본값 `false`. 브라우저 새로고침 persistence와는 별개
- `isResetOnChildrenChange?: boolean`: **deprecated**. 더 이상 런타임에서 사용되지 않으며 추후 제거 예정. `children`은 현재 split 구조를 reset하지 않고 항상 갱신됨
- `isRemoveStoreOnUnmount?: boolean`: **deprecated**. `preserveStateOnUnmount`를 사용하세요. 호환을 위해 `false`는 `preserveStateOnUnmount={true}`, `true`는 `preserveStateOnUnmount={false}`로 해석되며 새 prop이 우선함

### 2) `navigationTitle`과 `navigationTitleComponent`의 역할

`navigationTitle`은 **화면의 라벨 데이터**이고, `navigationTitleComponent`는 그 라벨을 Split Screen이 실제 타이틀 UI로 렌더링할 때 사용하는 **공통 래퍼**입니다.

`FlexLayoutSplitScreenDragBox`는 `navigationTitle` 문자열만 전달합니다. `navigationTitleComponent`를 DragBox가 들고 이동하지 않으므로, 다른 Split Screen으로 이동한 화면의 타이틀은 **도착한 Split Screen의 `navigationTitleComponent` 디자인**을 따릅니다.

```tsx
import type { ReactNode } from "react";
import { FlexLayoutSplitScreen } from "@byeolnaerim/flex-layout";

function SplitScreenTitle({ children }: { children?: ReactNode }) {
	return <strong className="split-screen-title">{children}</strong>;
}

<FlexLayoutSplitScreen
	layoutName="rootSplitScreen"
	containerName="dashboard"
	navigationTitle="대시보드"
	navigationTitleComponent={<SplitScreenTitle />}
>
	<div>대시보드 콘텐츠</div>
</FlexLayoutSplitScreen>;
```

위 예제에서 최초 화면은 개념적으로 `<SplitScreenTitle>대시보드</SplitScreenTitle>`처럼 렌더링됩니다. 이후 DragBox에서 `navigationTitle="사용자 목록"`을 가진 화면이 들어오면 동일한 래퍼로 `사용자 목록`이 렌더링됩니다.

### 3) 타이틀 래퍼 / 닫기 버튼 커스터마이징

`titleWrapperComponent`는 각 탭의 **타이틀 내용 + 닫기 버튼**만 감쌉니다. Drag & Drop을 담당하는 바깥 타이틀 루트는 그대로 유지되므로, 래퍼를 바꿔도 탭 이동/순서 변경 동작은 유지됩니다.

`titleCloseButtonComponent`는 닫기 버튼의 UI만 교체합니다. 클릭에 따른 탭 닫기 동작은 라이브러리가 처리합니다.

```tsx
<FlexLayoutSplitScreen
	layoutName="rootSplitScreen"
	containerName="dashboard"
	navigationTitle="대시보드"
	titleWrapperComponent={<div className="split-screen-title-wrapper" />}
	titleCloseButtonComponent={<span aria-hidden>×</span>}
>
	<div>대시보드 콘텐츠</div>
</FlexLayoutSplitScreen>
```

- `titleWrapperComponent` 생략: 별도 래퍼 DOM을 추가하지 않음
- `titleCloseButtonComponent === undefined`: 기본 `X` 버튼 사용
- `titleCloseButtonComponent === null`: 닫기 버튼 숨김
- 사용자 컴포넌트를 전달하면 해당 UI를 사용하되 실제 close 동작은 Split Screen이 처리

### 4) 분할 안내 UI 커스터마이징

드래그 중 Split Screen의 실제 분할 drop 영역에는 기본적으로 `⬇️드롭하면 화면이 분할됩니다.` 안내가 표시됩니다. `dropGuideComponent`를 전달하면 이 UI만 교체할 수 있습니다.

```tsx
<FlexLayoutSplitScreen
	layoutName="rootSplitScreen"
	containerName="dashboard"
	navigationTitle="대시보드"
	dropGuideComponent={<div>여기에 놓아 새 화면을 만듭니다.</div>}
>
	<div>대시보드 콘텐츠</div>
</FlexLayoutSplitScreen>
```

타이틀 영역은 탭 순서 변경을 위한 drop 영역으로 별도 처리되므로, 타이틀끼리 순서를 바꾸는 동안에는 분할 안내 UI가 표시되지 않습니다.

### 5) 탭 타이틀 순서 변경

같은 Split Screen의 center 탭들은 타이틀 자체를 드래그해서 순서를 변경할 수 있습니다.

- 대상 타이틀의 **왼쪽 절반**에 drop → 대상 앞에 이동
- 대상 타이틀의 **오른쪽 절반**에 drop → 대상 뒤에 이동
- 다른 탭이 앞뒤로 이동해도 활성 탭은 `screenKey` 기준으로 유지
- 타이틀 영역 밖의 실제 Split Screen 영역으로 끌면 기존 화면 분할 Drag & Drop 동작을 계속 사용

### 6) 기본 More 메뉴

타이틀 영역 오른쪽의 기본 `...` 버튼은 현재 활성 탭을 기준으로 아래 기능을 제공합니다.

1. 현재 탭 닫기
2. 다른 탭 모두 닫기
3. 오른쪽 탭 모두 닫기
4. 현재 분할의 탭 모두 닫기
5. `dropDocumentOutsideOption.openUrl`이 있는 경우 새 창에서 열기

More 메뉴는 React Portal로 `document.body`에 렌더링되므로 Split Screen 내부의 `overflow`에 잘리지 않습니다. 트리거 위치와 메뉴 실제 크기를 기준으로 viewport 안에 배치하고, scroll/resize 시 위치를 다시 계산합니다. 바깥 클릭 또는 `Escape`로 닫을 수 있습니다.

### 7) More 트리거 / 메뉴 확장

`titleMoreButtonComponent`, `renderTitleMoreMenuItems`, `renderTitleMoreMenu`는 서로 다른 범위를 커스터마이징합니다.

```tsx
<FlexLayoutSplitScreen
	layoutName="rootSplitScreen"
	containerName="dashboard"
	navigationTitle="대시보드"
	titleMoreButtonComponent={<button type="button">메뉴</button>}
	renderTitleMoreMenuItems={(context) => (
		<button
			type="button"
			onClick={() => {
				console.log(context.activeItem);
				context.closeMenu();
			}}
		>
			사용자 기능
		</button>
	)}
>
	<div>대시보드 콘텐츠</div>
</FlexLayoutSplitScreen>
```

- `titleMoreButtonComponent`: `...` 트리거 부분만 교체
- `renderTitleMoreMenuItems`: 라이브러리의 기본 5개 기능을 유지하면서 메뉴 항목 추가
- `renderTitleMoreMenu`: 기본 메뉴 내용을 전부 교체. Portal/위치 계산/바깥 클릭/ESC 닫기 같은 메뉴 컨테이너 동작은 그대로 사용

`renderTitleMoreMenu` / `renderTitleMoreMenuItems`의 context에는 다음 값과 액션이 전달됩니다.

- 식별 정보: `rootName`, `layoutName`, `containerName`, `screenKey`
- 활성 탭: `activeItem`, `activeIndex`
- 전체 center 탭: `items`
- 메뉴 제어: `closeMenu()`
- 기본 액션: `closeCurrentTab()`, `closeOtherTabs()`, `closeTabsToRight()`, `closeAllTabs()`, `openInNewWindow()`
- 활성화 여부: `canCloseOtherTabs`, `canCloseTabsToRight`, `canOpenInNewWindow`

기본 메뉴 전체를 교체하려면 다음처럼 사용할 수 있습니다.

```tsx
<FlexLayoutSplitScreen
	layoutName="rootSplitScreen"
	containerName="dashboard"
	navigationTitle="대시보드"
	renderTitleMoreMenu={(context) => (
		<div role="menu">
			<button type="button" onClick={context.closeCurrentTab}>
				현재 화면 닫기
			</button>
			<button type="button" onClick={context.closeMenu}>
				메뉴 닫기
			</button>
		</div>
	)}
>
	<div>대시보드 콘텐츠</div>
</FlexLayoutSplitScreen>
```

#### 전체 디자인 커스터마이징 예제

실제 사이트에서 사용하는 `FlexLayoutSplitScreen` 디자인 커스터마이징 코드를 통째로 보고 싶다면 [`README.splitScreenCustomizeStyle.md`](./README.splitScreenCustomizeStyle.md)를 참고하세요. `navigationTitleComponent`, `titleWrapperComponent`, `dropGuideComponent`, `titleCloseButtonComponent`, `titleMoreButtonComponent`, `renderTitleMoreMenu`를 한 번에 적용한 예제입니다.

### 8) 드래그 취소

`FlexLayoutSplitScreenDragBox`로 드래그하는 중 `Escape`를 누르면 현재 drag를 취소합니다. drag clone과 예약된 drag state를 정리하고 `isDragging: false`, `isDrop: false` 상태를 전파하므로, Split Screen에 표시되던 분할 안내 UI도 즉시 사라지고 이후 mouse/touch 종료 시 drop이 실행되지 않습니다.

---

## FlexLayoutSplitScreenDragBox (스플릿 스크린 드래그 소스)

`FlexLayoutSplitScreenDragBox`는 **드래그 가능한 소스 컴포넌트**입니다.  
이걸 끌어서 Split Screen 경계에 드롭하면, drop 대상 위치에 `targetComponent`를 렌더링하며 분할 화면이 만들어집니다.

```tsx
import { FlexLayoutSplitScreenDragBox } from "@byeolnaerim/flex-layout";

<FlexLayoutSplitScreenDragBox
	containerName="menu:users"
	navigationTitle="유저 목록"
	targetComponent={<UsersPage />}
	dropDocumentOutsideOption={{
		openUrl: "/admin/users",
		widthRatio: 0.7,
		heightRatio: 0.5,
	}}
>
	<button>유저 목록 열기</button>
</FlexLayoutSplitScreenDragBox>;
```

**Props (요약)**

- `containerName: string` _(필수)_: 드래그 항목 고유 키
- `children: ReactNode`: 실제 렌더링될 UI
- `targetComponent?: ReactElement`: 분할 화면에 새로 띄울 컴포넌트
- `url?: string`: `iframe` 또는 Next.js 전용 DragBox가 렌더링할 URL
- `iframe?: boolean`: URL을 iframe으로 렌더링할지 여부. 기본값 `false`
- `iframeProps?: IframeHTMLAttributes<HTMLIFrameElement>`: iframe 속성과 스타일
- `navigationTitle?: string`: drop 후 화면의 라벨 데이터. 타이틀 렌더 스타일은 DragBox가 아니라 drop 대상 `FlexLayoutSplitScreen.navigationTitleComponent`가 담당
- `dropDocumentOutsideOption?: { openUrl: string; widthRatio?: number; heightRatio?: number; isNewTap?: boolean }`
- `customData?: Record<string, string | number | boolean | undefined>`: 드롭 시 함께 전달할 커스텀 데이터
- `scrollTargetRef?: RefObject<HTMLElement>`: 드래그 중 스크롤 타겟(옵션)

드래그 도중 `Escape`를 누르면 현재 drag가 취소되며 drop callback이나 화면 분할이 실행되지 않습니다.

---

## Next.js App Router: URL 기반 Split Screen

Next.js 전용 진입점은 드롭 대상 컴포넌트를 직접 작성하지 않고 **URL만으로 `app/**/page.tsx`를 분할 화면에 렌더링**합니다.

- `@split` Parallel Route가 필요하지 않습니다.
- 드롭된 URL에 해당하는 `page.tsx`만 서버에서 동적으로 import합니다.
- 생성된 정적 import registry를 사용하므로 Turbopack이 import 대상을 빌드 시점에 확인할 수 있습니다.
- 기본 렌더 방식은 RSC이며 `iframe`은 기본값이 `false`입니다.
- 생성되는 `FlexLayoutNextSplitScreen`은 URL 기반 RSC 렌더링의 wrapper이면서, 선택적으로 브라우저 reload/history 복원 persistence 경계 역할도 합니다.

### 1. Registry 생성 스크립트

사용 프로젝트의 스크립트 파일 상단에 필요한 앱 설정을 직접 작성합니다. CLI 인자를 전달할 필요가 없습니다.

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

생성 파일은 다음 이름을 공통으로 사용합니다.

```ts
pageRegistry
resolvePage
FlexLayoutNextSplitScreen
```

주요 생성 옵션:

- `appDir`: 스캔할 Next.js App Router 디렉터리
- `outFile`: 생성할 TypeScript 파일
- `excludedRoutes`: registry에서 제외할 URL 패턴 목록
- `basePath`: Next.js `basePath`를 사용하는 경우 지정
- `includeLayouts`: 중첩 `layout.tsx`도 조합할지 여부. 기본값 `false`
- `excludeRootLayout`: `app/layout.tsx` 제외 여부. 기본값 `true`
- `excludedLayouts`: `appDir` 기준 확장자 없는 layout 경로 목록
- `providerId`: 동일한 페이지 트리에 registry wrapper를 여러 개 둘 때만 직접 지정
- `cookieOptions`: Server Action render request cookie의 `path`, `domain`, `httpOnly`, `secure`, `sameSite`, `maxAge` 설정

`includeLayouts`는 기본적으로 꺼져 있습니다. 일반적으로 root 또는 상위 layout에는 Header, Sidebar, Provider, FlexLayout shell이 포함되므로 pane 내부에서 다시 조합하면 UI가 중복되거나 재귀 구조가 생길 수 있습니다. 필요한 하위 layout만 명확한 경우에만 활성화하세요.

생성된 `FlexLayoutNextSplitScreen`은 사용 시점에 `persistence` prop을 받을 수 있으므로, 브라우저 persistence 설정을 generator config에 고정할 필요는 없습니다.

### 2. 생성된 FlexLayoutNextSplitScreen 적용

`FlexLayoutNextSplitScreen`은 일반 `FlexLayout` 전체에 필요한 Provider가 아닙니다. **URL 기반 서버 렌더링 결과가 들어갈 `FlexLayoutSplitScreen` 트리**를 감싸는 Next.js 전용 wrapper입니다.

```tsx
// app/layout.tsx 또는 FlexLayoutSplitScreen을 렌더링하는 공통 Server Layout
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

wrapper는 드롭 시 전달된 URL을 짧은 수명의 HTTP-only cookie에 기록하는 Server Action을 내부적으로 호출합니다. cookie 변경으로 현재 RSC 트리가 다시 렌더링되면 생성된 registry가 URL을 해석하고, 해당 `page.tsx`의 서버 렌더 결과를 기존 `FlexLayoutSplitScreen` pane에 병합합니다.

### 3. 브라우저 reload / URL별 Split Screen 복원

`persistence`를 전달하면 Next URL pane의 split 구조를 `@byeolnaerim/global-rx-state` storage에 직렬화해서 저장하고 복원할 수 있습니다.

```tsx
<FlexLayoutNextSplitScreen
	persistence={{
		storage: "auto",
		keyName:"byeolnaerim-docs-split-screen-v6",
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

`persistence` 옵션:

- `storage: "auto" | "indexeddb" | "IndexedDB" | "websql" | "WebSQL" | "localstorage" | "localStorage" | "sessionstorage" | "sessionStorage"` _(필수)_: persistence backend. `"in-memory"`는 지원하지 않음
- `keyName?: string`: global-rx-state persistence key. 기본값은 `__flexLayoutNextSplitScreen:${providerId}`
- `name?: string`, `storeName?: string`, `keyPrefix?: string`: storage 세부 옵션
- `restoreOnReload?: boolean`: reload 후 복원 여부. 기본값 `true`. `false`이면 해당 wrapper의 Split Screen persistence 자체가 비활성화됨
- `syncWithBrowserUrl?: boolean`: 브라우저 URL별 snapshot을 사용할지 여부. 기본값 `false`

복원 가능한 pane은 아래 조건을 모두 만족해야 합니다.

- `FlexLayoutNextSplitScreen` wrapper 아래의 `FlexLayoutSplitScreen`에 속함
- Next 전용 `FlexLayoutSplitScreenDragBox`를 사용함
- `url`이 지정됨
- `targetComponent`를 직접 지정하지 않음
- `iframe !== true`
- `persistence`가 활성화되어 있음

persistent snapshot에는 ReactElement, 함수, ref 같은 런타임 객체를 저장하지 않습니다. URL pane의 split topology/order/direction, `screenKey`, `containerName`, `navigationTitle`, URL, document-outside 옵션처럼 복원 가능한 데이터만 저장합니다.

`targetComponent`를 직접 전달한 pane과 iframe pane은 런타임에서는 정상적으로 분할/이동할 수 있지만 persistent snapshot에서는 제외됩니다. 따라서 reload 또는 URL snapshot 복원 후에는 해당 pane이 사라집니다. 그 아래에 있던 복원 가능한 URL pane은 가능한 경우 root center tab으로 승격되어 유지됩니다.

root 화면의 ReactElement 자체도 저장하지 않습니다. 복원 시에는 **현재 route에서 렌더링된 root `children`**을 사용하고, 저장된 root `screenKey`와 split 구조만 다시 연결합니다.

#### `syncWithBrowserUrl: false`

하나의 최신 workspace snapshot을 유지합니다.

- route가 바뀌어도 현재 split workspace를 계속 사용
- full reload 시 마지막으로 저장된 URL 기반 split workspace를 복원

#### `syncWithBrowserUrl: true`

`pathname + search`를 key로 URL별 snapshot을 유지합니다.

- 이미 snapshot이 있는 URL로 이동하거나 back/forward하면 해당 URL의 전체 URL 기반 split workspace를 복원
- 처음 방문하는 URL이면 현재 workspace를 그대로 이어받아 그 URL의 최초 snapshot으로 저장
- hash는 URL key에 포함하지 않음
- 같은 URL이 browser history에 여러 번 있어도 history entry별 상태가 아니라 **URL별 최신 snapshot**을 사용

### 4. DragBox에는 URL만 전달

Next 전용 진입점에서 `FlexLayoutSplitScreenDragBox`를 import합니다.

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

`targetComponent`를 직접 전달하면 URL 자동 렌더보다 우선합니다. 이 경우 pane은 runtime split에는 참여하지만 위 persistence 복원 대상에서는 제외됩니다.

### 5. iframe 렌더링

`iframe`은 명시적으로 `true`를 전달한 경우에만 사용합니다. 기본값은 `false`입니다.

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

iframe은 리사이즈 또는 드래그 중 pointer event를 자동으로 차단하며, `iframeProps`로 일반 iframe 속성과 스타일을 재정의할 수 있습니다. iframe 모드는 RSC 서버 렌더링과 Split Screen persistence 복원을 사용하지 않으므로 해당 pane 자체에는 `FlexLayoutNextSplitScreen` wrapper가 필요하지 않습니다.

### 동작 범위와 제약

- RSC 자동 렌더의 `url`은 현재 Next 앱의 로컬 상대 URL이어야 합니다. 외부/절대 URL은 `iframe`을 사용하세요.
- Server Component, async page, `cookies()`, `headers()`, 서버 데이터 조회는 서버에서 실행됩니다.
- URL의 동적 segment와 query string은 `params`, `searchParams`로 page에 전달됩니다.
- pane은 별도의 Next Router가 아닙니다. page 내부 Client Component의 `usePathname()`, `useParams()`, `useSearchParams()`는 pane URL이 아니라 실제 브라우저 URL을 기준으로 동작합니다.
- page 내부의 `redirect()`와 `notFound()`는 독립 pane navigation이 아니라 현재 Next route 렌더에 영향을 줄 수 있습니다.
- `loading.tsx`, `error.tsx`, `not-found.tsx`, metadata는 registry가 자동 조합하지 않습니다.
- page의 `dynamic`, `revalidate`, `runtime`, `preferredRegion` 같은 route segment config는 pane에 독립적으로 적용되지 않고 wrapper가 속한 route의 runtime/cache 정책을 따릅니다.
- `FlexLayoutNextSplitScreen`이 `cookies()`를 읽으므로 wrapper가 포함된 route tree는 동적 렌더링 대상이 됩니다.
- Server Action이 필요하므로 `output: "export"`인 정적 export에서는 URL 기반 RSC 렌더링을 사용할 수 없습니다. 이 경우 `iframe` 또는 직접 전달한 `targetComponent`를 사용해야 합니다.

---

## (응용) FlexLayoutSplitScreenDragBox + useDragCapture로 Drag & Drop만 쓰기

Split Screen을 만들지 않고, **순수 Drag & Drop**으로도 활용할 수 있습니다.

- 드래그 소스: `FlexLayoutSplitScreenDragBox`
- 드롭 타겟: `useDragCapture(ref)`

### 예: unitCard → slotCard로 드롭해서 정보 삽입

```tsx
import { useDragCapture } from "@byeolnaerim/flex-layout";

const dropRef = useRef<HTMLDivElement>(null);
const dragState = useDragCapture(dropRef);

useEffect(() => {
	if (!dragState) return;
	const {
		isDrop,
		containerName, // 드래그된 item의 containerName
		positionName, // 어느 경계에 놓였는지 (left/top/right/bottom/center)
		customData, // DragBox에서 넘긴 customData
	} = dragState;

	if (isDrop) {
		// TODO: containerName/customData 기반으로 “장착/삽입” 처리
	}
}, [dragState]);
```

`dragState`에는 드롭 여부(`isDrop`), 드래그 중 여부(`isDragging`), 오버 여부(`isOver`), 위치(`positionName`), 좌표(`x`, `y`) 등이 포함됩니다.

---

## 실사용 패턴 모음 (아이디어)

- **탭 UI + FlexLayout**  
  `useContainers(layoutName)`로 DOM 컨테이너의 `flex`를 직접 제어해서  
  “선택된 탭만 grow=1, 나머지 grow=0” 전환 애니메이션 구현.
- **마스터-디테일(좌 리스트 / 우 상세)**  
  `containerOpenCloseSubjectMap["right"].next({ mode: selected ? "open" : "close" })`로  
  상세 패널을 상황에 따라 열고 닫기.
- **어드민 화면 Split Screen**  
  사이드바 메뉴(`FlexLayoutSplitScreenDragBox`)를 드래그 → 원하는 위치에 새 화면 분할.

---

## Export 경로

일반적으로 아래 둘 중 편한 방식으로 import 하면 됩니다.

```ts
// 1) 루트에서 통합 import
import {
	FlexLayout,
	FlexLayoutContainer,
	FlexLayoutSplitScreen,
	FlexLayoutSplitScreenDragBox,
} from "@byeolnaerim/flex-layout";

// 2) components 서브패스 (선호 시)
import {
	FlexLayout,
	FlexLayoutContainer,
} from "@byeolnaerim/flex-layout/components";
```

---

## Tips

- **containerName은 가능한 한 의미 있는 prefix**를 붙이세요. 예: `left-container-${id}`, `menu:${identifierId}`
- Next.js App Router에서는 주요 컴포넌트가 내부적으로 `"use client"`를 포함하므로, 단순히 `FlexLayout`을 렌더링한다는 이유만으로 파일 상단에 `"use client"`를 붙일 필요는 보통 없습니다.
- 다만 해당 파일에서 `useState`, `useEffect`, 이벤트 핸들러 등 클라이언트 전용 기능을 직접 사용한다면 그 파일은 여전히 Client Component여야 합니다.
- 빌드/환경 이슈로 패키지가 server-side scope에 포함되어 오류가 발생한다면 client wrapper 또는 `dynamic(..., { ssr: false })`를 사용하세요.

---

## 내부 구현/스타일 구조는 계속 발전 중이라 API는 조금씩 바뀔 수 있습니다.
