# 프롬프트: 구현 코드로부터 DESIGN.md 생성 (from meta, 무손실 지향)

> 이 파일은 **실행용 프롬프트**입니다. 아래 "프롬프트 본문"을 그대로 Claude Code에 입력하면,
> 이 프로젝트에 이미 구현되어 있는 디자인 시스템(코드 = meta)을 **최대한 유실 없이** 추출하여
> 프로젝트 루트에 `DESIGN.md`를 생성합니다.
>
> 워크플로우 상 위치: `01-prd.txt` → `02-prd.md`(PRD) → `03-*.webp`(레퍼런스 디자인) → 앱 구현 →
> **`04` 이 프롬프트로 `DESIGN.md` 역추출**.

---

## 프롬프트 본문 (여기부터 복사해서 사용)

너는 이 프로젝트("미니 노션", Next.js)의 **이미 구현된 디자인 시스템을 코드에서 그대로 추출**하여
프로젝트 루트에 `DESIGN.md` 한 개 파일로 문서화하는 작업을 한다.

이 문서의 목적은 **디자인 지식의 무손실 보존**이다. 코드가 사라져도 `DESIGN.md`만으로 동일한 UI를
재현할 수 있어야 한다. 따라서 요약·의역·반올림·생략은 금지이며, **실제 값과 구조를 있는 그대로** 옮긴다.

### 0. 절대 규칙 (Loss-Prevention Rules) — 반드시 준수

1. **값은 원문 그대로.** 색상 HEX, px, rem, `cubic-bezier(...)`, ms, 폰트 웨이트 등 모든 값은
   코드에 적힌 그대로 복사한다. 어림값·근사치·"약", "등", "..." 표현 금지.
2. **전량 나열.** 토큰, 컴포넌트, 상태(state), 변형(variant), 화면을 **하나도 빠짐없이** 나열한다.
   "일부", "주요", "대표적인" 식으로 추려내지 말 것. 개수를 세어 누락 여부를 검증한다.
3. **추측 금지, 근거 표기.** 코드에서 확인된 사실만 적는다. 확인 불가한 항목은 지어내지 말고
   `※ 코드에서 확인 불가` 로 명시한다. 각 섹션에는 근거가 된 **소스 파일 경로**를 표기한다.
4. **의도까지 보존.** 수치뿐 아니라 "왜 그런지"(디자인 원칙·PRD 요구·와이어프레임 대응)도 함께 남긴다.
   `02-prd.md`와 레퍼런스 디자인(`03-1-reference-design.webp`, `03-2-reference-design.webp`)을 근거로 연결한다.
5. **한국어로 작성.** 코드 식별자(토큰명·클래스명·타입명)는 원문 영문 그대로 유지한다.

### 1. 먼저 읽을 소스 (아래 파일을 모두 정독한 뒤 작성 시작)

- 디자인 토큰·컴포넌트 스타일의 원천: **`app/globals.css`** (약 1038줄, `:root` 토큰 + 컴포넌트 클래스 전체)
- React 컴포넌트: `components/Avatar.tsx`, `components/Editor.tsx`, `components/PromptBox.tsx`,
  `components/GoogleLogo.tsx`, `components/Rail.tsx`
- 화면(페이지): `app/layout.tsx`, `app/page.tsx`, `app/login/page.tsx`,
  `app/workspace/page.tsx`, `app/me/page.tsx`
- 상태·데이터 모델: `lib/store.tsx` (타입 `User`, `Post` / `StoreProvider` / `useStore`), `lib/format.ts`
- 폰트: `app/fonts/PretendardVariable.woff2`, `app/layout.tsx`의 폰트 로딩부
- 제품 맥락·의도: `02-prd.md`, `README.md`
- 레퍼런스 와이어프레임: `03-1-reference-design.webp`, `03-2-reference-design.webp`
  (이미지를 열어 화면 구성과 대응시킬 것. README의 와이어프레임 번호 1a/1b/1d/1f/1g/1i 매핑을 활용)

> 만약 위 경로/파일이 실제와 다르면, 먼저 프로젝트를 훑어 실제 구조를 확인한 뒤 그 실제 파일을 기준으로 작성한다.

### 2. `DESIGN.md` 목차 (이 구조를 그대로 사용, 섹션 누락 금지)

1. **개요 (Overview)** — 제품 한 줄 정의, 이 문서의 목적/범위, 근거 소스 목록.
2. **디자인 원칙 (Design Principles)** — `globals.css` 상단 주석과 README·PRD에서 도출한 컨셉:
   웜 뉴트럴 그레이 + 단일 인디고-바이올렛 액센트(`#6a5df0`), 헤어라인 보더, 부드러운 라운드,
   위스퍼 섀도우, Pretendard, Lucide 라인 아이콘 등. 각 원칙이 어디에 반영됐는지 예시와 함께.
3. **디자인 토큰 (Design Tokens)** — `:root`의 **모든 CSS 변수**를 카테고리별 표로. **91개 전부**를 옮긴다.
   카테고리(코드 주석 순서 유지): `Neutral scale` / `Accent` / `Semantic hues` / `Surfaces` /
   `Text` / `Borders` / `Accent roles` / `Typography` / `Radius / elevation / motion`.
   표 컬럼: `토큰명` · `값(원문)` · `해석(별칭이면 최종 실제값)` · `용도/의미`.
   - 색상 토큰은 값 옆에 **색상 스와치**(마크다운에서 가능한 형태, 예: `#6a5df0` 표기)로 식별성 확보.
   - `var(--x)`로 참조하는 별칭 토큰은 **최종 실제값까지 풀어서** 함께 적는다(예: `--accent: var(--violet-500)` → `#6a5df0`).
   - 타이포 스케일(`--text-display`~`--text-micro`), 라인하이트, 자간, 웨이트, 반경, 그림자, ease, duration 모두 포함.
4. **타이포그래피 (Typography)** — 폰트 패밀리 스택(`--font-sans`, `--font-mono`), Pretendard Variable 로딩 방식,
   타입 스케일 표(토큰 → px → 용도), 본문 기본값(사이즈/라인하이트/색), `::selection` 색 등.
5. **컴포넌트 (Components)** — `globals.css`의 컴포넌트 섹션 **13개를 모두** 다룬다:
   `Buttons` / `Chip` / `Avatar` / `Sidebar rail` / `Workspace layout` / `Prompt box + slash menu` /
   `Post list` / `Detail / editor` / `Empty state` / `Login` / `Splash` / `Settings (my page)` / `Responsive`.
   각 컴포넌트마다:
   - **목적/역할**, 대응하는 React 컴포넌트 파일(있으면), 대응 와이어프레임 번호.
   - **해부(anatomy)**: 구성 요소와 계층.
   - **변형(variant)**: 예) 버튼의 primary/secondary/ghost 등 존재하는 모든 클래스 변형.
   - **상태(state)**: `hover` / `active` / `focus`(focus-ring) / `disabled` / `selected`/`current` 등
     CSS에 정의된 상태를 **전부**. 각 상태에서 바뀌는 속성과 사용 토큰.
   - **사용된 토큰 목록**과 핵심 수치(패딩·gap·radius·보더·그림자·트랜지션).
6. **레이아웃 & 화면 (Layouts & Screens)** — 화면별로:
   `/login`(1d) · `/workspace` 3-pane(좌측 레일 1a + 글 목록/상세 1b·1f·1g) · 빈 상태 · `/me`(1i) · 스플래시(`app/page.tsx`).
   각 화면: 구조(그리드/영역), 주요 UI 요소, `/page` 슬래시 메뉴 흐름, 반응형 동작(`Responsive` 섹션 기준).
7. **인터랙션 & 모션 (Interaction & Motion)** — 슬래시 명령(`/page`, 텍스트 Enter로 제목화),
   자동 저장, 즐겨찾기 토글, 휴지통(삭제→복원/영구삭제), 트랜지션 duration/ease 사용 규칙,
   호버/포커스 피드백. `PromptBox.tsx`·`Editor.tsx`·`store.tsx` 로직과 연결.
8. **데이터 모델 (Data Model, 디자인 영향분)** — `lib/store.tsx`의 `User`·`Post` 타입 필드 전량.
   디자인 제약으로 이어지는 값(별명 최대 20자 `#n/20` 카운터, 프로필 이미지 5MB 이하, 시드 샘플 4개 등)을 명시.
9. **에셋 & 아이콘 (Assets)** — Pretendard Variable(로컬 woff2, 라이선스/출처 확인 가능하면 표기),
   Lucide 라인 아이콘(사용처), `GoogleLogo.tsx`(브랜드 로고 SVG) 등.
10. **접근성 & 반응형 (Accessibility & Responsive)** — `--focus-ring`/`--shadow-focus`,
    포커스 가시성, 대비, `Responsive (light)` 섹션의 브레이크포인트와 변화.
11. **소스 매핑 (Source Map)** — "디자인 요소 → 소스 파일/라인" 대응표. 이 문서만 보고도 코드를 찾아갈 수 있게.
12. **알려진 한계 (Known Limits)** — README의 MVP 한계(목 인증, localStorage 저장 등) 중 **디자인/구현에 영향 있는 것**만.

### 3. 작성 형식 규칙

- 토큰·상태·변형처럼 **열거형 정보는 표(table)**로, 흐름·원칙은 산문으로.
- 색상은 항상 HEX 원문을 노출한다(이름만 쓰지 말 것).
- 코드 인용이 필요하면 짧은 스니펫을 코드블록으로 넣되, 값 왜곡 없이.
- 파일 경로는 인라인 코드(`app/globals.css`)로, 가능하면 `파일:라인` 형태로 근거 표기.

### 4. 마지막 단계 — 자기 검증 체크리스트(문서 끝에 포함하고, 실제로 점검)

작성을 마치면 `DESIGN.md` 하단에 아래 체크리스트를 넣고, 각 항목을 실제로 확인해 체크한다.
하나라도 미충족이면 문서를 보완한 뒤 다시 점검한다.

- [ ] `:root`의 CSS 변수 개수와 문서에 옮긴 토큰 개수가 **일치**한다(총 91개 기준, 실제 코드로 재확인).
- [ ] `globals.css`의 컴포넌트 섹션 **13개**가 모두 문서에 있다.
- [ ] React 컴포넌트 5개(Avatar/Editor/PromptBox/GoogleLogo/Rail)가 모두 언급된다.
- [ ] 화면 5개(login/workspace/me/splash/layout)가 모두 문서화됐다.
- [ ] 별칭 토큰(`var(--...)`)이 최종 실제값까지 풀려 있다.
- [ ] 모든 색상 값이 HEX 원문으로 노출된다.
- [ ] 각 섹션에 근거 소스 경로가 표기돼 있다.
- [ ] PRD·와이어프레임과의 대응(의도)이 최소 한 번 이상 연결돼 있다.

### 5. 산출물

- 프로젝트 루트에 `DESIGN.md` 한 개 파일을 생성한다.
- 작업 후, 위 체크리스트 결과와 "혹시 유실 가능성이 있는 부분"을 짧게 보고한다.

## 프롬프트 본문 끝
