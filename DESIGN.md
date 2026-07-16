# DESIGN.md — mini notion 디자인 시스템 (코드 역추출, 무손실 지향)

> 이 문서는 이미 구현된 코드(= meta)에서 디자인 시스템을 **있는 그대로** 추출한 것입니다.
> 값(HEX·px·rem·ms·cubic-bezier·웨이트 등)은 코드 원문 그대로 옮겼으며, 토큰·컴포넌트·상태·화면을 빠짐없이 나열했습니다.
> 근거 소스 경로는 각 섹션에 `파일:라인` 형태로 표기했습니다.

---

## 1. 개요 (Overview)

**제품 한 줄 정의**: "mini notion — 개인 업무를, 내 방식대로." 구글 로그인(Supabase Auth) 후 글(페이지)을 만들고·수정하고·정리·삭제하는, 유료 구독 없는 1인용 미니 노션.
(근거: `app/layout.tsx:14` `title: 'mini notion — 개인 업무를, 내 방식대로'`, `app/login/page.tsx:31-32`, `02-prd.md:1-5`)

**이 문서의 목적/범위**: 코드가 사라져도 이 문서만으로 동일한 UI를 재현할 수 있도록, 디자인 토큰 92개·컴포넌트 13개·화면 5개·상태/변형/모션을 무손실로 보존한다. 범위는 **디자인/구현에 드러난 시각·인터랙션 시스템**이며, 서버/배포 아키텍처는 다루지 않는다.

**근거 소스 목록**:

| 영역 | 파일 |
|---|---|
| 디자인 토큰·컴포넌트 스타일 원천 | `app/globals.css` (1158줄, `:root` 토큰 + 컴포넌트 클래스 전체) |
| React 컴포넌트 | `components/Avatar.tsx`, `components/Editor.tsx`, `components/PromptBox.tsx`, `components/GoogleLogo.tsx`, `components/Rail.tsx`, `components/CatCover.tsx` |
| 화면(페이지) | `app/layout.tsx`, `app/page.tsx`, `app/login/page.tsx`, `app/workspace/page.tsx`, `app/me/page.tsx` |
| 상태·데이터 모델 | `lib/store.tsx` (`User`·`Page`·`PagesStatus`·`SaveStatus` 타입, `StoreProvider`, `useStore`), `lib/format.ts` |
| 폰트 | `app/fonts/PretendardVariable.woff2`, `app/layout.tsx:6-11` |
| 제품 맥락·의도 | `02-prd.md`, `README.md` |
| 레퍼런스 와이어프레임 | `03-1-reference-design.webp`, `03-2-reference-design.webp` |

---

## 2. 디자인 원칙 (Design Principles)

`globals.css` 최상단 주석이 이 시스템의 컨셉을 한 줄로 요약한다 (`app/globals.css:1-6`):

```
mini notion — global styles
Tokens from the Mini Notion design system:
warm-neutral grays + single indigo-violet accent, Pretendard,
hairline borders, soft radii, whisper shadows.
```

여기서 도출되는 원칙과 코드 반영 지점:

1. **웜 뉴트럴 그레이 (warm-neutral grays)** — 중립 회색을 순수 회색이 아니라 미세하게 따뜻한 톤으로 잡는다. `--gray-25: #fcfcfb`, `--gray-50: #f7f7f5`처럼 R·G가 B보다 높다. 본문 텍스트도 순검정이 아닌 `--text-primary: #2f2f2b`. (근거: `app/globals.css:9-22, 54`)
2. **단일 인디고-바이올렛 액센트 (`#6a5df0`)** — 강조는 오직 바이올렛 한 계열로 통일한다. `--accent: var(--violet-500)` = `#6a5df0`. 액티브 내비, 선택 목록, 슬래시 하이라이트, 포커스 링, 뱃지, 전송 버튼 모두 이 계열을 쓴다. (근거: `app/globals.css:30, 67`; `README.md:43`)
3. **헤어라인 보더 (hairline borders)** — 1px, 낮은 대비의 회색 보더로 면을 나눈다. `--border-subtle: var(--gray-150)` = `#e9e9e6`가 레일·리스트·구분선의 기본. (근거: `app/globals.css:62, 283, 584, 782`)
4. **부드러운 라운드 (soft radii)** — 4px~20px + pill(999px)의 라운드 스케일. 카드/모달은 큰 반경, 버튼/필드는 중간 반경. (근거: `app/globals.css:100-106`)
5. **위스퍼 섀도우 (whisper shadows)** — 그림자는 거의 보이지 않을 만큼 옅게. 가장 강한 `--shadow-lg`도 alpha 0.1이 최대. 잉크 색은 검정이 아니라 웜톤 `rgba(23,23,20,…)`. (근거: `app/globals.css:107-111`)
6. **Pretendard** — 한글 최적 가변 폰트를 로컬 woff2로 로딩. `--font-sans` 스택 최상단. (근거: `app/layout.tsx:6-11`; `app/globals.css:74-75`)
7. **Lucide 라인 아이콘** — 아이콘은 모두 `lucide-react`의 라인(stroke) 아이콘, 크기 11~22px. (근거: `components/Rail.tsx:4`, `components/Editor.tsx:4`, `components/PromptBox.tsx:4`, `app/me/page.tsx:6`, `app/workspace/page.tsx:5`)

**PRD/와이어프레임 대응(의도)**: PRD의 "단순함·무료·개인 맞춤화를 크게 높인다"(`02-prd.md:65`)는 가치 곡선이, 최소 팔레트(단일 액센트)·헤어라인·위스퍼 섀도우라는 절제된 비주얼로 번역되었다. 레퍼런스 와이어프레임(`03-1`, `03-2`)의 좌측 레일 + 프롬프트 박스 + 카드형 목록 구성이 그대로 구현에 대응된다.

---

## 3. 디자인 토큰 (Design Tokens)

`:root`의 CSS 변수 **총 92개 전량**. 카테고리 순서는 코드 주석 순서를 유지한다. 별칭(`var(--x)`) 토큰은 **최종 실제값**까지 풀어 적는다. (근거: `app/globals.css:7-118`)

### 3.1 Neutral scale (14개) — `app/globals.css:8-22`

| 토큰명 | 값(원문) | 해석(최종 실제값) | 용도/의미 |
|---|---|---|---|
| `--white` | `#ffffff` | #ffffff | 페이지/카드 기본 바탕 |
| `--gray-25` | `#fcfcfb` | #fcfcfb | 극히 옅은 웜 화이트 |
| `--gray-50` | `#f7f7f5` | #f7f7f5 | 사이드바/sunken 표면 |
| `--gray-100` | `#f0f0ee` | #f0f0ee | hover 표면 |
| `--gray-150` | `#e9e9e6` | #e9e9e6 | active 표면 / subtle 보더 |
| `--gray-200` | `#e3e3df` | #e3e3df | default 보더 / disabled 배경 |
| `--gray-300` | `#d5d5d0` | #d5d5d0 | strong 보더 |
| `--gray-400` | `#b6b6af` | #b6b6af | disabled 텍스트 / send disabled 아이콘 |
| `--gray-500` | `#90908a` | #90908a | tertiary 텍스트 |
| `--gray-600` | `#6e6e68` | #6e6e68 | secondary 텍스트 |
| `--gray-700` | `#52524d` | #52524d | (스케일 상 진한 회색) |
| `--gray-800` | `#363632` | #363632 | (스케일 상 더 진한 회색) |
| `--gray-900` | `#23231f` | #23231f | 그림자 잉크 베이스(rgb 23,23,20 근사) |
| `--black` | `#1a1a17` | #1a1a17 | inverse 표면(브랜드 타일 등) |

### 3.2 Accent (8개) — `app/globals.css:24-32`

| 토큰명 | 값(원문) | 해석 | 용도/의미 |
|---|---|---|---|
| `--violet-50` | `#f2f1fd` | #f2f1fd | accent-soft(연한 강조 배경) |
| `--violet-100` | `#e6e4fb` | #e6e4fb | 아바타 배경 / `::selection` |
| `--violet-200` | `#cdc9f6` | #cdc9f6 | accent-soft-border |
| `--violet-300` | `#ada6ef` | #ada6ef | 선택된 리스트 로우 보더 |
| `--violet-400` | `#8a80e6` | #8a80e6 | (스케일) |
| `--violet-500` | `#6a5df0` | #6a5df0 | **핵심 액센트** |
| `--violet-600` | `#5b4fdb` | #5b4fdb | accent-hover / text-accent |
| `--violet-700` | `#4a40b5` | #4a40b5 | 아바타 이니셜 텍스트 |

### 3.3 Semantic hues (8개) — `app/globals.css:34-42`

| 토큰명 | 값(원문) | 해석 | 용도/의미 |
|---|---|---|---|
| `--blue-500` | `#4c8dff` | #4c8dff | (정의됨, 코드에서 직접 사용처 확인 불가) |
| `--blue-50` | `#eaf2ff` | #eaf2ff | (정의됨, 사용처 확인 불가) |
| `--green-500` | `#35b37e` | #35b37e | 저장 완료 노트(`.saved-note`) |
| `--green-50` | `#e7f6ef` | #e7f6ef | (정의됨, 사용처 확인 불가) |
| `--amber-500` | `#e8a33d` | #e8a33d | (정의됨, 현재 사용처 없음 — 즐겨찾기 별이 사라지며 참조처가 없어짐) |
| `--amber-50` | `#fbf1df` | #fbf1df | (정의됨, 사용처 확인 불가) |
| `--red-500` | `#e5484d` | #e5484d | 위험·실패 신호 전반(danger 버튼·`.list-error`·`.list-notice`·`.save-state.err`·로그인 오류·저장 오류) |
| `--red-50` | `#fceceb` | #fceceb | danger hover 배경(`.btn-danger:hover`) / `.list-notice` 배경 |

### 3.4 Surfaces (7개) — `app/globals.css:44-51`

| 토큰명 | 값(원문) | 해석(최종 실제값) | 용도/의미 |
|---|---|---|---|
| `--surface-page` | `var(--white)` | #ffffff | 페이지/리스트페인 바탕 |
| `--surface-sidebar` | `var(--gray-50)` | #f7f7f5 | 좌측 레일 배경 |
| `--surface-card` | `var(--white)` | #ffffff | 버튼/칩/카드/필드/모달 배경 |
| `--surface-sunken` | `var(--gray-50)` | #f7f7f5 | 로그인/스플래시 바탕 |
| `--surface-hover` | `var(--gray-100)` | #f0f0ee | hover 상태 배경 |
| `--surface-active` | `var(--gray-150)` | #e9e9e6 | active 상태 배경 |
| `--surface-inverse` | `var(--black)` | #1a1a17 | 브랜드 타일/로그인 로고 배경 |

### 3.5 Text (6개) — `app/globals.css:53-59`

| 토큰명 | 값(원문) | 해석(최종 실제값) | 용도/의미 |
|---|---|---|---|
| `--text-primary` | `#2f2f2b` | #2f2f2b | 본문·제목 기본 텍스트 |
| `--text-secondary` | `var(--gray-600)` | #6e6e68 | 보조 텍스트/내비 라벨 |
| `--text-tertiary` | `var(--gray-500)` | #90908a | 3차 텍스트(메타·플레이스홀더·카운트) |
| `--text-disabled` | `var(--gray-400)` | #b6b6af | 비활성 텍스트 |
| `--text-on-accent` | `var(--white)` | #ffffff | 액센트 배경 위 텍스트 |
| `--text-accent` | `var(--violet-600)` | #5b4fdb | 액센트 텍스트(액티브 내비·슬래시 하이라이트·뱃지) |

### 3.6 Borders (3개) — `app/globals.css:61-64`

| 토큰명 | 값(원문) | 해석(최종 실제값) | 용도/의미 |
|---|---|---|---|
| `--border-subtle` | `var(--gray-150)` | #e9e9e6 | 헤어라인 기본(레일·리스트로우·구분선) |
| `--border-default` | `var(--gray-200)` | #e3e3df | 버튼·칩·필드·프롬프트 보더 |
| `--border-strong` | `var(--gray-300)` | #d5d5d0 | 리스트로우 hover 보더 |

### 3.7 Accent roles (5개) — `app/globals.css:66-71`

| 토큰명 | 값(원문) | 해석(최종 실제값) | 용도/의미 |
|---|---|---|---|
| `--accent` | `var(--violet-500)` | #6a5df0 | 주 강조색(버튼·전송·포커스 보더) |
| `--accent-hover` | `var(--violet-600)` | #5b4fdb | 강조 hover |
| `--accent-soft` | `var(--violet-50)` | #f2f1fd | 연한 강조 배경(액티브 내비·선택 로우·슬래시 하이라이트·뱃지·empty 아이콘) |
| `--accent-soft-border` | `var(--violet-200)` | #cdc9f6 | 연한 강조 보더(empty 아이콘) |
| `--focus-ring` | `color-mix(in srgb, var(--violet-500) 40%, transparent)` | #6a5df0 40% 알파(위에 transparent 혼합) | 포커스 링 색(그림자로 사용) |

### 3.8 Typography (23개) — `app/globals.css:73-97`

| 토큰명 | 값(원문) | 해석 | 용도/의미 |
|---|---|---|---|
| `--font-sans` | `var(--font-pretendard), "Pretendard Variable", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Segoe UI", Roboto, sans-serif` | Pretendard 우선 산세리프 스택 | 본문 기본 폰트 |
| `--font-mono` | `ui-monospace, "SF Mono", Menlo, Consolas, monospace` | 모노 스택 | 카운트·카운터 숫자 |
| `--fw-regular` | `400` | 400 | 기본 굵기 |
| `--fw-medium` | `500` | 500 | 버튼·내비·목록 제목 |
| `--fw-semibold` | `600` | 600 | 강조 라벨·아바타·리스트 제목 |
| `--fw-bold` | `700` | 700 | 큰 제목(display/h1/h2)·브랜드 타일 |
| `--text-display` | `34px` | 34px | 에디터 제목 입력(title-input) |
| `--text-h1` | `26px` | 26px | 로그인 제목·설정 제목 |
| `--text-h2` | `21px` | 21px | 빈 상태 헤드라인 |
| `--text-h3` | `17px` | 17px | (스케일 정의, 직접 사용처 확인 불가) |
| `--text-lg` | `16px` | 16px | 브랜드명·btn-lg |
| `--text-base` | `15px` | 15px | 본문 기본(body)·내용 입력 |
| `--text-sm` | `14px` | 14px | 버튼·칩·내비·목록 제목·태그라인 |
| `--text-xs` | `13px` | 13px | 메타·힌트·브레드크럼·저장상태 |
| `--text-2xs` | `12px` | 12px | 카운트·카운터·리스트 메타 |
| `--text-micro` | `11px` | 11px | 섹션 라벨·뱃지·"준비 중" |
| `--lh-tight` | `1.2` | 1.2 | 큰 제목 라인하이트 |
| `--lh-snug` | `1.35` | 1.35 | empty 헤드라인 |
| `--lh-normal` | `1.55` | 1.55 | body 기본 라인하이트 |
| `--lh-relaxed` | `1.7` | 1.7 | 내용 입력 라인하이트 |
| `--ls-tight` | `-0.02em` | -0.02em | 큰 제목 자간 |
| `--ls-snug` | `-0.01em` | -0.01em | 브랜드명 자간 |
| `--ls-wide` | `0.04em` | 0.04em | 섹션 라벨·뱃지 자간(대문자풍 라벨) |

### 3.9 Radius / elevation / motion (18개) — `app/globals.css:99-117`

| 토큰명 | 값(원문) | 해석 | 용도/의미 |
|---|---|---|---|
| `--radius-xs` | `4px` | 4px | 목록 스켈레톤 막대(`.listrow-skeleton span`) |
| `--radius-sm` | `6px` | 6px | 계정 뱃지(`.badge`) |
| `--radius-md` | `8px` | 8px | 버튼·칩 rowselect·필드·검색·내비·브랜드 타일·`.list-notice` |
| `--radius-lg` | `12px` | 12px | btn-lg·리스트로우·슬래시메뉴·커버·로그인 로고 |
| `--radius-xl` | `16px` | 16px | 프롬프트 박스 |
| `--radius-2xl` | `20px` | 20px | 로그인 카드 |
| `--radius-pill` | `999px` | 999px | 칩·"준비 중" 배지·둥근 캡슐 |
| `--shadow-xs` | `0 1px 2px rgba(23, 23, 20, 0.05)` | 미세 그림자 | 프롬프트 박스·리스트로우 hover |
| `--shadow-sm` | `0 1px 3px rgba(23, 23, 20, 0.06), 0 1px 2px rgba(23, 23, 20, 0.04)` | 옅은 그림자 | (정의됨, 직접 사용처 확인 불가) |
| `--shadow-md` | `0 4px 12px rgba(23, 23, 20, 0.07), 0 2px 4px rgba(23, 23, 20, 0.04)` | 중간 그림자 | 로그인 카드 |
| `--shadow-lg` | `0 12px 32px rgba(23, 23, 20, 0.1), 0 4px 8px rgba(23, 23, 20, 0.05)` | 강한 그림자 | 슬래시 메뉴(팝오버) |
| `--shadow-focus` | `0 0 0 3px var(--focus-ring)` | 3px 포커스 링(= #6a5df0 40%) | 포커스 시 외곽 링 |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0.1, 1)` | 표준 이징 | 대부분 트랜지션 |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | 감속 이징 | (정의됨, 직접 사용처 확인 불가) |
| `--dur-fast` | `120ms` | 120ms | 배경·보더·색 전환 기본 |
| `--dur-base` | `180ms` | 180ms | (정의됨, 직접 사용처 확인 불가) |
| `--dur-slow` | `260ms` | 260ms | (정의됨, 직접 사용처 확인 불가) |
| `--dur-shimmer` | `1400ms` | 1400ms | 스켈레톤 pulse 주기 — 커버(`.cover-skeleton`, §5.14)와 목록(`.listrow-skeleton span`, §5.7)이 같은 `cover-pulse` 키프레임·같은 주기를 공유 |

> **토큰 합계 검증**: Neutral 14 + Accent 8 + Semantic 8 + Surfaces 7 + Text 6 + Borders 3 + Accent roles 5 + Typography 23 + Radius/elevation/motion 18 = **92개** (코드 `:root` 실측치 92와 일치).

---

## 4. 타이포그래피 (Typography)

**폰트 패밀리 스택** (`app/globals.css:74-76`):
- `--font-sans`: `var(--font-pretendard), "Pretendard Variable", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Segoe UI", Roboto, sans-serif`
- `--font-mono`: `ui-monospace, "SF Mono", Menlo, Consolas, monospace`

**Pretendard Variable 로딩 방식** (`app/layout.tsx:6-11`): Next.js `next/font/local`로 로컬 `./fonts/PretendardVariable.woff2`를 로딩한다.

```ts
const pretendard = localFont({
  src: './fonts/PretendardVariable.woff2',
  display: 'swap',
  weight: '45 920',
  variable: '--font-pretendard',
})
```

- `display: 'swap'` — FOUT 방식(폰트 로딩 중 시스템 폰트로 먼저 표시).
- `weight: '45 920'` — 가변 폰트 웨이트 범위 45~920.
- `variable: '--font-pretendard'` — CSS 변수로 노출, `<html>`에 `pretendard.variable` 클래스 부여(`app/layout.tsx:24`). `--font-sans`가 이 변수를 최우선 참조.

**타입 스케일 표** (토큰 → px → 용도):

| 토큰 | px | 주 용도 |
|---|---|---|
| `--text-display` | 34px | 에디터 제목 입력 `.title-input` |
| `--text-h1` | 26px | 로그인 제목 `.login-title`, 설정 제목 `.settings-title` |
| `--text-h2` | 21px | 빈 상태 헤드라인 `.empty h2` |
| `--text-h3` | 17px | (사용처 코드 확인 불가) |
| `--text-lg` | 16px | 브랜드명 `.brand-name`, `.btn-lg` |
| `--text-base` | 15px | 본문 `body`, 내용 입력 `.content-input` |
| `--text-sm` | 14px | 버튼·칩·내비·목록 제목·태그라인 등 |
| `--text-xs` | 13px | 메타·힌트·브레드크럼·저장상태·리스트 스니펫 |
| `--text-2xs` | 12px | 카운트·카운터·리스트 메타 |
| `--text-micro` | 11px | 섹션 라벨·뱃지·"준비 중" |

**본문 기본값** (`app/globals.css:128-136`):

```css
body {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-base);      /* 15px */
  line-height: var(--lh-normal);    /* 1.55 */
  color: var(--text-primary);       /* #2f2f2b */
  background: var(--surface-page);  /* #ffffff */
  -webkit-font-smoothing: antialiased;
}
```

**`::selection` 색** (`app/globals.css:155-157`): 드래그 선택 배경은 `--violet-100` = `#e6e4fb`.

**기타 텍스트 기본** (`app/globals.css:138-153`): `a`는 `color: inherit; text-decoration: none;`, `button`/`input`/`textarea`는 `font: inherit; color: inherit;`(버튼은 `cursor: pointer` 추가).

---

## 5. 컴포넌트 (Components)

`globals.css`의 컴포넌트 섹션 **13개 전부**를 다룬다. 각 컴포넌트의 목적·해부·변형·상태·사용 토큰/수치를 기록한다.

### 5.1 Buttons — `app/globals.css:160-232`

- **목적/역할**: 모든 액션 트리거의 기본형. 대응 React 컴포넌트 파일 없음(순수 CSS 클래스, 각 페이지에서 `<button className="btn …">`로 사용). 대응 와이어프레임: 전역.
- **해부**: `inline-flex` + `align-items:center` + `justify-content:center`, `gap:6px`(아이콘-라벨), `padding:7px 14px`, `border:1px solid --border-default`, `border-radius:--radius-md`(8px), `background:--surface-card`, `color:--text-primary`, `font-size:--text-sm`(14px), `font-weight:--fw-medium`(500).
- **변형(variant)** — 존재하는 모든 클래스:

| 클래스 | 배경 | 보더 | 텍스트 | 비고 |
|---|---|---|---|---|
| `.btn` (기본) | `--surface-card` #ffffff | `--border-default` #e3e3df | `--text-primary` #2f2f2b | 기본 |
| `.btn-accent` | `--accent` #6a5df0 | `--accent` #6a5df0 | `--text-on-accent` #ffffff | 주 액션 |
| `.btn-danger` | (기본) | `color-mix(in srgb, --red-500 35%, transparent)` (#e5484d 35%) | `--red-500` #e5484d | 위험 액션 |
| `.btn-ghost` | `transparent` | `transparent` | `--text-secondary` #6e6e68 | 저강조 |
| `.btn-lg` | (조합용) | — | — | 크기 변형: `padding:12px 18px`, `font-size:--text-base`(15px), `font-weight:--fw-semibold`(600), `border-radius:--radius-lg`(12px), `gap:10px` |

- **상태(state)**:

| 상태 | 셀렉터 | 변화 |
|---|---|---|
| hover(기본) | `.btn:hover` | `background:--surface-hover` (#f0f0ee) |
| disabled | `.btn:disabled` | `opacity:0.5; cursor:default` |
| disabled+hover | `.btn:disabled:hover` | `background:--surface-card`(hover 무효화) |
| hover(accent) | `.btn-accent:hover` | `background/border:--accent-hover` (#5b4fdb) |
| disabled+hover(accent) | `.btn-accent:disabled:hover` | `background:--accent`(원복) |
| hover(danger) | `.btn-danger:hover` | `background:--red-50` (#fceceb) |
| hover(ghost) | `.btn-ghost:hover` | `background:--surface-hover` (#f0f0ee) |

- **트랜지션**: `background`, `border-color`, `color` 각 `--dur-fast`(120ms) `--ease-standard`.

### 5.2 Chip — `app/globals.css:234-253`

- **목적/역할**: 추천형 캡슐. 사용처: 빈 상태 추천 칩(`app/workspace/page.tsx:185`) 하나뿐. 와이어프레임: 1b(추천).
- **해부**: `inline-flex`, `gap:6px`, `padding:6px 14px`, `border:1px solid --border-default`, `border-radius:--radius-pill`(999px), `background:--surface-card`, `color:--text-secondary`(#6e6e68), `font-size:--text-sm`.
- **변형/상태**: 토글 on/off 변형은 없다(칩을 쓰던 즐겨찾기 토글이 사라지며 `.chip.on` 스타일도 함께 제거됨). 남은 상태는 hover 하나.

| 상태 | 셀렉터 | 변화 |
|---|---|---|
| hover(버튼 칩) | `button.chip:hover` | `background:--surface-hover` (#f0f0ee) |

- **트랜지션**: `background`, `border-color`, `color` × `--dur-fast` `--ease-standard`.

### 5.3 Avatar — `app/globals.css:255-272` · `components/Avatar.tsx`

- **목적/역할**: 사용자 프로필 원형 아바타. 이미지 있으면 이미지, 없으면 닉네임 첫 글자(없으면 `?`).
- **해부(CSS)**: `inline-flex` 중앙정렬, `flex:none`, `border-radius:50%`, `background:--violet-100`(#e6e4fb), `color:--violet-700`(#4a40b5), `font-weight:--fw-semibold`, `overflow:hidden`. 내부 `img`는 `width/height:100%`, `object-fit:cover`.
- **해부(React, `components/Avatar.tsx:3-16`)**: props `{ user: User; size: number }`. 인라인 스타일로 `width:size`, `height:size`, `fontSize: Math.round(size * 0.42)`. 즉 폰트 크기는 지름의 42%.
  - 이미지 분기: `user.image ? <img src alt={`${nickname} 프로필 이미지`}/> : (user.nickname.charAt(0) || '?')`.
- **사용된 size**: 레일 푸터 30(`Rail.tsx:67`), 마이페이지 프로필 78(`me/page.tsx:129`).
- **상태**: 별도 hover/focus 없음(정적).

### 5.4 Sidebar rail — `app/globals.css:274-424` · `components/Rail.tsx`

- **목적/역할**: 좌측 3-pane의 1번째 pane. 브랜드·검색·내비게이션·유저 푸터. 대응 와이어프레임: 1a.
- **해부(구조 계층)**: `.rail` → `.brand`(`.brand-tile` + `.brand-name`) → `.rail-search`(아이콘 + input) → `.section-label` → `.navitem` × N(아이콘 + 라벨 + `.count`) → `.rail-spacer` → `.rail-footer`(Avatar + `.rail-username` + `.gear`).
- **핵심 수치/토큰**:

| 요소 | 주요 값 |
|---|---|
| `.rail` | `width:260px`, `flex:none`, `flex-direction:column`, `height:100%`, `padding:16px 12px 14px`, `background:--surface-sidebar`(#f7f7f5), `border-right:1px solid --border-subtle`(#e9e9e6) |
| `.brand` | `gap:9px`, `padding:2px 6px 16px` |
| `.brand-tile` | `26×26px`, `border-radius:--radius-md`, `background:--surface-inverse`(#1a1a17), `color:#fff`, `font-size:13px`, `font-weight:--fw-bold` |
| `.brand-name` | `font-size:--text-lg`(16px), `font-weight:--fw-semibold`, `letter-spacing:--ls-snug`(-0.01em) |
| `.rail-search` | `gap:8px`, `margin-bottom:18px`, `padding:7px 10px`, `border:1px solid --border-default`, `border-radius:--radius-md`, `background:--surface-card`, `color:--text-tertiary` |
| `.section-label` | `padding:4px 8px 6px`, `font-size:--text-micro`(11px), `font-weight:--fw-semibold`, `letter-spacing:--ls-wide`(0.04em), `color:--text-tertiary` |
| `.navitem` | `gap:9px`, `width:100%`, `padding:7px 8px`, `border:none`, `border-radius:--radius-md`, `background:transparent`, `color:--text-secondary`, `font-size:--text-sm`, `font-weight:--fw-medium`, `text-align:left` |
| `.navitem .count` | `margin-left:auto`, `font-family:--font-mono`, `font-size:--text-2xs`(12px), `color:--text-tertiary` |
| `.rail-footer` | `gap:9px`, `margin-top:12px`, `padding:12px 8px 0`, `border-top:1px solid --border-subtle`, `width:100%` |
| `.rail-username` | `--text-sm`, `--fw-medium`, `--text-primary`, 말줄임(`overflow:hidden; white-space:nowrap; text-overflow:ellipsis`) |
| `.rail-footer .gear` | `margin-left:auto`, `color:--text-tertiary` |

- **상태(state)**:

| 상태 | 셀렉터 | 변화 |
|---|---|---|
| 검색 focus | `.rail-search:focus-within` | `border-color:--accent`(#6a5df0), `box-shadow:--shadow-focus`(3px #6a5df0 40%) |
| 내비 hover | `.navitem:hover` | `background:--surface-hover`(#f0f0ee) |
| 내비 active | `.navitem.active` | `background:--accent-soft`(#f2f1fd), `color:--text-accent`(#5b4fdb) |
| active 카운트 | `.navitem.active .count` | `color:--text-accent` |
| 푸터 hover | `.rail-footer:hover .rail-username` | `color:--text-accent` |

- **React(`components/Rail.tsx`)**: `NavKey = 'all'` — 내비는 **1개뿐**이다. `NAV_LABELS = {all:'전체 페이지'}`(`Rail.tsx:12-14`), `NAV_ICONS = {all:FileText}`(`Rail.tsx:16-18`, Lucide, size 15). 즐겨찾기·최근 항목·휴지통 내비는 해당 기능이 사라지며 함께 제거됐고(`Rail.tsx:8-9` 주석), 특히 '최근 항목'은 수정 시각 정렬이 없어지면 '전체 페이지'와 같은 목록이 되어 남길 이유가 없었다. 목록 렌더는 `Object.keys(NAV_LABELS)` 순회 구조를 유지해 항목이 늘면 그대로 확장된다. 검색 아이콘 `Search size={14}`. 푸터는 `/me`로 가는 `<Link>`, `title="마이 페이지"`, Avatar size 30(`Rail.tsx:67`), `Settings size={15}`.

### 5.5 Workspace layout — `app/globals.css:426-442`

- **목적/역할**: 업무 페이지 3-pane 레이아웃 컨테이너. 대응 와이어프레임: 1a+1b. React: `app/workspace/page.tsx`(`<main className="workspace">`).
- **해부**: `.workspace`(flex 컨테이너) → `.rail`(260px) + `.listpane`(320px) + `.detail`(flex:1).

| 요소 | 값 |
|---|---|
| `.workspace` | `display:flex`, `height:100dvh`, `overflow:hidden` |
| `.listpane` | `width:320px`, `flex:none`, `flex-direction:column`, `padding:16px 14px`, `overflow-y:auto`, `border-right:1px solid --border-subtle`, `background:--surface-page` |

- **주의**: `.detail`은 §5.8에 정의. `/me` 페이지도 `.workspace` + `.rail` 구조를 재사용하되 우측을 `.settings-body`로 바꾼다(`app/me/page.tsx:92-93`).

### 5.6 Prompt box + slash menu — `app/globals.css:444-567` · `components/PromptBox.tsx`

- **목적/역할**: 목록 상단의 새 페이지 생성 입력창 + 슬래시 명령 팝오버. 노션식 `/page` 명령. 대응 와이어프레임: 1b.
- **해부(구조)**: `.promptbox`(relative) → `.promptbox-inner`(input + `.send` 원형 버튼) → `.slashmenu`(absolute 팝오버: `.slashmenu-label` + `.slashmenu-row` × N + `.slashmenu-empty`).
- **핵심 수치/토큰**:

| 요소 | 값 |
|---|---|
| `.promptbox` | `position:relative`, `margin-bottom:16px`, `flex:none` |
| `.promptbox-inner` | `gap:8px`, `padding:7px 7px 7px 14px`, `border:1px solid --border-default`, `border-radius:--radius-xl`(16px), `background:--surface-card`, `box-shadow:--shadow-xs` |
| `.promptbox input` | `flex:1`, `border:none`, `outline:none`, `background:transparent`, `font-size:--text-sm`; placeholder `--text-tertiary` |
| `.send` | `32×32px`, `flex:none`, `border:none`, `border-radius:50%`, `background:--accent`(#6a5df0), `color:#fff` |
| `.slashmenu` | `position:absolute`, `top:calc(100% + 6px)`, `left:0`, `z-index:20`, `width:252px`, `padding:4px`, `border:1px solid --border-default`, `border-radius:--radius-lg`(12px), `background:--surface-card`, `box-shadow:--shadow-lg` |
| `.slashmenu-label` | `padding:8px 10px 4px`, `--text-micro`, `--fw-semibold`, `--ls-wide`, `--text-tertiary` |
| `.slashmenu-row` | `gap:9px`, `width:100%`, `padding:8px 10px`, `border-radius:--radius-md`, `--text-sm`, `--fw-medium`, `--text-primary`, `text-align:left` |
| `.slashmenu-row .soon` | `margin-left:auto`, `padding:1px 7px`, `border:1px solid --border-subtle`, `border-radius:--radius-pill`, `--text-micro`, `--fw-regular`, `--text-disabled` |
| `.slashmenu-empty` | `padding:10px`, `--text-xs`, `--text-tertiary` |

- **상태(state)**:

| 상태 | 셀렉터 | 변화 |
|---|---|---|
| 박스 focus | `.promptbox-inner:focus-within` | `border-color:--accent`, `box-shadow:--shadow-focus` |
| 전송 hover | `.send:hover` | `background:--accent-hover`(#5b4fdb) |
| 전송 disabled | `.send:disabled` | `background:--gray-200`(#e3e3df), `color:--gray-400`(#b6b6af), `cursor:default` |
| 슬래시 하이라이트 | `.slashmenu-row.hl` | `background:--accent-soft`, `color:--text-accent` |
| 슬래시 disabled | `.slashmenu-row:disabled` | `color:--text-disabled`, `cursor:default` |

- **React(`components/PromptBox.tsx`)**: `SLASH_ITEMS`(`PromptBox.tsx:6-10`) = `page`(라벨 "page — 새 페이지", 아이콘 `FileText`, enabled:true), `todo`(라벨 "할 일 목록", `CheckSquare`, enabled:false), `heading`(라벨 "제목", `Heading1`, enabled:false). placeholder `"'/page' 입력해 새 페이지…"`. `.send` 아이콘 `ArrowUp size={16}`, `aria-label="새 페이지 만들기"`. 슬래시 행 아이콘 `size={15}`. 슬래시 라벨 "기본 블록", 빈 결과 "일치하는 명령이 없어요.", disabled 배지 "준비 중".

### 5.7 Page list — `app/globals.css:569-716` · `app/workspace/page.tsx`

- **목적/역할**: 리스트페인 안의 페이지 카드 목록 + 그 목록이 가질 수 있는 모든 상태(로딩·실패·비었음·알림). 대응 와이어프레임: 1b.
- **해부(구조)**: (`.list-notice`) → `.list-section-label`(섹션 카운트) → `pagesStatus`에 따라 **셋 중 하나** — `.listrow-skeleton` × 3(loading) / `.list-error`(error) / `.listrow` × N 또는 `.list-empty`(ready). `.listrow`는 각각 `.listrow-title` + `.listrow-snippet` + `.listrow-meta`(작성 날짜)를 담고, 로우 안에 중첩 액션이 없어 `.listrow` 자체가 `<button>`이다.
- **상태 3분기 원칙**: "비었다(`.list-empty`)"·"아직 모른다(`.listrow-skeleton`)"·"못 불러왔다(`.list-error`)"는 서로 다른 화면이며 문구를 절대 공유하지 않는다. 이를 구분하지 않으면 로딩 중에 "아직 페이지가 없어요"가 번쩍이고, 불러오기에 실패한 사용자는 글이 사라진 줄로 오해한다(근거 주석: `app/globals.css:644-645`, `lib/store.tsx:31-32`, `app/workspace/page.tsx:117-118`).
- **핵심 수치/토큰**:

| 요소 | 값 |
|---|---|
| `.list-section-label` | `padding:4px 2px 8px`, `--text-micro`, `--fw-semibold`, `--ls-wide`, `--text-tertiary`, `flex:none` |
| `.listrow` | `display:block`, `width:100%`, `margin-bottom:8px`, `padding:10px 12px`, `border:1px solid --border-subtle`, `border-radius:--radius-lg`(12px), `background:--surface-card`, `text-align:left` |
| `.listrow-title` | `--text-sm`, `--fw-semibold`, 말줄임 |
| `.listrow-title.untitled` | `color:--text-tertiary`, `font-weight:--fw-medium` |
| `.listrow-snippet` | `margin-top:2px`, `--text-xs`, `--text-tertiary`, 말줄임 |
| `.listrow-meta` | `gap:6px`, `margin-top:7px`, `--text-2xs`, `--text-tertiary` |
| `.list-empty` | `padding:24px 8px`, `--text-xs`, `--text-tertiary`, `text-align:center` |
| `.list-error` | `padding:24px 8px`, `--text-xs`, `color:--red-500`(#e5484d), `text-align:center` — `.list-empty`와 같은 박스·다른 색(중립 회색 → danger) |
| `.list-notice` | `justify-content:space-between`, `gap:8px`, `margin-bottom:8px`, `padding:8px 10px`, `border:1px solid color-mix(in srgb, --red-500 25%, transparent)`(#e5484d 25%), `border-radius:--radius-md`(8px), `background:--red-50`(#fceceb), `--text-xs`, `color:--red-500` |
| `.list-notice button` | `flex:none`, `color:--red-500`, `opacity:0.7` |
| `.listrow-skeleton` | `margin-bottom:8px`, `padding:10px 12px`, `border:1px solid --border-subtle`, `border-radius:--radius-lg`(12px), `background:--surface-card` — `.listrow`와 **동일한 박스 수치**라 실제 목록으로 바뀔 때 레이아웃이 흔들리지 않는다 |
| `.listrow-skeleton span` | `display:block`, `border-radius:--radius-xs`(4px), `animation:cover-pulse --dur-shimmer ease-in-out infinite` |
| `.listrow-skeleton .sk-title` | `width:62%`, `height:13px` |
| `.listrow-skeleton .sk-snippet` | `width:88%`, `height:11px`, `margin-top:6px` |
| `.listrow-skeleton .sk-meta` | `width:34px`, `height:9px`, `margin-top:9px` |

- **상태(state)**:

| 상태 | 셀렉터 | 변화 |
|---|---|---|
| hover | `.listrow:hover` | `border-color:--border-strong`(#d5d5d0), `box-shadow:--shadow-xs` |
| 선택됨 | `.listrow.sel` | `border-color:--violet-300`(#ada6ef), `background:--accent-soft`(#f2f1fd) |
| 알림 닫기 hover | `.list-notice button:hover` | `opacity:1`(기본 0.7) |
| 모션 축소 | `@media (prefers-reduced-motion: reduce)` → `.listrow-skeleton span` | `animation:none`(정적 유지, `app/globals.css:712-716`) |

- **트랜지션**: `border-color`, `background`, `box-shadow` × `--dur-fast` `--ease-standard`.
- **스켈레톤 pulse**: `.listrow-skeleton span`은 커버 스켈레톤이 쓰는 `cover-pulse` 키프레임(`app/globals.css:804-812`)과 `--dur-shimmer`(1400ms)를 **그대로 재사용**한다 — 로딩 표현을 한 벌만 유지하기 위함이며, 새 키프레임·새 토큰을 만들지 않는다. 회전 스피너는 이 시스템 어디에도 없다.
- **React 표시 규칙(`app/workspace/page.tsx:119-157`)**: `pagesStatus`가 유일한 분기 기준이다.
  - `loading` → `[0,1,2].map`으로 `.listrow-skeleton` **3개** 고정 렌더, 각각 `aria-hidden="true"`(스크린리더에 자리표시를 읽히지 않는다).
  - `error` → `.list-error` 하나, `role="alert"`, 문구 "페이지를 불러오지 못했어요. 연결을 확인하고 새로고침해 주세요.".
  - `ready` → 목록이 비었으면 `.list-empty`(§6.3), 아니면 `.listrow` × N. **`ready`가 아니면 빈 상태 문구는 절대 나오지 않는다.**
  - 로우 내용: 제목 없으면 "제목 없음" + `untitled`. 스니펫은 `content.split('\n')[0]`이며 `content`가 있을 때만 렌더. 메타는 `formatDate(createdAt)` 하나뿐(별 표시·nav별 날짜 분기 없음).
- **`.list-notice`(`app/workspace/page.tsx:106-113`)**: `pagesStatus`와 무관하게 `notice`가 있으면 프롬프트 박스 바로 아래, 섹션 라벨 위에 뜬다. `role="alert"` + 닫기 버튼(`X size={12}`, `aria-label="알림 닫기"` → `dismissNotice`). 낙관적 생성/삭제가 실패해 화면을 되돌렸을 때 그 사실을 알리는 유일한 표면이다(§7).

### 5.8 Detail / editor — `app/globals.css:718-894` · `components/Editor.tsx`

- **목적/역할**: 3-pane의 3번째 pane, 페이지 상세/편집. 대응 와이어프레임: 1f·1g.
- **해부(구조)**: `.detail` → `.detail-inner` → `.detail-toolbar`(`.breadcrumb`(+`.crumb-title`+`.save-state`) + `.toolbar-actions`(삭제 btn-danger 하나)) → `.cover`(랜덤 고양이 커버, §5.14) → `.title-input` → `.doc-meta` → `.doc-divider` → `.content-input` → `.content-counter`.
- **핵심 수치/토큰**:

| 요소 | 값 |
|---|---|
| `.detail` | `flex:1`, `min-width:0`, `flex-direction:column`, `overflow-y:auto` |
| `.detail-inner` | `width:100%`, `max-width:760px`, `margin:0 auto`, `padding:22px 40px 80px` |
| `.detail-toolbar` | `justify-content:space-between`, `gap:10px`, `margin-bottom:30px` |
| `.breadcrumb` | `gap:6px`, `--text-xs`, `--text-tertiary` |
| `.breadcrumb .crumb-title` | `max-width:220px`, 말줄임, `color:--text-secondary` |
| `.save-state` | `--text-xs`, `--text-tertiary`, `white-space:nowrap`(`app/globals.css:759-763`) — 브레드크럼 끝의 저장 상태 표시 |
| `.save-state.err` | `color:--red-500`(#e5484d)(`app/globals.css:766-768`) — 저장 실패 변형. 사용자가 계속 타이핑하는 동안에도 눈에 띄어야 해 중립 회색 대신 danger 색을 쓴다 |
| `.toolbar-actions` | `gap:8px`, `flex:none` |
| `.title-input` | `width:100%`, `margin:0 0 10px`, `border:none`, `outline:none`, `background:transparent`, `font-size:--text-display`(34px), `font-weight:--fw-bold`, `letter-spacing:--ls-tight`(-0.02em), `line-height:--lh-tight`(1.2); placeholder `--text-disabled` |
| `.doc-meta` | `gap:6px`, `margin-bottom:22px`, `--text-xs`, `--text-tertiary` |
| `.doc-divider` | `height:1px`, `margin-bottom:22px`, `background:--border-subtle` |
| `.content-input` | `width:100%`, `min-height:340px`, `border:none`, `outline:none`, `resize:none`, `background:transparent`, `font-size:--text-base`(15px), `line-height:--lh-relaxed`(1.7); placeholder `--text-tertiary` |
| `.content-counter` | `position:sticky`, `bottom:16px`, `margin-left:auto`, `margin-top:12px`, `width:fit-content`, `padding:4px 10px`; `font-family:--font-mono`, `font-size:--text-2xs`, `color:--text-tertiary`, `background:--surface-card`, `border:1px solid --border-subtle`, `border-radius:--radius-pill`, `box-shadow:--shadow-xs` |

- **상태**: 이 섹션의 인풋들은 자체 focus 스타일 없이 `outline:none`(포커스 표시는 커서). 에디터가 열리면 항상 편집 가능하다 — `readOnly` 상태는 없다(읽기 전용의 유일한 근거였던 휴지통이 사라짐). 저장에 실패해도 입력을 막거나 되돌리지 않는다(§7).
- **저장 상태 표시(`.save-state`)**: 브레드크럼 꼬리에 `· {라벨}` 형태로 항상 붙는다. 라벨은 `SAVE_LABELS`(`Editor.tsx:19-23`)로 고정:

| `saveStatus` | 표시 | 스타일 | 접근성 |
|---|---|---|---|
| `saved` | `· 저장됨` | `.save-state`(`--text-tertiary`) | `role` 없음 |
| `saving` | `· 저장 중…` | `.save-state`(`--text-tertiary`) | `role` 없음 |
| `error` | `· 저장 안 됨` | `.save-state.err`(`--red-500`) | `role="alert"` |

- **React(`components/Editor.tsx`)**: props는 `page, navLabel, nickname, focusTitle, saveStatus, onPatch, onDelete` 7개(`Editor.tsx:9-17`). **커버**: 제목 입력창 바로 위에 `<CatCover key={`cover-${page.id}`} />` 렌더(`Editor.tsx:66`) — key 리마운트로 페이지 전환 시 새 랜덤 커버(§5.14). ※ 형제 `<input key={page.id}>`와의 key 충돌을 피하려고 `cover-` 접두사를 쓴다. **자동 높이 조절**: `useEffect`로 `page.id`·`content` 변할 때 textarea를 `height:auto → scrollHeight`로 grow(`Editor.tsx:37-42`). 브레드크럼: `{navLabel} › {제목|'제목 없음'}` + `.save-state`(`Editor.tsx:48-57`). 툴바: 삭제 `btn btn-danger`(`Trash2 size={14}`, 라벨 "삭제") **하나뿐**. 제목 placeholder "제목 없음", 내용 placeholder "여기에 내용을 입력하세요.". `.doc-meta` = `작성 {createdAt} · {nickname}`(수정 시각 없음 — 저장 시점은 `.save-state`가, 작성 시점은 `.doc-meta`가 맡는다). `autoFocus={focusTitle}`. **글자 수 카운터(`.content-counter`)**: `.content-input` 바로 뒤, `lib/format.ts`의 `charCount(text) = text.length`로 계산한 `{charCount(page.content)}자`를 무조건 렌더(제목 변경과 무관하게 항상 표시). `.detail`이 스크롤 컨테이너이므로 `position: sticky; bottom: 16px`가 편집 영역 하단에 고정되어 스크롤 중에도 항상 보인다.

### 5.9 Empty state — `app/globals.css:896-942` · `app/workspace/page.tsx:172-191`

- **목적/역할**: 페이지 미선택 시 상세 pane의 환영 화면. 대응 와이어프레임: 1b(환영).
- **해부**: `.empty` → `.empty-box` → `.empty-icon`(FileText) + `h2` + `p` + `.empty-chips`(추천 칩 3개).

| 요소 | 값 |
|---|---|
| `.empty` | `flex:1`, 중앙정렬, `padding:40px`, `text-align:center` |
| `.empty-box` | `max-width:360px` |
| `.empty-icon` | `52×52px`, `margin:0 auto 18px`, `border:1px solid --accent-soft-border`(#cdc9f6), `border-radius:14px`, `background:--accent-soft`(#f2f1fd), `color:--accent`(#6a5df0) |
| `.empty h2` | `margin:0 0 8px`, `font-size:--text-h2`(21px), `font-weight:--fw-bold`, `letter-spacing:--ls-tight`, `line-height:--lh-snug`(1.35) |
| `.empty p` | `margin:0 0 20px`, `--text-sm`, `--text-tertiary` |
| `.empty-chips` | `flex`, `flex-wrap:wrap`, `justify-content:center`, `gap:8px` |

- **React**: 아이콘 `FileText size={22}`. 헤드라인 `{nickname}님,<br/>무엇을 기록할까요?`. 본문 "왼쪽 페이지를 고르거나 '/page'로 새 페이지를 시작하세요.". 추천 칩 = `SUGGESTIONS = ['주간 업무 정리', '할 일 적기', '회의 메모']`(`app/workspace/page.tsx:12`), 클릭 시 그 텍스트를 제목으로 새 페이지 생성.

### 5.10 Login — `app/globals.css:944-1005` · `app/login/page.tsx`

- **목적/역할**: 중앙 카드형 로그인. 대응 와이어프레임: 1d.
- **해부**: `.login-page`(중앙정렬 컨테이너) → `.login-card`(`.login-logo` + `.login-title` + `.login-tagline` + `.btn btn-lg google-btn` + `.login-note`).

| 요소 | 값 |
|---|---|
| `.login-page` | 중앙정렬, `min-height:100dvh`, `background:--surface-sunken`(#f7f7f5) |
| `.login-card` | `width:360px`, `max-width:calc(100vw - 32px)`, `padding:40px 32px 32px`, `border:1px solid --border-subtle`, `border-radius:--radius-2xl`(20px), `background:--surface-card`, `box-shadow:--shadow-md`, `text-align:center` |
| `.login-logo` | `44×44px`, `margin:0 auto 14px`, `border-radius:--radius-lg`(12px), `background:--surface-inverse`(#1a1a17), `color:#fff`, `font-size:20px`, `font-weight:--fw-bold` |
| `.login-title` | `margin:0 0 6px`, `font-size:--text-h1`(26px), `--fw-bold`, `--ls-tight` |
| `.login-tagline` | `margin:0 0 28px`, `--text-sm`, `--text-tertiary` |
| `.login-note` | `margin:16px 0 0`, `--text-2xs`, `--text-tertiary` |
| `.login-error` | `margin:16px 0 0`, `--text-2xs`, `color:--red-500`(#e5484d) — Google 로그인 실패·취소 안내, `role="alert"` |
| `.google-btn` | `width:100%` |

- **React(`app/login/page.tsx`)**: 로고 "m", 제목 "mini notion", 태그라인 "개인 업무를, 내 방식대로.", 버튼 `GoogleLogo size={18}` + "Google 계정으로 계속하기"(진행 중이면 "Google로 이동 중…", `disabled={busy}`), 노트 "첫 로그인 시 자동으로 계정이 생성됩니다.". 클릭 시 `login()`이 Supabase `signInWithOAuth({ provider: 'google' })`로 실제 Google OAuth 리다이렉트(복귀 랜딩 `/login`, 로그인되면 기존 가드가 `/workspace`로 이동). 시작 실패·취소 시 `.login-error` 문구 표시.

### 5.11 Splash — `app/globals.css:1007-1014` · `app/page.tsx`

- **목적/역할**: 로딩/리다이렉트 대기 스플래시. 대응 React: `app/page.tsx`, 워크스페이스/마이페이지의 미준비 상태에서도 재사용(`app/workspace/page.tsx:52-58`, `app/me/page.tsx:41-47`).
- **해부**: `.splash`(중앙정렬, `min-height:100dvh`, `background:--surface-sunken`) 안에 `.login-logo`("m") 하나.
- **React(`app/page.tsx`)**: `ready`가 되면 `user ? '/workspace' : '/login'`으로 `router.replace`. 그동안 `<div className="splash"><span className="login-logo">m</span></div>` 표시.

### 5.12 Settings (my page) — `app/globals.css:1016-1143` · `app/me/page.tsx`

- **목적/역할**: 마이 페이지(프로필/계정 탭). 대응 와이어프레임: 1i.
- **해부**: 좌측 `.rail`(설정 내비: 프로필/계정 + "업무로 돌아가기") + 우측 `.settings-body`.
  - 프로필 탭: `.settings-title` + `.profile-row`(Avatar 78 + `.profile-row-actions` + `.hint`) + `.field-block`(`.section-label` + `.field`(input + `.counter`) + `.hint`) + `.hint`(연결된 계정) + `.save-row`(`btn btn-accent` + `.saved-note`/`.save-error`).
  - 계정 탭: `.account-row` × 2(이메일 / 연결된 계정 `.badge`) + `.danger-zone`(로그아웃 btn + 초기화 btn-danger).

| 요소 | 값 |
|---|---|
| `.settings-body` | `flex:1`, `min-width:0`, `overflow-y:auto`, `padding:34px 44px 80px` |
| `.settings-title` | `margin:0 0 26px`, `font-size:--text-h1`(26px), `--fw-bold`, `--ls-tight` |
| `.profile-row` | `gap:20px`, `margin-bottom:30px` |
| `.profile-row-actions` | `gap:8px` |
| `.hint` | `margin:6px 0 0`, `--text-xs`, `--text-tertiary` |
| `.field-block` | `margin-bottom:26px` |
| `.field` | `justify-content:space-between`, `gap:10px`, `width:340px`, `max-width:100%`, `padding:9px 12px`, `border:1px solid --border-default`, `border-radius:--radius-md`, `background:--surface-card` |
| `.field input` | `flex:1`, `border:none`, `outline:none`, `background:transparent`, `font-weight:--fw-semibold` |
| `.counter` | `flex:none`, `font-family:--font-mono`, `--text-2xs`, `--text-tertiary` |
| `.save-row` | `gap:12px` |
| `.saved-note` | `--text-xs`, `color:--green-500`(#35b37e) |
| `.save-error` | `--text-xs`, `color:--red-500`(#e5484d) |
| `.account-row` | `justify-content:space-between`, `gap:10px`, `width:420px`, `max-width:100%`, `padding:13px 2px`, `border-bottom:1px solid --border-subtle`, `--text-sm` |
| `.account-row .label` | `color:--text-tertiary` |
| `.account-row .value` | `font-weight:--fw-medium` |
| `.badge` | `padding:2px 8px`, `border-radius:--radius-sm`, `background:--accent-soft`, `color:--text-accent`, `--text-micro`, `--fw-semibold`, `--ls-wide` |
| `.danger-zone` | `gap:8px`, `margin-top:30px` |

- **상태**: `.field:focus-within` → `border-color:--accent`, `box-shadow:--shadow-focus`. 저장 버튼은 `disabled={!dirty || !valid || saving}`이고 저장 중에는 라벨이 "저장 중…"으로 바뀐다(`app/me/page.tsx`). 저장 실패 시 `.save-error`(role="alert")로 "저장하지 못했어요. 잠시 후 다시 시도해 주세요."를 노출.
- **React(`app/me/page.tsx`)**: 상수 `MAX_NICKNAME = 20`(`me/page.tsx:12`), `MAX_IMAGE_BYTES = 5 * 1024 * 1024`(5MB, `me/page.tsx:13`). 별명 input `maxLength={20}`, 카운터 표기 `#{nickname.length}/{MAX_NICKNAME}`(예: `#3/20`, `me/page.tsx:168-170`). 이미지 변경(`ImagePlus size={14}`)·제거(`X size={14}`, image 있을 때만), 힌트 "JPG · PNG · 5MB 이하". 계정 탭 뱃지 텍스트 "GOOGLE". 저장은 Supabase `public.profile` 행에 비동기 upsert(`lib/store.tsx`의 `updateUser`) — 성공 시 "저장되었습니다." 2초 노출, 실패 시 `.save-error` 문구 노출. 초기화는 `window.confirm('모든 페이지와 계정 정보를 삭제할까요? 되돌릴 수 없어요.', me/page.tsx:84`) 후 `resetAll()`(서버의 페이지 행 삭제 + 프로필 행을 Google 기본값으로 되돌리고 signOut, §8) → `/login`.

### 5.13 Responsive (light) — `app/globals.css:1145-1158`

- **목적/역할**: 좁은 화면(≤1024px)에서 3-pane 폭 축소. "(light)"는 가벼운 조정만 한다는 의도.
- **브레이크포인트**: `@media (max-width: 1024px)`.

| 셀렉터 | 기본값 | ≤1024px |
|---|---|---|
| `.rail` | `width:260px` | `width:220px` |
| `.listpane` | `width:320px` | `width:280px` |
| `.detail-inner` | `padding:22px 40px 80px` | `padding:22px 24px 60px` |

- **의도**: 레일·목록을 좁히고 상세 좌우 여백을 줄여 본문 폭 확보. 모바일 전용 재배치(스택/드로어)는 없음.

### 5.14 Cover (랜덤 고양이 커버) — `app/globals.css:777-830` · `components/CatCover.tsx`

- **목적/역할**: 에디터 제목 입력창 바로 위의 장식 커버. 매 진입 시 cataas 오픈 API(`https://cataas.com/cat/cute`)에서 새 랜덤 고양이 사진을 가져온다(비저장). 스펙: `specs/002-cat-cover-image/`.
- **해부(구조)**: `.cover`(고정 박스) → 상태에 따라 `.cover-skeleton`(로딩) / `.cover-img`(로드됨) / `.cover-fallback`(실패). 세 상태 모두 같은 박스를 차지해 레이아웃 시프트가 없다.
- **핵심 수치/토큰**:

| 요소 | 값 |
|---|---|
| `.cover` | `position:relative`, `width:100%`, `height:180px` 고정, `margin:0 0 18px`, `border-radius:--radius-lg`(12px), `overflow:hidden` |
| `.cover-skeleton` | `position:absolute; inset:0`, `background:--gray-100`, `cover-pulse` 키프레임(`--gray-100↔--gray-150` 배경 교차)을 `--dur-shimmer`(1400ms) 주기로 무한 반복; `prefers-reduced-motion: reduce`에서 `animation:none`(정적) |
| `.cover-img` | `display:block`, `width/height:100%`, `object-fit:cover`; `[hidden]`이면 `display:none`(로딩 중 가림) |
| `.cover-fallback` | flex 중앙정렬, `width/height:100%`, `border:1px solid --border-subtle`, `border-radius:--radius-lg`, `background:--gray-100`, `color:--text-disabled` |

- **상태**: `loading`(마운트 직후, 스켈레톤 + 이미지 hidden) → `load` 이벤트 → `loaded`(이미지 표시) / `error` 이벤트 → `error`(폴백: lucide `Cat` 22 아이콘, 오류 문구 없음). 회전 스피너는 어떤 상태에도 없다.
- **React(`components/CatCover.tsx`)**: props 없음. `useState` 초기화 함수로 마운트 시 1회 `?width=760&_={nonce}` 캐시버스터 URL 생성(리렌더에 불변 — cataas 응답에 캐시 헤더가 없어 nonce 없이는 브라우저 캐시가 같은 고양이를 재사용할 수 있음). `Editor`가 `key={`cover-${post.id}`}`로 렌더해 페이지 전환 시 리마운트(상태 초기화 + 늦은 응답의 경쟁 조건 차단). 접근성: 장식 요소로 `img alt=""`, 스켈레톤·폴백 `aria-hidden="true"`. testid: `cover-image`/`cover-skeleton`/`cover-fallback`.

---

## 6. 레이아웃 & 화면 (Layouts & Screens)

### 6.1 `/login` (와이어프레임 1d) — `app/login/page.tsx`

- **구조**: 전체 뷰포트 중앙(`.login-page`)에 360px 카드 1개. 로고 → 제목 → 태그라인 → Google 버튼(풀폭) → 안내 문구.
- **동작**: `ready && user`면 이미 로그인 → `/workspace`로 replace(`login/page.tsx:14-16`). 버튼 클릭 → `busy`(라벨 "Google로 이동 중…", `disabled`) → `login()`이 Supabase `signInWithOAuth`로 **실제 Google OAuth 리다이렉트**(`login/page.tsx:28-39`). 성공 시 브라우저가 Google로 떠나므로 `busy`를 유지한다. 시작에 실패하면 `busy`를 풀고 `.login-error` 노출. OAuth 취소·실패로 돌아오면 쿼리 또는 해시의 `error`를 읽어 안내를 띄우고 `history.replaceState`로 URL을 청소한다(`login/page.tsx:19-26`).
- **반응형**: 카드 `max-width:calc(100vw - 32px)`로 좁은 화면 대응.

### 6.2 `/workspace` 3-pane (와이어프레임 1a + 1b·1f·1g) — `app/workspace/page.tsx`

- **그리드/영역**: `flex` 3-pane — 레일(260px) · 리스트페인(320px) · 상세(flex:1). 높이 `100dvh`, 컨테이너 `overflow:hidden`, 각 pane 개별 스크롤.
- **좌측 레일(1a)**: 브랜드·검색·내비(**'전체 페이지' 1개**, 카운트 배지)·유저 푸터. 카운트는 `{ all: pages.length }`(`workspace/page.tsx:49`).
- **페이지 목록(1b)**: 상단 프롬프트 박스 → (`.list-notice`) → 섹션 라벨(`검색 결과 · n` 또는 `{내비라벨} · n`) → `pagesStatus`별 목록 상태(§5.7). `filterPages`가 검색만으로 목록을 만든다(`workspace/page.tsx:14-20`):
  - 기본: 스토어가 이미 `created_at` 내림차순으로 받아온 순서를 그대로 쓴다(클라이언트 재정렬 없음, `store.tsx:194`). 내비가 하나뿐이라 nav 분기가 없고, 개수 제한(slice)도 없다.
  - 검색어(`q`)는 제목/내용 소문자 포함 필터.
  - 섹션 라벨의 카운트는 로딩 중에도 렌더되지만, 이때 `pages`는 아직 빈 배열이라 `· 0`으로 보인다.
- **상세(1f·1g)**: 선택된 페이지가 있으면 `<Editor>`(제목 위에 랜덤 고양이 커버, §5.14), 없으면 빈 상태(커버 없음).
- **`/page` 슬래시 메뉴 흐름**: 프롬프트에 `/` 입력 → 포커스 상태면 슬래시 메뉴 open(`PromptBox.tsx:33`). `query`로 `SLASH_ITEMS` 필터(`key.startsWith(query)`). enabled 항목은 `page`뿐 → 하이라이트. Enter/전송/행 클릭 시 `page`면 빈 제목 새 페이지 생성. 슬래시 아닌 일반 텍스트 + Enter → 그 텍스트를 제목으로 생성(`PromptBox.tsx:41-48`).
- **이탈 처리(`leaveCurrent`, `workspace/page.tsx:61-65`)**: 다른 페이지를 고르거나 새로 만들기 직전에 항상 먼저 실행된다 — 대기 중인 저장을 `flushPending()`으로 밀어 넣고, 떠나는 페이지가 제목·내용 모두 비었으면 `discardIfEmpty()`로 정리한다(§7).
- **선택 동작(`handleSelect`, `workspace/page.tsx:67-71`)**: 같은 페이지면 아무것도 하지 않고, 아니면 `leaveCurrent()` 후 선택을 바꾼다.
- **생성 후 동작(`handleCreate`, `workspace/page.tsx:73-80`)**: `leaveCurrent()` → 검색 비우기 → `createPage(title)`. **생성에 실패하면(`id === null`) 선택을 바꾸지 않고** 그대로 머문다(실패 안내는 `.list-notice`가 맡는다). 성공 시 새 페이지를 선택하고, 제목 없이 만들었으면 `focusId`로 제목 입력에 자동 포커스. 내비가 하나뿐이라 nav 전환은 하지 않는다.
- **삭제 동작(`handleDelete`, `workspace/page.tsx:82-86`)**: `window.confirm('이 페이지를 삭제할까요? 되돌릴 수 없어요.')`로 확인 → 선택 중이었으면 먼저 선택 해제(빈 상태로) → `deletePage(id)`. 휴지통 경유·복원은 없다(§7).
- **반응형**: §5.13대로 ≤1024px에서 레일 220 / 리스트 280 / 상세 여백 축소.

### 6.3 빈 상태 (Empty) — `app/workspace/page.tsx:172-191`

- **상세 pane**(페이지 미선택 시): 아이콘 타일 + `{nickname}님, 무엇을 기록할까요?` + 안내 + 추천 칩 3개(클릭 시 해당 제목으로 즉시 새 페이지).
- **목록 pane**: `.list-empty`는 **`pagesStatus === 'ready'` 이고 목록이 실제로 비었을 때만** 렌더된다(`workspace/page.tsx:134-140`). 문구는 2가지뿐 — 검색 중이면 "검색 결과가 없어요.", 그 외 "아직 페이지가 없어요. /page로 시작해 보세요.". 내비별 분기 문구는 없다.
- **경계 규칙**: 불러오는 중(`loading`)에는 스켈레톤이, 실패(`error`)에는 `.list-error`가 이 자리를 대신한다. "아직 모른다"와 "못 불러왔다"를 빈 상태 문구로 덮지 않는 것이 이 화면의 핵심 규칙이다(§5.7).

### 6.4 `/me` 마이 페이지 (와이어프레임 1i) — `app/me/page.tsx`

- **구조**: `.workspace` 프레임 재사용 — 좌측 `.rail`(설정 내비: 프로필/계정 탭 + "업무로 돌아가기" 링크) + 우측 `.settings-body`.
- **프로필 탭**: 아바타(78) + 이미지 변경/제거 + 별명 필드(`#n/20` 카운터) + "연결된 계정 · Google" 힌트 + 저장 버튼(+저장 완료 노트).
- **계정 탭**: 이메일 행, 연결된 계정 뱃지(GOOGLE), danger-zone(로그아웃 / 모든 데이터 초기화).
- **동작**: 폼 초기값은 최초 1회만 사용자 정보에서 hydrate(`me/page.tsx:33-39`). `dirty`(변경됨) & `valid`(별명 비어있지 않음) & 저장 중이 아닐 때만 저장 가능. 저장은 Supabase `public.profile`에 upsert되어 다른 브라우저에서도 유지된다.

### 6.5 스플래시 (Splash) — `app/page.tsx`

- 루트 `/`는 스플래시("m" 로고)만 렌더하고 `ready` 시 로그인 여부로 리다이렉트. 워크스페이스/마이페이지도 미준비 시 동일 스플래시를 잠깐 보여준다.

### 6.6 layout (루트) — `app/layout.tsx`

- `<html lang="ko" className={pretendard.variable}>` → `<body>` → `<StoreProvider>`. 전역 폰트 변수·메타데이터·전역 스토어를 여기서 주입. 전 페이지 공통 프레임.

---

## 7. 인터랙션 & 모션 (Interaction & Motion)

**슬래시 명령 & 제목화** (`components/PromptBox.tsx`):
- `/` 시작 → 슬래시 메뉴. `page`만 활성(`enabled:true`), `todo`·`heading`은 "준비 중"(비활성).
- Enter: 슬래시면 하이라이트가 `page`일 때 빈 글 생성, 아니면 트림한 텍스트를 제목으로 생성. Escape는 입력 초기화(`PromptBox.tsx:65-67`). 생성 후 입력 blur.
- 전송 버튼 disabled 규칙: 슬래시면 `highlighted === null`, 일반 텍스트면 `value.trim() === ''`(`PromptBox.tsx:73`).

**자동 저장(디바운스 800ms)** (`lib/store.tsx`, `components/Editor.tsx`): 제목/내용 `onChange` → `updatePage`가 ① 화면을 즉시 갱신하고 ② 변경을 페이지별 대기열(`pendingRef`)에 병합한 뒤 ③ 페이지별 타이머를 재설정한다(`store.tsx:302-319`). 입력이 `SAVE_DEBOUNCE_MS = 800`(`store.tsx:56`) 동안 멈추면 그때 서버로 보낸다 — 타이핑을 끊지 않으면서 요청을 합칠 만큼 짧은 지연이다. 별도 저장 버튼은 없다.
- **순서 보장**: 같은 페이지에 저장이 겹치면 응답 순서가 뒤집혀 옛 값이 최종본이 될 수 있다. 그래서 페이지당 한 번에 하나만 전송하고(`inflightRef`), 전송 중 쌓인 변경은 끝난 뒤 같은 루프에서 이어 보낸다(`flushOne`, `store.tsx:251-272`).
- **상태 표시**: 전송 시작 → `saveStatus='saving'`(`· 저장 중…`), 성공 → `'saved'`(`· 저장됨`), 실패 → `'error'`(`· 저장 안 됨`, danger 색 + `role="alert"`). §5.8 참조.
- **실패해도 입력을 되돌리지 않는다**(`store.tsx:262-264`): 되돌리면 방금 쓴 글이 눈앞에서 사라진다. 화면은 사용자가 친 그대로 두고, 실패 사실만 `.save-state.err`로 알린다.

**이탈 시 밀어내기(flush) & 빈 페이지 자동 정리**:
- **flush**: 페이지를 떠나기 전 `flushPending()`이 모든 타이머를 취소하고 대기 중인 변경을 즉시 전송한다(`store.tsx:321-326`). 디바운스 800ms를 기다리다 잃는 변경이 없도록 하는 장치다.
- **자동 폐기**: 새로 만들고 제목·내용을 하나도 쓰지 않은 페이지는 이탈 시 조용히 삭제된다(`discardIfEmpty`, `store.tsx:364-371`). 빈 페이지가 서버에 쌓이지 않게 하려는 것이며, 제목이나 내용 중 하나라도 있으면 삭제하지 않는다. 이 삭제는 `.list-notice`를 띄우지 않는다(사용자가 의도한 삭제가 아니므로, `announce=false`).
- 두 동작은 `leaveCurrent()`에서 flush → discard 순으로 묶여 실행된다(`workspace/page.tsx:61-65`).

**낙관적 생성 & 롤백** (`createPage`, `store.tsx:274-300`): 서버 왕복을 기다리지 않도록 `crypto.randomUUID()`로 id를 클라이언트에서 만들고 목록 맨 앞에 즉시 넣어 편집기를 연다. insert가 성공하면 서버가 돌려준 행으로 교체한다 — `created_at`은 서버 값이 진실이므로 낙관적으로 쓴 클라이언트 시각을 버린다. 실패하면 방금 넣은 행을 목록에서 빼고 `.list-notice`에 "페이지를 만들지 못했어요. 잠시 후 다시 시도해 주세요."를 띄우며 `null`을 반환한다(호출자는 선택을 바꾸지 않는다, §6.2).

**낙관적 삭제 & 롤백** (`removePage`/`deletePage`, `store.tsx:330-361`): 화면에서 먼저 지우고 서버에 보낸다. 실패하면 **원래 인덱스 자리에** 되돌려 넣고(끝에 붙이면 사용자가 혼란스럽다) "페이지를 삭제하지 못했어요. 잠시 후 다시 시도해 주세요."를 `.list-notice`로 알린다. 삭제 확인(`window.confirm`)은 스토어가 아니라 호출자(UI)의 몫이다 — 스토어가 확인을 물으면 위의 `discardIfEmpty`가 확인 없이 지울 수 없게 되기 때문이다(`store.tsx:354-355`). 확인 모달이 유일한 안전장치이며, 휴지통·복원은 없다. 삭제 후 선택 해제 → 빈 상태(§6.3).

**호버/포커스 피드백**: 인터랙티브 표면은 hover 시 `--surface-hover`, 입력 컨테이너는 `:focus-within`에서 `--accent` 보더 + `--shadow-focus`(3px, #6a5df0 40%).

**스켈레톤 pulse** (`cover-pulse`, `app/globals.css:804-812`): 로딩 표현은 이 키프레임 **한 벌**뿐이며 두 곳이 공유한다 — 커버(`.cover-skeleton`, §5.14)와 목록(`.listrow-skeleton span`, §5.7). `--gray-100↔--gray-150` 배경을 `--dur-shimmer`(1400ms) 주기로 교차한다(스피너 금지). `prefers-reduced-motion: reduce`에서는 둘 다 애니메이션을 끄고 정적으로 표시한다(`app/globals.css:712-716, 814-818`).

**트랜지션 duration/ease 사용 규칙**: 코드에서 실제로 쓰이는 조합은 `--dur-fast`(120ms) + `--ease-standard`(`cubic-bezier(0.2, 0, 0.1, 1)`) 하나로 통일. 전이 속성은 컴포넌트별로 `background`/`border-color`/`color`/`box-shadow` 조합. (`--dur-base`, `--dur-slow`, `--ease-out`는 토큰으로 정의만 되고 CSS 사용처는 확인 불가.)

---

## 8. 데이터 모델 (Data Model, 디자인 영향분) — `lib/store.tsx`

페이지는 **Supabase `public.page` 테이블이 진실의 원천**이다. 스토어는 로그인 계정의 행을 `created_at` 내림차순으로 읽어 오고(`store.tsx:181-207`), 모든 쓰기는 서버로 간다. 브라우저 `localStorage`에는 Supabase 인증 세션만 남고 **페이지는 저장되지 않는다**.

**`User` 타입 필드 전량** (`store.tsx:16-20`):

| 필드 | 타입 | 디자인 영향 |
|---|---|---|
| `nickname` | `string` | 최대 20자(`MAX_NICKNAME`, `me/page.tsx:12`), `#n/20` 카운터, "{nickname}님" 표기 |
| `email` | `string` | 계정 탭 이메일 행 표시 |
| `image` | `string \| null` | 프로필 이미지(Google 사진 URL 또는 업로드 dataURL). null이면 아바타에 닉네임 첫 글자 |

**`Page` 타입 필드 전량** (`store.tsx:24-29`) — `public.page` 한 행에 대응하며 필드는 **4개뿐**이다. 코드·UI 모두 "페이지(Page)"로 통일되어 있다:

| 필드 | 타입 | 디자인 영향 |
|---|---|---|
| `id` | `string` | `crypto.randomUUID()`로 **클라이언트가** 생성(낙관적 생성, §7) |
| `title` | `string` | 비면 "제목 없음"(untitled 스타일). DB의 NULL은 경계에서 `''`로 정규화(`pageFromRow`, `store.tsx:106-113`) |
| `content` | `string` | 첫 줄이 리스트 스니펫, 에디터 자동 높이, 글자 수 카운터. NULL → `''` 정규화 |
| `createdAt` | `number` | 목록 정렬(서버가 내림차순 정렬)·리스트 메타·`.doc-meta`의 "작성 {시각}". 서버 `created_at`을 `Date.parse`한 값이 진실 |

즐겨찾기(`favorite`)·수정 시각(`updatedAt`)·삭제 표시(`deletedAt`) 칼럼은 없다. 저장 구조에 자리가 없으므로 별 표시·"수정 {시각}" 표기·최근 항목 정렬·휴지통(soft delete)은 화면에서도 성립하지 않는다(`store.tsx:22-23` 주석).

**상태 타입 2개** — 화면 분기의 근거 (`store.tsx:33-34`):

| 타입 | 값 | 디자인 영향 |
|---|---|---|
| `PagesStatus` | `'loading' \| 'ready' \| 'error'` | 목록 pane의 3분기(§5.7): 스켈레톤 / 목록·빈 상태 / `.list-error`. "비었다"·"아직 모른다"·"못 불러왔다"를 섞지 않기 위해 존재한다 |
| `SaveStatus` | `'saved' \| 'saving' \| 'error'` | 브레드크럼 `.save-state`의 3분기(§5.8): `· 저장됨` / `· 저장 중…` / `· 저장 안 됨` |

그 밖에 스토어는 `notice: string \| null`(+`dismissNotice`)를 노출하며, 이는 `.list-notice`의 표시 여부와 문구를 그대로 결정한다(`store.tsx:42-43`).

**디자인 제약으로 이어지는 값**:
- 별명 최대 20자 → `#n/20` 카운터(`me/page.tsx:168-170`).
- 프로필 이미지 5MB 이하(`MAX_IMAGE_BYTES = 5 * 1024 * 1024`) + `image/*`만. 초과 시 "5MB 이하 이미지만 업로드할 수 있어요." 알림(`me/page.tsx:52-65`).
- **시드 샘플 없음**: 첫 로그인 시 데모 글을 만들어 주는 시드는 더 이상 없다. 새 계정은 `public.page`에 행이 없으므로 **빈 목록(`.list-empty`) + 상세 빈 상태**로 시작한다 — 이 두 화면이 신규 사용자의 첫인상이다.
- **계정 전환/로그아웃**: 계정이 바뀌거나 로그아웃하면 이전 목록을 즉시 버리고(`setPages([])`) 다시 불러온다(`store.tsx:181-187`). 비로그인이면 `pagesStatus`를 바로 `'ready'`로 둬 스켈레톤이 남지 않게 한다.
- **소유자 필터**: 조회의 `.eq('user_id', uid)`는 명확성·전송량을 위한 것이지 보안 경계가 아니다 — RLS가 애초에 남의 행을 주지 않는다(`store.tsx:179-180` 주석).
- **사용자 파생**: Supabase 세션(Google 이름·이메일·사진)이 기본값, 그 위에 `public.profile` 행(`name`/`image`, auth.users와 1:1)을 병합(`store.tsx`의 `user` memo). 프로필 행은 최초 로그인 시 DB 트리거(`on_auth_user_created` → `handle_new_user()`)가 Display name·아바타로 생성하고, `/me` 저장 시 upsert로 덮어쓴다.
- **localStorage**: 앱이 직접 쓰는 키는 없다(Supabase 인증 세션만 남는다). 부팅 시 레거시 키 `mini-notion:user`·`mini-notion:posts`·`mini-notion:user-overlay:<uid>`를 **제거**한다(`store.tsx:134-140`). 특히 `mini-notion:posts`에 남아 있던 옛 글은 서버로 **옮기지 않고 버린다**(`store.tsx:62-64` 주석) — 마이그레이션 UI가 없는 것은 의도된 선택이다.
- **초기화(`resetAll`)**: 로컬만 비우면 재로그인 시 되살아나므로 서버의 `public.page` 행을 계정 단위로 삭제하고, 프로필 행을 Google 기본값으로 되돌린 뒤 대기 중인 저장·타이머를 모두 취소하고 signOut한다(`store.tsx:373-390`).

**`formatDate`** (`lib/format.ts`): `< 60s` → "방금", `< 1h` → "n분 전", `< 24h` → "n시간 전", 그 이상 → "M월 D일". 화면의 상대 시간 표기는 `.listrow-meta`(`workspace/page.tsx:155`)와 `.doc-meta`(`Editor.tsx:79`) 두 곳뿐이고, 둘 다 `createdAt`을 이 함수 하나로 포맷한다. 저장 시점은 시간이 아니라 `.save-state`의 상태 라벨로 표현한다(§5.8).

---

## 9. 에셋 & 아이콘 (Assets)

- **Pretendard Variable**: 로컬 폰트 `app/fonts/PretendardVariable.woff2`(루트에도 `PretendardVariable.woff2` 사본 존재). `next/font/local`로 로딩, weight 45~920, `display:swap`(`app/layout.tsx:6-11`). 라이선스/출처는 코드에서 명시 확인 불가(※ 코드에서 확인 불가 — Pretendard는 통상 OFL 배포).
- **Lucide 라인 아이콘**(`lucide-react`): 사용처와 크기 —
  - `Rail.tsx`: `Search`(14), `FileText`(15, 유일한 내비 '전체 페이지'), `Settings`(15).
  - `PromptBox.tsx`: `ArrowUp`(16, 전송), `FileText`·`CheckSquare`·`Heading1`(15, 슬래시 행).
  - `Editor.tsx`: `Trash2`(14, 삭제) — 툴바 아이콘은 이것 하나뿐.
  - `CatCover.tsx`: `Cat`(22, 커버 로드 실패 폴백).
  - `workspace/page.tsx`: `FileText`(22, empty), `X`(12, `.list-notice` 닫기).
  - `me/page.tsx`: `ArrowLeft`·`ImagePlus`·`LogOut`·`UserRound`·`X`(14~15).
- **GoogleLogo**(`components/GoogleLogo.tsx`): 브랜드 4색 SVG. `viewBox="0 0 48 48"`, 기본 `size=18`, `aria-hidden="true"`. 색상 원문: `#FFC107`, `#FF3D00`, `#4CAF50`, `#1976D2`. 로그인 버튼에 사용.
- **브랜드 마크**: 텍스트 "m"(brand-tile 26px, login-logo 44px, splash). 워드마크 "mini notion".
- **favicon**: `app/favicon.ico` 존재. `public/` 에 `file.svg`·`globe.svg`·`next.svg`·`vercel.svg`·`window.svg`(Next 기본 에셋, 앱 UI에서 직접 사용처 확인 불가).

---

## 10. 접근성 & 반응형 (Accessibility & Responsive)

**포커스 가시성**: 입력 컨테이너(`.rail-search`, `.promptbox-inner`, `.field`)는 `:focus-within`에서 `border-color:--accent` + `box-shadow:--shadow-focus`(= `0 0 0 3px` / `--focus-ring` = `color-mix(in srgb, --violet-500 40%, transparent)`). 텍스트 입력·에디터 인풋은 `outline:none`으로 브라우저 기본 아웃라인을 제거(포커스 표시는 커서/컨테이너 링에 의존).

**대비**: 본문 `--text-primary`(#2f2f2b) on `--white`(#ffffff)로 높은 대비. 3차 텍스트 `--text-tertiary`(#90908a)는 메타/플레이스홀더용 저대비(※ WCAG AA 정량 검증은 코드에 없음 — 확인 불가).

**시맨틱/보조 표기**: `<html lang="ko">`(`layout.tsx:24`). Avatar `img alt` 동적 생성. 전송 버튼 `aria-label="새 페이지 만들기"`. GoogleLogo `aria-hidden="true"`. 레일 푸터 `title="마이 페이지"`. 목록 로우는 중첩 액션이 사라져 `role`/`tabIndex` 보정 없이 네이티브 `<button>`으로 렌더된다(`workspace/page.tsx:144-156`).

**실패·상태 알림의 보조 표기**: 사용자가 놓치면 안 되는 실패는 모두 `role="alert"`로 알린다 — `.list-error`(불러오기 실패), `.list-notice`(낙관적 갱신 롤백), `.save-state.err`(저장 실패, `saveStatus==='error'`일 때만 `role`이 붙는다), `.login-error`, `.save-error`. 반대로 `.listrow-skeleton`은 `aria-hidden="true"`로 자리표시가 읽히지 않게 하고, `.list-notice`의 닫기 버튼은 `aria-label="알림 닫기"`를 갖는다. 색(danger red)에만 의존하지 않도록 문구가 항상 함께 제공된다.

**반응형(`Responsive (light)`, `app/globals.css:1145-1158`)**: 단일 브레이크포인트 `max-width: 1024px`. 변화 = 레일 260→220px, 리스트페인 320→280px, 상세 여백 `22px 40px 80px`→`22px 24px 60px`. 로그인 카드는 `max-width:calc(100vw - 32px)`로 별도 대응. 그 외 모바일 전용 레이아웃 전환은 없음.

---

## 11. 소스 매핑 (Source Map)

| 디자인 요소 | 소스 파일:라인 |
|---|---|
| 디자인 토큰 92개(`:root`) | `app/globals.css:7-118` |
| body 기본/타이포/selection | `app/globals.css:120-158` |
| Buttons | `app/globals.css:160-232` |
| Chip | `app/globals.css:234-253` |
| Avatar(CSS/React) | `app/globals.css:255-272` / `components/Avatar.tsx` |
| Sidebar rail(CSS/React) | `app/globals.css:274-424` / `components/Rail.tsx` |
| Workspace layout | `app/globals.css:426-442` / `app/workspace/page.tsx` |
| Prompt box + slash menu | `app/globals.css:444-567` / `components/PromptBox.tsx` |
| Page list(로딩·실패·알림 포함) | `app/globals.css:569-716` / `app/workspace/page.tsx:103-157` |
| Detail / editor | `app/globals.css:718-894` / `components/Editor.tsx` |
| 랜덤 고양이 커버 | `app/globals.css:777-830` / `components/CatCover.tsx` |
| Empty state | `app/globals.css:896-942` / `app/workspace/page.tsx:172-191` |
| Login | `app/globals.css:944-1005` / `app/login/page.tsx` |
| Splash | `app/globals.css:1007-1014` / `app/page.tsx` |
| Settings (my page) | `app/globals.css:1016-1143` / `app/me/page.tsx` |
| Responsive | `app/globals.css:1145-1158` |
| 폰트 로딩 | `app/layout.tsx:6-11` |
| 전역 프레임/Provider | `app/layout.tsx:18-30` |
| 상태·데이터 모델 | `lib/store.tsx` |
| 목록 스켈레톤 / 실패 / 알림 | `app/globals.css:644-716` / `app/workspace/page.tsx:106-132` |
| 저장 상태 표시 | `app/globals.css:759-768` / `components/Editor.tsx:19-23, 48-57` |
| 디바운스 저장·flush·빈 페이지 폐기 | `lib/store.tsx:56, 251-326, 364-371` |
| 낙관적 생성/삭제 + 롤백 | `lib/store.tsx:274-300, 330-361` |
| 스켈레톤 pulse 키프레임(공용) | `app/globals.css:804-812` |
| 상대 시간 포맷 | `lib/format.ts` |
| Google 로고 SVG | `components/GoogleLogo.tsx` |
| Nav 키/라벨/아이콘(1개) | `components/Rail.tsx:10-18` |
| 슬래시 아이템 | `components/PromptBox.tsx:6-10` |

---

## 12. 알려진 한계 (Known Limits) — 디자인/구현 영향분 (근거: `README.md:56-64`)

- **삭제는 되돌릴 수 없음**: 휴지통(soft delete)이 없어 삭제하면 즉시 사라진다. 디자인상 안전장치는 `window.confirm` 한 단계뿐이며, 실행 취소 UI는 없다.
- **옛 로컬 데이터는 이관하지 않음**: 페이지 저장소가 `localStorage`에서 Supabase `public.page`로 옮겨지면서, 브라우저에 남아 있던 `mini-notion:posts`는 부팅 시 **삭제만 하고 서버로 옮기지 않는다**(`store.tsx:62-64, 134-140`). 마이그레이션 안내 화면이 없는 것은 의도된 선택이며, 이전 사용자에게는 빈 목록으로 보인다.
- **네트워크 실패의 표면이 인라인 텍스트뿐**: 불러오기 실패는 `.list-error`, 저장 실패는 `.save-state.err`, 낙관적 갱신 롤백은 `.list-notice`로만 알린다. 재시도 버튼은 없고 안내 문구가 "새로고침해 주세요"로 사용자에게 미룬다.
- **미완성 슬래시 명령**: `할 일 목록`·`제목`은 "준비 중" 배지로 표시(비활성). 디자인상 자리만 확보.
- **동시 수정 충돌은 범위 밖**(`README.md:62-63`): 같은 페이지를 두 곳에서 고치면 나중에 저장된 내용이 최종본이 된다. 충돌을 알리는 UI는 없다 — `.save-state`는 "내 저장이 서버에 닿았는가"만 말한다.
- **페이지 공유·협업 없음**(`README.md:64`): 모든 페이지는 비공개이며, 공유·권한을 표현하는 컴포넌트가 존재하지 않는다.
- **정의만 되고 사용처 미확인 토큰**: `--gray-700/800`, `--blue-500/50`, `--green-50`, `--amber-500`, `--amber-50`, `--text-h3`, `--shadow-sm`, `--ease-out`, `--dur-base`, `--dur-slow` 등은 스케일 완결성을 위해 정의됐으나 현재 CSS에서 직접 참조 확인 불가(확장 대비 여유분). 이 중 `--amber-500`은 원래 즐겨찾기 별 색이었고, 기능이 사라진 뒤 토큰만 `:root`에 남았다.

---

## 자기 검증 체크리스트 (Self-Verification)

- [x] `:root`의 CSS 변수 개수와 문서 토큰 개수가 **일치**(코드 실측 92개 = 문서 14+8+8+7+6+3+5+23+18 = 92개). 기능이 사라져도 토큰은 지우지 않았고, 참조를 잃은 토큰은 "사용처 없음"으로 표기했다(§3.3의 `--amber-500`, §12).
- [x] `globals.css`의 컴포넌트 섹션 **13개** 모두 문서화(Buttons/Chip/Avatar/Sidebar rail/Workspace layout/Prompt box + slash menu/Page list/Detail·editor/Empty state/Login/Splash/Settings/Responsive). ※ CSS의 섹션 주석은 아직 `/* ---------- Post list ---------- */`(`app/globals.css:569`)이지만 내용은 페이지 목록이다.
- [x] React 컴포넌트 6개(Avatar/Editor/PromptBox/GoogleLogo/Rail/CatCover) 모두 언급.
- [x] 삭제된 기능(즐겨찾기·휴지통·수정 시각)의 잔재가 문서에 남아 있지 않음 — `.chip.on`·`.star`·`.trash-*` 스타일, `favorite`/`updatedAt`/`deletedAt` 필드, `favorites`/`recent`/`trash` 내비를 모두 걷어냈다. 참조를 잃은 `--amber-500`만 "사용처 없음"으로 남겼다.
- [x] 목록 pane의 세 상태(`loading`/`error`/`ready`)와 저장 상태 세 값(`saved`/`saving`/`error`)이 각각 어떤 클래스·문구로 나타나는지 §5.7·§5.8에 표로 고정.
- [x] 새로 문서화한 클래스가 실제 CSS에 존재함을 확인 — `.listrow-skeleton`/`.sk-title`/`.sk-snippet`/`.sk-meta`(`app/globals.css:681-716`), `.list-error`(646-651), `.list-notice`(654-676), `.save-state.err`(766-768).
- [x] 토큰은 **추가·삭제 없이 92개 유지**. 새 컴포넌트는 기존 토큰만 소비한다(`--radius-xs`가 `.listrow-skeleton span`으로 첫 사용처를 얻었고, `cover-pulse`·`--dur-shimmer`는 커버와 공유).
- [x] 화면 5개(login/workspace/me/splash/layout) 모두 문서화.
- [x] 별칭 토큰(`var(--…)`)이 최종 실제값까지 풀려 있음(Surfaces/Text/Borders/Accent roles 표의 "해석" 컬럼).
- [x] 모든 색상 값이 HEX 원문으로 노출됨.
- [x] 각 섹션에 근거 소스 경로 표기됨.
- [x] PRD·와이어프레임과의 대응(의도) 최소 1회 이상 연결됨(§2, §6, README 매핑 1a/1b/1d/1f/1g/1i).

### 유실 가능성이 있는 부분 (보고)

1. **Pretendard 라이선스/출처**: 코드에 라이선스 명시가 없어 문서엔 "통상 OFL"로만 부기(※ 확인 불가).
2. **사용처 미확인 토큰**: §12에 나열한 정의-only 토큰들은 "정의됨/사용처 확인 불가"로 표기. 향후 추가된 CSS에서 쓰일 여지가 있어 재확인 권장.
3. **대비 정량치(WCAG)**: 색 대비는 육안·값 기준으로만 기술, 수치 검증(대비비)은 코드 근거가 없어 생략.
4. **와이어프레임 세부 대응**: 번호(1a/1b/1d/1f/1g/1i)는 `README.md`의 매핑을 따랐고, `03-*.webp` 이미지의 픽셀 단위 대응은 개괄 수준(레일+프롬프트+카드 목록 구성 일치)까지만 확인.
