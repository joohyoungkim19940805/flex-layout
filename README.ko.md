# @byeolnaerim/flex-layout

> 이 문서는 코드베이스와 사용 사례들을 제공받은 ChatGPT가 작성하였습니다. 문서의 내용이 정확하지 않을 수 있으며, FlexLayout 개발자가 검토 후 재수정할 예정입니다.

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

Split Screen은 “드래그로 화면을 좌/우/상/하/중앙에 드롭 → 해당 위치에 새 화면을 동적으로 분할 생성”하는 패턴을 제공합니다.  
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
- `containerName: string`: 이 화면(컨테이너)의 키
- `children: ReactNode`
- `navigationTitle?: string`: 탭/내비게이션용 타이틀
- `dropDocumentOutsideOption?: { openUrl: string; widthRatio?: number; heightRatio?: number }`  
  드롭을 “화면 밖”으로 했을 때 새 창/문서로 열기 옵션
- `screenKey?: string`: `FlexLayoutSplitScreen` 내부에서 screen을 판별할 때 사용하는 유니크한 값입니다. 빈 값이면 기본값으로 32자리 랜덤 값을 생성합니다. 개발자가 제어할 수 없는 동적 분할 화면 뷰라면 가급적 빈 값으로 이용하는 것을 권장합니다.

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
- `targetComponent?: ReactNode`: 분할 화면에 새로 띄울 컴포넌트
- `navigationTitle?: string`
- `dropDocumentOutsideOption?: { openUrl: string; widthRatio?: number; heightRatio?: number }`
- `customData?: any`: 드롭 시 함께 전달할 임의 데이터
- `scrollTargetRef?: RefObject<HTMLElement>`: 드래그 중 스크롤 타겟(옵션)

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
