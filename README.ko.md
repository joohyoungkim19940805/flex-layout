# @byeolnaerim/flex-layout

React(Next.js)에서 **flex 기반 리사이즈 패널 + 스플릿 스크린 + Drag & Drop** UI를 빠르게 만들기 위한 컴포넌트 모음입니다.

이 라이브러리의 핵심은 **`<FlexLayout />`** 입니다.  
`FlexLayout` + `FlexLayoutContainer`로 “패널이 나뉘고(가로/세로), 드래그로 크기를 조절하고, 필요하면 열고/닫는” 레이아웃을 구성합니다.  
그 위에 **Split Screen**(동적 분할 화면)과, 이를 위한 **`FlexLayoutSplitScreenDragBox`** / **`useDragCapture`** 기반 Drag & Drop을 제공합니다.

> ⚠️ 대부분의 컴포넌트가 `window`, `ResizeObserver` 등을 사용합니다. **Next.js(App Router)에서는 Client Component** 사용을 권장합니다. (`"use client"`)

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

---

## 빠른 시작

### 1) FlexLayout + FlexLayoutContainer (기본 리사이즈 레이아웃)

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

- `direction="row"`: 좌/우 분할
- `direction="column"`: 상/하 분할
- `FlexLayoutContainer`의 `isResizePanel`이 `true`인 컨테이너 뒤에 **리사이즈 패널**이 붙습니다.

> **중요:** `layoutName`, `containerName`은 내부 Store/Subject의 키로 쓰입니다.  
> 화면에 동일한 레이아웃이 여러 개 생길 수 있다면 `useId()` 같은 안정적인 값을 써서 유니크하게 관리하는 걸 권장합니다.

---

## FlexLayout

### import

```ts
import { FlexLayout } from "@byeolnaerim/flex-layout";
```

### Props

- `layoutName: string`  
  레이아웃 인스턴스를 구분하는 이름(키).
- `direction: "row" | "column"`  
  flex 방향(가로/세로 분할).
- `children: ReactNode`
- `className?: string`
- `panelClassName?: string`  
  리사이즈 패널 커스텀 스타일을 위한 클래스.
- `panelMovementMode?: "default" | "bulldozer"`  
  패널 이동(리사이즈) 시 인접 패널들을 어떻게 밀어낼지에 대한 모드.
- `panelMovementDisabledTransition?: boolean`  
  리사이즈 중 transition 비활성화 옵션.

---

## FlexLayoutContainer (FlexLayout과 세트)

### import

```ts
import { FlexLayoutContainer } from "@byeolnaerim/flex-layout";
```

### Props

- `containerName: string` _(필수)_  
  컨테이너(패널) 이름(키).
- `children: ReactNode`
- `grow?: number`  
  flex-grow 기반 비율. (예: 좌 2, 우 1)
- `className?: string`
- `style?: React.CSSProperties`
- `isResizePanel?: boolean`  
  이 컨테이너 뒤에 리사이즈 패널을 붙일지 여부.
- `panelMode?: "left-cylinder" | "right-cylinder" | "top-cylinder" | "bottom-cylinder"`  
  리사이즈 패널(또는 열고 닫는 모션)을 어느 방향 기준으로 표현할지.
- `isFitContent?: boolean`  
  콘텐츠 높이/너비를 기준으로 fit 하게 처리(테이블/폼 영역에 유용).

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
- `openOption.isPrevSizeOpen?: boolean` : 이전에 열려있던 크기 복원 여부
- `onOpen?`, `onClose?` 콜백 제공

### useContainers로 grow를 직접 조절하기

`useContainers(layoutName)`은 해당 레이아웃의 실제 DOM 컨테이너 배열을 줍니다.  
질문에 주신 예시처럼 **탭에 따라 특정 컨테이너만 grow=1**, 나머지는 grow=0으로 애니메이션 처리할 때 유용합니다.

```ts
import { useContainers } from "@byeolnaerim/flex-layout/providers";

const containers = useContainers(layoutName);
// containers.forEach(el => el.style.flex = "1 1 0%"); 같은 방식으로 제어
```

---

## Split Screen

Split Screen은 “드래그로 화면을 좌/우/상/하/중앙에 드롭 → 해당 위치에 새 화면을 동적으로 분할 생성”하는 패턴을 제공합니다.  
⚠️ 주의 : FlexLayoutSplitScreen은 실제 사용 환경에서의 안정성을 제대로 확인하지 않았습니다. 당신이 의도한 대로 동작하지 않을 수도 있습니다.

### 1) FlexLayoutSplitScreen (스플릿 루트)

```tsx
"use client";

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

- `layoutName: string` : 스플릿 화면 트리의 루트 키
- `containerName: string` : 이 화면(컨테이너)의 키
- `children: ReactNode`
- `navigationTitle?: string` : 탭/내비게이션용 타이틀
- `dropDocumentOutsideOption?: { openUrl: string; widthRatio?: number; heightRatio?: number }`  
  드롭을 “화면 밖”으로 했을 때 새 창/문서로 열기 옵션
- `screenKey?: string` : FlexLayoutSplitScreen내부에서 screen을 판별할 때 사용하는 유니크한 값입니다. 빈값일 경우 default 값으로 32자리의 랜덤 값을 생성합니다. 개발자가 제어할 수 없는 동적 분할 화면 뷰라면 가급적 빈값으로 이용하는 것을 권장합니다.

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

- `containerName: string` _(필수)_ : 드래그 항목 고유 키
- `children: ReactNode` : 실제 렌더링될 UI
- `targetComponent?: ReactNode` : 분할 화면에 새로 띄울 컴포넌트
- `navigationTitle?: string`
- `dropDocumentOutsideOption?: { openUrl: string; widthRatio?: number; heightRatio?: number }`
- `customData?: any` : 드롭 시 함께 전달할 임의 데이터
- `scrollTargetRef?: RefObject<HTMLElement>` : 드래그 중 스크롤 타겟(옵션)

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

`dragState`에는 드롭 여부(`isDrop`), 드래그 중 여부(`isDragging`), 오버 여부(`isOver`), 위치(`positionName`), 좌표(`x`,`y`) 등이 포함됩니다.

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

- **containerName은 가능한 한 “의미 있는 prefix”**를 붙이세요. (예: `left-container-${id}`, `menu:${identifierId}`)  
  Split Screen에서 중복 방지/트리 구성 시 디버깅이 훨씬 쉬워집니다.
- Next.js에서 서버 컴포넌트로 쓰면 오류가 날 수 있으니, 레이아웃 관련 파일 상단에 `"use client"`를 붙이세요.

---

## 내부 구현/스타일 구조는 계속 발전 중이라 API는 조금씩 바뀔 수 있습니다.
