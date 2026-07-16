# DESIGN.md — mini notion 디자인 시스템 (코드 역추출, 무손실 지향)

> 이 문서는 이미 구현된 코드(= meta)에서 디자인 시스템을 **있는 그대로** 추출한 것입니다.
> 값(HEX·px·rem·ms·cubic-bezier·웨이트 등)은 코드 원문 그대로 옮겼으며, 토큰·컴포넌트·상태·화면을 빠짐없이 나열했습니다.
> 근거 소스 경로는 각 섹션에 `파일:라인` 형태로 표기했습니다.

---

## 1. 개요 (Overview)

**제품 한 줄 정의**: "mini notion — 개인 업무를, 내 방식대로." 구글 로그인(Supabase Auth) 후 글(페이지)을 만들고·수정하고·정리·삭제하는, 유료 구독 없는 1인용 미니 노션.
(근거: `app/layout.tsx:14` `title: 'mini notion — 개인 업무를, 내 방식대로'`, `app/login/page.tsx:31-32`, `02-prd.md:1-5`)

**이 문서의 목적/범위**: 코드가 사라져도 이 문서만으로 동일한 UI를 재현할 수 있도록, 디자인 토큰 91개·컴포넌트 13개·화면 5개·상태/변형/모션을 무손실로 보존한다. 범위는 **디자인/구현에 드러난 시각·인터랙션 시스템**이며, 서버/배포 아키텍처는 다루지 않는다.

**근거 소스 목록**:

| 영역 | 파일 |
|---|---|
| 디자인 토큰·컴포넌트 스타일 원천 | `app/globals.css` (1038줄, `:root` 토큰 + 컴포넌트 클래스 전체) |
| React 컴포넌트 | `components/Avatar.tsx`, `components/Editor.tsx`, `components/PromptBox.tsx`, `components/GoogleLogo.tsx`, `components/Rail.tsx` |
| 화면(페이지) | `app/layout.tsx`, `app/page.tsx`, `app/login/page.tsx`, `app/workspace/page.tsx`, `app/me/page.tsx` |
| 상태·데이터 모델 | `lib/store.tsx` (`User`·`Post` 타입, `StoreProvider`, `useStore`), `lib/format.ts` |
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
2. **단일 인디고-바이올렛 액센트 (`#6a5df0`)** — 강조는 오직 바이올렛 한 계열로 통일한다. `--accent: var(--violet-500)` = `#6a5df0`. 액티브 내비, 선택 목록, 즐겨찾기 칩 on, 포커스 링, 뱃지, 전송 버튼 모두 이 계열을 쓴다. (근거: `app/globals.css:30, 67`; `README.md:35`)
3. **헤어라인 보더 (hairline borders)** — 1px, 낮은 대비의 회색 보더로 면을 나눈다. `--border-subtle: var(--gray-150)` = `#e9e9e6`가 레일·리스트·구분선의 기본. (근거: `app/globals.css:62, 288, 589, 749`)
4. **부드러운 라운드 (soft radii)** — 4px~20px + pill(999px)의 라운드 스케일. 카드/모달은 큰 반경, 버튼/필드는 중간 반경. (근거: `app/globals.css:100-106`)
5. **위스퍼 섀도우 (whisper shadows)** — 그림자는 거의 보이지 않을 만큼 옅게. 가장 강한 `--shadow-lg`도 alpha 0.1이 최대. 잉크 색은 검정이 아니라 웜톤 `rgba(23,23,20,…)`. (근거: `app/globals.css:107-111`)
6. **Pretendard** — 한글 최적 가변 폰트를 로컬 woff2로 로딩. `--font-sans` 스택 최상단. (근거: `app/layout.tsx:6-11`; `app/globals.css:74-75`)
7. **Lucide 라인 아이콘** — 아이콘은 모두 `lucide-react`의 라인(stroke) 아이콘, 크기 11~22px. (근거: `components/Rail.tsx:4`, `components/Editor.tsx:4`, `components/PromptBox.tsx:4`, `app/me/page.tsx:6`, `app/workspace/page.tsx:5`)

**PRD/와이어프레임 대응(의도)**: PRD의 "단순함·무료·개인 맞춤화를 크게 높인다"(`02-prd.md:65`)는 가치 곡선이, 최소 팔레트(단일 액센트)·헤어라인·위스퍼 섀도우라는 절제된 비주얼로 번역되었다. 레퍼런스 와이어프레임(`03-1`, `03-2`)의 좌측 레일 + 프롬프트 박스 + 카드형 목록 구성이 그대로 구현에 대응된다.

---

## 3. 디자인 토큰 (Design Tokens)

`:root`의 CSS 변수 **총 100개 전량**. 카테고리 순서는 코드 주석 순서를 유지한다. 별칭(`var(--x)`) 토큰은 **최종 실제값**까지 풀어 적는다. 라이트 값은 `:root`, 다크 오버라이드는 `[data-theme='dark']` 블록(§3.10). (근거: `app/globals.css`)

### 3.1 Neutral scale (16개)

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
| `--gray-700` | `#52524d` | #52524d | (스케일 상 진한 회색) / 다크: strong 보더 |
| `--gray-750` | `#43433e` | #43433e | 다크: default 보더 (스케일 사이값, 다크모드 추가) |
| `--gray-800` | `#363632` | #363632 | (스케일 상 더 진한 회색) / 다크: active 표면·subtle 보더 |
| `--gray-850` | `#2c2c28` | #2c2c28 | 다크: hover 표면 (스케일 사이값, 다크모드 추가) |
| `--gray-900` | `#23231f` | #23231f | 그림자 잉크 베이스(rgb 23,23,20 근사) / 다크: 사이드바·카드 표면 |
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
| `--amber-500` | `#e8a33d` | #e8a33d | 즐겨찾기 별(`.star`) |
| `--amber-50` | `#fbf1df` | #fbf1df | (정의됨, 사용처 확인 불가) |
| `--red-500` | `#e5484d` | #e5484d | 위험 액션(삭제/danger 버튼·배너) |
| `--red-50` | `#fceceb` | #fceceb | danger hover 배경 / trash 배너 배경 |

### 3.4 Surfaces (8개)

| 토큰명 | 값(원문) | 해석(최종 실제값) | 용도/의미 |
|---|---|---|---|
| `--surface-page` | `var(--white)` | #ffffff | 페이지/리스트페인 바탕 |
| `--surface-sidebar` | `var(--gray-50)` | #f7f7f5 | 좌측 레일 배경 |
| `--surface-card` | `var(--white)` | #ffffff | 버튼/칩/카드/필드/모달 배경 |
| `--surface-sunken` | `var(--gray-50)` | #f7f7f5 | 로그인/스플래시 바탕 |
| `--surface-hover` | `var(--gray-100)` | #f0f0ee | hover 상태 배경 |
| `--surface-active` | `var(--gray-150)` | #e9e9e6 | active 상태 배경 |
| `--surface-inverse` | `var(--black)` | #1a1a17 | 브랜드 타일/로그인 로고 배경 |
| `--surface-disabled` | `var(--gray-200)` | #e3e3df | 비활성 컨트롤 배경(send disabled) (다크모드 추가) |

### 3.5 Text (7개)

| 토큰명 | 값(원문) | 해석(최종 실제값) | 용도/의미 |
|---|---|---|---|
| `--text-primary` | `#2f2f2b` | #2f2f2b | 본문·제목 기본 텍스트 |
| `--text-secondary` | `var(--gray-600)` | #6e6e68 | 보조 텍스트/내비 라벨 |
| `--text-tertiary` | `var(--gray-500)` | #90908a | 3차 텍스트(메타·플레이스홀더·카운트) |
| `--text-disabled` | `var(--gray-400)` | #b6b6af | 비활성 텍스트 |
| `--text-on-accent` | `var(--white)` | #ffffff | 액센트 배경 위 텍스트 |
| `--text-on-inverse` | `var(--white)` | #ffffff | inverse 표면 위 텍스트(브랜드 타일·로그인 로고) (다크모드 추가) |
| `--text-accent` | `var(--violet-600)` | #5b4fdb | 액센트 텍스트(액티브 내비·칩 on·뱃지) |

### 3.6 Borders (3개) — `app/globals.css:61-64`

| 토큰명 | 값(원문) | 해석(최종 실제값) | 용도/의미 |
|---|---|---|---|
| `--border-subtle` | `var(--gray-150)` | #e9e9e6 | 헤어라인 기본(레일·리스트로우·구분선) |
| `--border-default` | `var(--gray-200)` | #e3e3df | 버튼·칩·필드·프롬프트 보더 |
| `--border-strong` | `var(--gray-300)` | #d5d5d0 | 리스트로우 hover 보더 |

### 3.7 Accent roles (9개)

| 토큰명 | 값(원문) | 해석(최종 실제값) | 용도/의미 |
|---|---|---|---|
| `--accent` | `var(--violet-500)` | #6a5df0 | 주 강조색(버튼·전송·포커스 보더) |
| `--accent-hover` | `var(--violet-600)` | #5b4fdb | 강조 hover |
| `--accent-soft` | `var(--violet-50)` | #f2f1fd | 연한 강조 배경(액티브 내비·선택 로우·칩 on·뱃지·empty 아이콘) |
| `--accent-soft-border` | `var(--violet-200)` | #cdc9f6 | 연한 강조 보더(칩 on·empty 아이콘) |
| `--focus-ring` | `color-mix(in srgb, var(--violet-500) 40%, transparent)` | #6a5df0 40% 알파(위에 transparent 혼합) | 포커스 링 색(그림자로 사용) |
| `--selection-bg` | `var(--violet-100)` | #e6e4fb | `::selection` 배경 (다크모드 추가) |
| `--avatar-bg` | `var(--violet-100)` | #e6e4fb | 아바타 배경 (다크모드 추가) |
| `--avatar-text` | `var(--violet-700)` | #4a40b5 | 아바타 이니셜 텍스트 (다크모드 추가) |
| `--danger-soft` | `var(--red-50)` | #fceceb | 위험 연한 배경(danger hover·trash 배너) (다크모드 추가) |

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
| `--text-micro` | `11px` | 11px | 섹션 라벨·뱃지·"준비 중"·별 아이콘 |
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
| `--radius-xs` | `4px` | 4px | (스케일 최소) |
| `--radius-sm` | `6px` | 6px | trash 액션 버튼·뱃지·계정 뱃지 |
| `--radius-md` | `8px` | 8px | 버튼·칩 rowselect·필드·검색·내비·브랜드 타일 |
| `--radius-lg` | `12px` | 12px | btn-lg·리스트로우·슬래시메뉴·trash 배너·로그인 로고 |
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
| `--dur-shimmer` | `1400ms` | 1400ms | 커버 스켈레톤 pulse 주기(`.cover-skeleton`, §5.14) |

> **토큰 합계 검증**: Neutral 16 + Accent 8 + Semantic 8 + Surfaces 8 + Text 7 + Borders 3 + Accent roles 9 + Typography 23 + Radius/elevation/motion 18 = **100개** (코드 `:root` 실측치 100과 일치. 다크모드 기능에서 8개 추가 — 원시 2: `--gray-750`·`--gray-850`, 시맨틱 6: `--surface-disabled`·`--text-on-inverse`·`--selection-bg`·`--avatar-bg`·`--avatar-text`·`--danger-soft`).

### 3.10 다크 테마 오버라이드 — `[data-theme='dark']`

**원칙**: 시맨틱 계층만 재정의하고 원시 팔레트(gray/violet/hue 스케일)는 불변. 컴포넌트 CSS는 토큰만 참조하므로 이 블록 하나로 전 화면이 전환된다. `<html data-theme>`는 루트 레이아웃의 인라인 스크립트가 첫 페인트 전에 설정(§6.6). `color-scheme`도 테마별로 선언(`:root`=light, 다크 블록=dark)해 네이티브 컨트롤·스크롤바가 테마를 따른다.

| 토큰 | 다크 값(원문) | 해석 | 대비(대표 조합, WCAG) |
|---|---|---|---|
| `--surface-page` / `--surface-sunken` | `var(--black)` | #1a1a17 | — |
| `--surface-sidebar` / `--surface-card` | `var(--gray-900)` | #23231f | — |
| `--surface-hover` | `var(--gray-850)` | #2c2c28 | — |
| `--surface-active` / `--surface-disabled` / `--border-subtle` | `var(--gray-800)` | #363632 | — |
| `--surface-inverse` | `var(--gray-100)` | #f0f0ee | 반전: 밝은 타일 |
| `--text-primary` | `var(--gray-100)` | #f0f0ee | 15.28:1 on page, 13.82:1 on card ✓ |
| `--text-secondary` | `var(--gray-400)` | #b6b6af | 8.55:1 on page ✓ |
| `--text-tertiary` | `var(--gray-500)` | #90908a | 5.43:1 on page ✓ (hover 표면 위 4.37:1 — 메타 전용 역할, 라이트의 동일 조합 2.76:1 대비 개선) |
| `--text-disabled` | `var(--gray-600)` | #6e6e68 | 비활성(WCAG 예외 대상) |
| `--text-on-inverse` | `var(--black)` | #1a1a17 | 15.28:1 on inverse ✓ |
| `--text-accent` | `var(--violet-300)` | #ada6ef | 7.87:1 on page, 6.11:1 on accent-soft ✓ |
| `--border-default` | `var(--gray-750)` | #43433e | (보더 — 라이트와 동일하게 저대비 헤어라인 정책) |
| `--border-strong` | `var(--gray-700)` | #52524d | — |
| `--accent-hover` | `var(--violet-400)` | #8a80e6 | 다크에선 밝은 쪽으로 hover |
| `--accent-soft` | `color-mix(in srgb, var(--violet-500) 16%, var(--gray-900))` | ≈#2e2c40 | — |
| `--accent-soft-border` | `color-mix(in srgb, var(--violet-500) 38%, var(--gray-900))` | ≈#3e3868 | — |
| `--selection-bg` | `var(--violet-700)` | #4a40b5 | 6.84:1 (text-primary 위) ✓ |
| `--avatar-bg` | `color-mix(in srgb, var(--violet-500) 25%, var(--gray-900))` | ≈#353253 | — |
| `--avatar-text` | `var(--violet-200)` | #cdc9f6 | 7.67:1 on avatar-bg ✓ |
| `--danger-soft` | `color-mix(in srgb, var(--red-500) 14%, var(--gray-900))` | ≈#3e2825 | red-500 텍스트 3.50:1(큰 UI 기준) ✓ |
| `--shadow-xs/sm/md/lg` | 잉크 `rgba(0,0,0, .3–.55)` | 라이트보다 진한 잉크 | — |

**다크에서 재정의하지 않는 것(의도)**: `--accent`(#6a5df0, page 위 3.68:1 — UI 3:1 ✓)·`--text-on-accent`(white on accent 4.73:1 ✓)·`--focus-ring`·의미색 `--amber-500`(8.09:1)·`--green-500`(6.56:1)·`--red-500`(4.46:1)·리스트 선택 보더 `--violet-300` — 중간 명도라 두 테마 모두 성립. `GoogleLogo.tsx`의 구글 브랜드색 4개도 테마와 무관하게 원본 유지.

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
| `--text-micro` | 11px | 섹션 라벨·뱃지·"준비 중"·별 아이콘 |

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

### 5.1 Buttons — `app/globals.css:159-231`

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

### 5.2 Chip — `app/globals.css:233-258`

- **목적/역할**: 토글형/추천형 캡슐. 사용처: 에디터 즐겨찾기 토글(`components/Editor.tsx:56`), 빈 상태 추천 칩(`app/workspace/page.tsx:227`). 와이어프레임: 1f(즐겨찾기), 1b(추천).
- **해부**: `inline-flex`, `gap:6px`, `padding:6px 14px`, `border:1px solid --border-default`, `border-radius:--radius-pill`(999px), `background:--surface-card`, `color:--text-secondary`(#6e6e68), `font-size:--text-sm`.
- **변형/상태**:

| 상태 | 셀렉터 | 변화 |
|---|---|---|
| hover(버튼 칩) | `button.chip:hover` | `background:--surface-hover` (#f0f0ee) |
| on(켜짐) | `.chip.on` | `border-color:--accent-soft-border`(#cdc9f6), `background:--accent-soft`(#f2f1fd), `color:--text-accent`(#5b4fdb) |

- **트랜지션**: `background`, `border-color`, `color` × `--dur-fast` `--ease-standard`.

### 5.3 Avatar — `app/globals.css:260-277` · `components/Avatar.tsx`

- **목적/역할**: 사용자 프로필 원형 아바타. 이미지 있으면 이미지, 없으면 닉네임 첫 글자(없으면 `?`).
- **해부(CSS)**: `inline-flex` 중앙정렬, `flex:none`, `border-radius:50%`, `background:--violet-100`(#e6e4fb), `color:--violet-700`(#4a40b5), `font-weight:--fw-semibold`, `overflow:hidden`. 내부 `img`는 `width/height:100%`, `object-fit:cover`.
- **해부(React, `components/Avatar.tsx:3-16`)**: props `{ user: User; size: number }`. 인라인 스타일로 `width:size`, `height:size`, `fontSize: Math.round(size * 0.42)`. 즉 폰트 크기는 지름의 42%.
  - 이미지 분기: `user.image ? <img src alt={`${nickname} 프로필 이미지`}/> : (user.nickname.charAt(0) || '?')`.
- **사용된 size**: 레일 푸터 30(`Rail.tsx:71`), 마이페이지 프로필 78(`me/page.tsx:119`).
- **상태**: 별도 hover/focus 없음(정적).

### 5.4 Sidebar rail — `app/globals.css:279-429` · `components/Rail.tsx`

- **목적/역할**: 좌측 3-pane의 1번째 pane. 브랜드·검색·내비게이션·유저 푸터. 대응 와이어프레임: 1a.
- **해부(구조 계층)**: `.rail` → `.brand`(`.brand-tile` + `.brand-name`) → `.rail-search`(아이콘 + input) → `.section-label` → `.navitem` × N(아이콘 + 라벨 + `.count`) → `.rail-spacer` → `ThemeToggle`(§5.15) → `.rail-footer`(Avatar + `.rail-username` + `.gear`).
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

- **React(`components/Rail.tsx`)**: `NavKey = 'all' | 'favorites' | 'recent' | 'trash'`. `NAV_LABELS = {all:'전체 글', favorites:'즐겨찾기', recent:'최근 항목', trash:'휴지통'}`(`Rail.tsx:10-15`). `NAV_ICONS = {all:FileText, favorites:Star, recent:Clock, trash:Trash2}`(`Rail.tsx:17-22`, Lucide, size 15). 검색 아이콘 `Search size={14}`. 푸터는 `/me`로 가는 `<Link>`, `title="마이 페이지"`, Avatar size 30, `Settings size={15}`.

### 5.5 Workspace layout — `app/globals.css:431-447`

- **목적/역할**: 업무 페이지 3-pane 레이아웃 컨테이너. 대응 와이어프레임: 1a+1b. React: `app/workspace/page.tsx`(`<main className="workspace">`).
- **해부**: `.workspace`(flex 컨테이너) → `.rail`(260px) + `.listpane`(320px) + `.detail`(flex:1).

| 요소 | 값 |
|---|---|
| `.workspace` | `display:flex`, `height:100dvh`, `overflow:hidden` |
| `.listpane` | `width:320px`, `flex:none`, `flex-direction:column`, `padding:16px 14px`, `overflow-y:auto`, `border-right:1px solid --border-subtle`, `background:--surface-page` |

- **주의**: `.detail`은 §5.8에 정의. `/me` 페이지도 `.workspace` + `.rail` 구조를 재사용하되 우측을 `.settings-body`로 바꾼다(`app/me/page.tsx:82-83`).

### 5.6 Prompt box + slash menu — `app/globals.css:449-572` · `components/PromptBox.tsx`

- **목적/역할**: 목록 상단의 새 글 생성 입력창 + 슬래시 명령 팝오버. 노션식 `/page` 명령. 대응 와이어프레임: 1b.
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

- **React(`components/PromptBox.tsx`)**: `SLASH_ITEMS`(`PromptBox.tsx:6-10`) = `page`(라벨 "page — 새 글", 아이콘 `FileText`, enabled:true), `todo`(라벨 "할 일 목록", `CheckSquare`, enabled:false), `heading`(라벨 "제목", `Heading1`, enabled:false). placeholder `"'/page' 입력해 새 글…"`. `.send` 아이콘 `ArrowUp size={16}`, `aria-label="새 글 만들기"`. 슬래시 행 아이콘 `size={15}`. 슬래시 라벨 "기본 블록", 빈 결과 "일치하는 명령이 없어요.", disabled 배지 "준비 중".

### 5.7 Post list — `app/globals.css:574-664` · `app/workspace/page.tsx`

- **목적/역할**: 리스트페인 안의 글 카드 목록. 대응 와이어프레임: 1b.
- **해부(구조)**: `.list-section-label`(섹션 카운트) → `.listrow` × N(각: `.listrow-title` + `.listrow-snippet` + `.listrow-meta`(별 + 날짜) + 휴지통일 때 `.trash-row-actions`) / 비었으면 `.list-empty`.
- **핵심 수치/토큰**:

| 요소 | 값 |
|---|---|
| `.list-section-label` | `padding:4px 2px 8px`, `--text-micro`, `--fw-semibold`, `--ls-wide`, `--text-tertiary`, `flex:none` |
| `.listrow` | `display:block`, `width:100%`, `margin-bottom:8px`, `padding:10px 12px`, `border:1px solid --border-subtle`, `border-radius:--radius-lg`(12px), `background:--surface-card`, `text-align:left` |
| `.listrow-title` | `--text-sm`, `--fw-semibold`, 말줄임 |
| `.listrow-title.untitled` | `color:--text-tertiary`, `font-weight:--fw-medium` |
| `.listrow-snippet` | `margin-top:2px`, `--text-xs`, `--text-tertiary`, 말줄임 |
| `.listrow-meta` | `gap:6px`, `margin-top:7px`, `--text-2xs`, `--text-tertiary` |
| `.listrow-meta .star` | `color:--amber-500`(#e8a33d), `inline-flex` |
| `.list-empty` | `padding:24px 8px`, `--text-xs`, `--text-tertiary`, `text-align:center` |
| `.trash-row-actions` | `gap:6px`, `margin-top:9px` |
| `.trash-row-actions .btn` | `padding:4px 10px`, `--text-2xs`, `border-radius:--radius-sm`(6px) |

- **상태(state)**:

| 상태 | 셀렉터 | 변화 |
|---|---|---|
| hover | `.listrow:hover` | `border-color:--border-strong`(#d5d5d0), `box-shadow:--shadow-xs` |
| 선택됨 | `.listrow.sel` | `border-color:--violet-300`(#ada6ef), `background:--accent-soft`(#f2f1fd) |

- **트랜지션**: `border-color`, `background`, `box-shadow` × `--dur-fast` `--ease-standard`.
- **React 표시 규칙(`app/workspace/page.tsx:136-191`)**: 제목 없으면 "제목 없음" + `untitled`. 스니펫은 `content.split('\n')[0]`. 메타 별은 `favorite && nav!=='trash'`일 때 `Star size={11}` fill. 날짜는 nav별: trash → `삭제 {formatDate(deletedAt)}`, recent → `수정 {formatDate(updatedAt)}`, 그 외 → `formatDate(createdAt)`. 휴지통 nav일 때 각 로우에 복원(`RotateCcw size={12}`)·영구 삭제(`X size={12}`) 액션.

### 5.8 Detail / editor — `app/globals.css:666-785` · `components/Editor.tsx`

- **목적/역할**: 3-pane의 3번째 pane, 글 상세/편집. 대응 와이어프레임: 1f·1g.
- **해부(구조)**: `.detail` → `.detail-inner` → `.detail-toolbar`(`.breadcrumb`(+`.crumb-title`+`.save-state`) + `.toolbar-actions`(즐겨찾기 칩 + 삭제 btn-danger)) → (휴지통이면 `.trash-banner`) → `.cover`(랜덤 고양이 커버, §5.14) → `.title-input` → `.doc-meta` → `.doc-divider` → `.content-input` → `.content-counter`.
- **핵심 수치/토큰**:

| 요소 | 값 |
|---|---|
| `.detail` | `flex:1`, `min-width:0`, `flex-direction:column`, `overflow-y:auto` |
| `.detail-inner` | `width:100%`, `max-width:760px`, `margin:0 auto`, `padding:22px 40px 80px` |
| `.detail-toolbar` | `justify-content:space-between`, `gap:10px`, `margin-bottom:30px` |
| `.breadcrumb` | `gap:6px`, `--text-xs`, `--text-tertiary` |
| `.breadcrumb .crumb-title` | `max-width:220px`, 말줄임, `color:--text-secondary` |
| `.save-state` | `--text-xs`, `--text-tertiary`, `white-space:nowrap` |
| `.toolbar-actions` | `gap:8px`, `flex:none` |
| `.title-input` | `width:100%`, `margin:0 0 10px`, `border:none`, `outline:none`, `background:transparent`, `font-size:--text-display`(34px), `font-weight:--fw-bold`, `letter-spacing:--ls-tight`(-0.02em), `line-height:--lh-tight`(1.2); placeholder `--text-disabled` |
| `.doc-meta` | `gap:6px`, `margin-bottom:22px`, `--text-xs`, `--text-tertiary` |
| `.doc-divider` | `height:1px`, `margin-bottom:22px`, `background:--border-subtle` |
| `.content-input` | `width:100%`, `min-height:340px`, `border:none`, `outline:none`, `resize:none`, `background:transparent`, `font-size:--text-base`(15px), `line-height:--lh-relaxed`(1.7); placeholder `--text-tertiary` |
| `.content-counter` | `position:sticky`, `bottom:16px`, `margin-left:auto`, `margin-top:12px`, `width:fit-content`, `padding:4px 10px`; `font-family:--font-mono`, `font-size:--text-2xs`, `color:--text-tertiary`, `background:--surface-card`, `border:1px solid --border-subtle`, `border-radius:--radius-pill`, `box-shadow:--shadow-xs` |
| `.trash-banner` | `justify-content:space-between`, `gap:10px`, `margin-bottom:26px`, `padding:10px 14px`, `border:1px solid color-mix(in srgb, --red-500 25%, transparent)`(#e5484d 25%), `border-radius:--radius-lg`, `background:--red-50`(#fceceb), `--text-sm`, `color:--red-500` |
| `.trash-banner-actions` | `gap:6px` |

- **상태**: 이 섹션의 인풋들은 자체 focus 스타일 없이 `outline:none`(포커스 표시는 커서). 휴지통 상태에서 `.title-input`/`.content-input`은 `readOnly`(`Editor.tsx:99, 115`).
- **React(`components/Editor.tsx`)**: props에 `post, navLabel, nickname, focusTitle, onPatch, onToggleFavorite, onTrash, onRestore, onDeleteForever`. `inTrash = post.deletedAt !== null`. **커버**: 제목 입력창 바로 위에 `<CatCover key={`cover-${post.id}`} />` 렌더(`Editor.tsx:90`) — key 리마운트로 글 전환 시 새 랜덤 커버, 휴지통 글에서도 표시(§5.14). ※ 형제 `<input key={post.id}>`와의 key 충돌을 피하려고 `cover-` 접두사를 쓴다. **자동 높이 조절**: `useEffect`로 `content` 변할 때 textarea를 `height:auto → scrollHeight`로 grow(`Editor.tsx:36-41`). 브레드크럼: `{navLabel} › {제목|'제목 없음'}` + (비휴지통) `· 저장됨 {formatDate(updatedAt)}`. 툴바(비휴지통): 즐겨찾기 칩(`Star size={14}`, on이면 `fill="currentColor"`) + 삭제 `btn btn-danger`(`Trash2 size={14}`). 휴지통 배너: 문구 + 복원(`RotateCcw size={14}`)·영구 삭제(`X size={14}`). 제목 placeholder "제목 없음", 내용 placeholder "여기에 내용을 입력하세요.". `.doc-meta` = `작성 {createdAt} · 수정 {updatedAt} · {nickname}`. `autoFocus={focusTitle && !inTrash}`. **글자 수 카운터(`.content-counter`)**: `.content-input` 바로 뒤, `lib/format.ts`의 `charCount(text) = text.length`로 계산한 `{charCount(post.content)}자`를 무조건 렌더(제목 변경·휴지통 상태와 무관, `readOnly` 여부와 무관하게 항상 표시). `.detail`이 스크롤 컨테이너이므로 `position: sticky; bottom: 16px`가 편집 영역 하단에 고정되어 스크롤 중에도 항상 보인다.

### 5.9 Empty state — `app/globals.css:787-833` · `app/workspace/page.tsx:212-235`

- **목적/역할**: 글 미선택 시 상세 pane의 환영 화면. 대응 와이어프레임: 1b(환영).
- **해부**: `.empty` → `.empty-box` → `.empty-icon`(FileText) + `h2` + `p` + `.empty-chips`(추천 칩 3개).

| 요소 | 값 |
|---|---|
| `.empty` | `flex:1`, 중앙정렬, `padding:40px`, `text-align:center` |
| `.empty-box` | `max-width:360px` |
| `.empty-icon` | `52×52px`, `margin:0 auto 18px`, `border:1px solid --accent-soft-border`(#cdc9f6), `border-radius:14px`, `background:--accent-soft`(#f2f1fd), `color:--accent`(#6a5df0) |
| `.empty h2` | `margin:0 0 8px`, `font-size:--text-h2`(21px), `font-weight:--fw-bold`, `letter-spacing:--ls-tight`, `line-height:--lh-snug`(1.35) |
| `.empty p` | `margin:0 0 20px`, `--text-sm`, `--text-tertiary` |
| `.empty-chips` | `flex`, `flex-wrap:wrap`, `justify-content:center`, `gap:8px` |

- **React**: 아이콘 `FileText size={22}`. 헤드라인 `{nickname}님,<br/>무엇을 기록할까요?`. 본문 "왼쪽 글을 고르거나 '/page'로 새 글을 시작하세요.". 추천 칩 = `SUGGESTIONS = ['주간 업무 정리', '할 일 적기', '회의 메모']`(`app/workspace/page.tsx:12`), 클릭 시 그 텍스트를 제목으로 새 글 생성.

### 5.10 Login — `app/globals.css:835-890` · `app/login/page.tsx`

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

### 5.11 Splash — `app/globals.css:892-899` · `app/page.tsx`

- **목적/역할**: 로딩/리다이렉트 대기 스플래시. 대응 React: `app/page.tsx`, 워크스페이스/마이페이지의 미준비 상태에서도 재사용(`app/workspace/page.tsx:85-91`, `app/me/page.tsx:39-45`).
- **해부**: `.splash`(중앙정렬, `min-height:100dvh`, `background:--surface-sunken`) 안에 `.login-logo`("m") 하나.
- **React(`app/page.tsx`)**: `ready`가 되면 `user ? '/workspace' : '/login'`으로 `router.replace`. 그동안 `<div className="splash"><span className="login-logo">m</span></div>` 표시.

### 5.12 Settings (my page) — `app/globals.css:901-1023` · `app/me/page.tsx`

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
- **React(`app/me/page.tsx`)**: 상수 `MAX_NICKNAME = 20`(`me/page.tsx:12`), `MAX_IMAGE_BYTES = 5 * 1024 * 1024`(5MB, `me/page.tsx:13`). 별명 input `maxLength={20}`, 카운터 표기 `#{nickname.length}/{MAX_NICKNAME}`(예: `#3/20`). 이미지 변경(`ImagePlus size={14}`)·제거(`X size={14}`, image 있을 때만), 힌트 "JPG · PNG · 5MB 이하". 계정 탭 뱃지 텍스트 "GOOGLE". 저장은 Supabase `public.profile` 행에 비동기 upsert(`lib/store.tsx`의 `updateUser`) — 성공 시 "저장되었습니다." 2초 노출, 실패 시 `.save-error` 문구 노출. 초기화는 `window.confirm` 후 `resetAll()`(프로필 행을 Google 기본값으로 되돌리고 signOut) → `/login`.

### 5.13 Responsive (light) — `app/globals.css:1025-1038`

- **목적/역할**: 좁은 화면(≤1024px)에서 3-pane 폭 축소. "(light)"는 가벼운 조정만 한다는 의도.
- **브레이크포인트**: `@media (max-width: 1024px)`.

| 셀렉터 | 기본값 | ≤1024px |
|---|---|---|
| `.rail` | `width:260px` | `width:220px` |
| `.listpane` | `width:320px` | `width:280px` |
| `.detail-inner` | `padding:22px 40px 80px` | `padding:22px 24px 60px` |

- **의도**: 레일·목록을 좁히고 상세 좌우 여백을 줄여 본문 폭 확보. 모바일 전용 재배치(스택/드로어)는 없음.

### 5.14 Cover (랜덤 고양이 커버) — `app/globals.css:721-774` · `components/CatCover.tsx`

- **목적/역할**: 에디터 제목 입력창 바로 위의 장식 커버. 매 진입 시 cataas 오픈 API(`https://cataas.com/cat/cute`)에서 새 랜덤 고양이 사진을 가져온다(비저장). 스펙: `specs/002-cat-cover-image/`.
- **해부(구조)**: `.cover`(고정 박스) → 상태에 따라 `.cover-skeleton`(로딩) / `.cover-img`(로드됨) / `.cover-fallback`(실패). 세 상태 모두 같은 박스를 차지해 레이아웃 시프트가 없다.
- **핵심 수치/토큰**:

| 요소 | 값 |
|---|---|
| `.cover` | `position:relative`, `width:100%`, `height:180px` 고정, `margin:0 0 18px`, `border-radius:--radius-lg`(12px), `overflow:hidden` |
| `.cover-skeleton` | `position:absolute; inset:0`, `background:--surface-hover`, `cover-pulse` 키프레임(`--surface-hover↔--surface-active` 배경 교차)을 `--dur-shimmer`(1400ms) 주기로 무한 반복; `prefers-reduced-motion: reduce`에서 `animation:none`(정적) — 시맨틱 토큰이라 다크에서 자동 전환 |
| `.cover-img` | `display:block`, `width/height:100%`, `object-fit:cover`; `[hidden]`이면 `display:none`(로딩 중 가림) |
| `.cover-fallback` | flex 중앙정렬, `width/height:100%`, `border:1px solid --border-subtle`, `border-radius:--radius-lg`, `background:--surface-hover`, `color:--text-disabled` |

- **상태**: `loading`(마운트 직후, 스켈레톤 + 이미지 hidden) → `load` 이벤트 → `loaded`(이미지 표시) / `error` 이벤트 → `error`(폴백: lucide `Cat` 22 아이콘, 오류 문구 없음). 회전 스피너는 어떤 상태에도 없다.
- **React(`components/CatCover.tsx`)**: props 없음. `useState` 초기화 함수로 마운트 시 1회 `?width=760&_={nonce}` 캐시버스터 URL 생성(리렌더에 불변 — cataas 응답에 캐시 헤더가 없어 nonce 없이는 브라우저 캐시가 같은 고양이를 재사용할 수 있음). `Editor`가 `key={`cover-${post.id}`}`로 렌더해 글 전환 시 리마운트(상태 초기화 + 늦은 응답의 경쟁 조건 차단). 접근성: 장식 요소로 `img alt=""`, 스켈레톤·폴백 `aria-hidden="true"`. testid: `cover-image`/`cover-skeleton`/`cover-fallback`.

### 5.15 Theme toggle (테마 토글) — `components/ThemeToggle.tsx`

- **목적/역할**: 라이트↔다크 테마 전환 스위치. 두 사이드바(업무 §6.2, 마이 페이지 §6.4)의 `.rail-spacer` 아래에 공용으로 배치. 스펙: `specs/003-dark-mode-toggle/`.
- **해부(구조)**: 기존 `.navitem` 클래스를 그대로 쓰는 `<button type="button" role="switch">` — 신규 스타일 없음. 아이콘(lucide 15px) + 라벨.
- **상태 표시**: 라이트일 때 `Moon` + "다크 모드"(`aria-checked=false`), 다크일 때 `Sun` + "라이트 모드"(`aria-checked=true`) — 라벨이 클릭 시 전환될 대상을 예고한다.
- **React**: props 없음 — `useStore()`의 `theme`/`toggleTheme`만 구독해 어디서 렌더돼도 동일 상태(두 레일 일치 보장).
- **동작**: 클릭/Enter/Space → `toggleTheme()` 1회. 전환은 즉시(트랜지션 억제, §7)이며 새로고침·내비게이션 없음.

---

## 6. 레이아웃 & 화면 (Layouts & Screens)

### 6.1 `/login` (와이어프레임 1d) — `app/login/page.tsx`

- **구조**: 전체 뷰포트 중앙(`.login-page`)에 360px 카드 1개. 로고 → 제목 → 태그라인 → Google 버튼(풀폭) → 안내 문구.
- **동작**: `ready && user`면 이미 로그인 → `/workspace`로 replace(`login/page.tsx:13-15`). 버튼 클릭 시 `busy` 표시 후 500ms 뒤 목 로그인.
- **반응형**: 카드 `max-width:calc(100vw - 32px)`로 좁은 화면 대응.

### 6.2 `/workspace` 3-pane (와이어프레임 1a + 1b·1f·1g) — `app/workspace/page.tsx`

- **그리드/영역**: `flex` 3-pane — 레일(260px) · 리스트페인(320px) · 상세(flex:1). 높이 `100dvh`, 컨테이너 `overflow:hidden`, 각 pane 개별 스크롤.
- **좌측 레일(1a)**: 브랜드·검색·내비(전체 글/즐겨찾기/최근 항목/휴지통, 카운트 배지)·유저 푸터.
- **글 목록(1b)**: 상단 프롬프트 박스 → 섹션 라벨(`검색 결과 · n` 또는 `{내비라벨} · n`) → 카드 목록. `filterPosts`가 nav·검색으로 목록을 만든다(`workspace/page.tsx:14-46`):
  - `favorites`: 미삭제 & favorite, `createdAt` 내림차순.
  - `recent`: 미삭제, `updatedAt` 내림차순, **상위 10개**.
  - `trash`: 삭제됨, `deletedAt` 내림차순.
  - `default`(all): 미삭제, `createdAt` 내림차순.
  - 검색어(`q`)는 제목/내용 소문자 포함 필터.
- **상세(1f·1g)**: 선택된 글이 있으면 `<Editor>`(제목 위에 랜덤 고양이 커버, §5.14), 없으면 빈 상태(커버 없음).
- **`/page` 슬래시 메뉴 흐름**: 프롬프트에 `/` 입력 → 포커스 상태면 슬래시 메뉴 open(`PromptBox.tsx:33`). `query`로 `SLASH_ITEMS` 필터(`key.startsWith(query)`). enabled 항목은 `page`뿐 → 하이라이트. Enter/전송/행 클릭 시 `page`면 빈 제목 새 글 생성. 슬래시 아닌 일반 텍스트 + Enter → 그 텍스트를 제목으로 생성(`PromptBox.tsx:41-48`).
- **생성 후 동작(`handleCreate`, `workspace/page.tsx:93-99`)**: nav를 `all`로, 검색 비우고, 새 글 선택. 제목 없이 만들면 `focusId`로 제목 입력에 자동 포커스.
- **반응형**: §5.13대로 ≤1024px에서 레일 220 / 리스트 280 / 상세 여백 축소.

### 6.3 빈 상태 (Empty) — `app/workspace/page.tsx:212-235`

- 상세 pane에 글 미선택 시: 아이콘 타일 + `{nickname}님, 무엇을 기록할까요?` + 안내 + 추천 칩 3개(클릭 시 해당 제목으로 즉시 새 글). 목록이 비면 nav별 문구: 휴지통 "휴지통이 비어 있어요.", 검색 중 "검색 결과가 없어요.", 그 외 "아직 글이 없어요. /page로 시작해 보세요."(`workspace/page.tsx:126-134`).

### 6.4 `/me` 마이 페이지 (와이어프레임 1i) — `app/me/page.tsx`

- **구조**: `.workspace` 프레임 재사용 — 좌측 `.rail`(설정 내비: 프로필/계정 탭 + `ThemeToggle`(§5.15) + "업무로 돌아가기" 링크) + 우측 `.settings-body`.
- **프로필 탭**: 아바타(78) + 이미지 변경/제거 + 별명 필드(`#n/20` 카운터) + "연결된 계정 · Google" 힌트 + 저장 버튼(+저장 완료 노트).
- **계정 탭**: 이메일 행, 연결된 계정 뱃지(GOOGLE), danger-zone(로그아웃 / 모든 데이터 초기화).
- **동작**: 폼 초기값은 최초 1회만 사용자 정보에서 hydrate(`me/page.tsx:31-37`). `dirty`(변경됨) & `valid`(별명 비어있지 않음) & 저장 중이 아닐 때만 저장 가능. 저장은 Supabase `public.profile`에 upsert되어 다른 브라우저에서도 유지된다.

### 6.5 스플래시 (Splash) — `app/page.tsx`

- 루트 `/`는 스플래시("m" 로고)만 렌더하고 `ready` 시 로그인 여부로 리다이렉트. 워크스페이스/마이페이지도 미준비 시 동일 스플래시를 잠깐 보여준다.

### 6.6 layout (루트) — `app/layout.tsx`

- `<html lang="ko" data-theme="light" suppressHydrationWarning className={pretendard.variable}>` → `<head>`(테마 인라인 스크립트) → `<body>` → `<StoreProvider>`. 전역 폰트 변수·메타데이터·전역 스토어를 여기서 주입. 전 페이지 공통 프레임.
- **테마 부트스트랩**: `<head>`의 인라인 `<script>`가 첫 페인트 전에 `localStorage['mini-notion:theme']`(없으면 `prefers-color-scheme`)를 읽어 `data-theme`를 교정한다 — 잘못된 테마가 그려지는 프레임이 없다(FOUC 0). `suppressHydrationWarning`은 이 사전 변경을 React가 수용하게 하는 짝(Next.js 공식 패턴, `preventing-flash-before-hydration.md`). 로직 원본은 `lib/theme.ts`, 스크립트는 읽기 전용(쓰기는 전부 `lib/store.tsx`).

---

## 7. 인터랙션 & 모션 (Interaction & Motion)

**슬래시 명령 & 제목화** (`components/PromptBox.tsx`):
- `/` 시작 → 슬래시 메뉴. `page`만 활성(`enabled:true`), `todo`·`heading`은 "준비 중"(비활성).
- Enter: 슬래시면 하이라이트가 `page`일 때 빈 글 생성, 아니면 트림한 텍스트를 제목으로 생성. Escape는 입력 초기화(`PromptBox.tsx:65-67`). 생성 후 입력 blur.
- 전송 버튼 disabled 규칙: 슬래시면 `highlighted === null`, 일반 텍스트면 `value.trim() === ''`(`PromptBox.tsx:73`).

**자동 저장** (`lib/store.tsx`, `components/Editor.tsx`): 제목/내용 `onChange` → `updatePost`가 즉시 `updatedAt = Date.now()`로 갱신(`store.tsx:154-161`). 별도 저장 버튼 없음. 브레드크럼에 "· 저장됨 {상대시간}" 표시. `posts` 변경 시 `localStorage`에 항상 직렬화 저장(`store.tsx:120-123`).

**즐겨찾기 토글**: 에디터/목록의 별 → `toggleFavorite`로 `favorite` 반전(`store.tsx:163-165`). 목록·에디터의 별은 `--amber-500`.

**휴지통(삭제 → 복원/영구삭제)**:
- 삭제: `trashPost` → `deletedAt = Date.now()`(soft delete, `store.tsx:167-169`). 워크스페이스에선 삭제 후 선택 해제.
- 복원: `restorePost` → `deletedAt = null`(`store.tsx:171-173`), nav를 `all`로.
- 영구 삭제: `window.confirm('이 글을 영구 삭제할까요? 되돌릴 수 없어요.')` 후 `deletePostForever`(배열에서 제거, `store.tsx:175-177`; `workspace/page.tsx:101-105`).

**호버/포커스 피드백**: 인터랙티브 표면은 hover 시 `--surface-hover`, 입력 컨테이너는 `:focus-within`에서 `--accent` 보더 + `--shadow-focus`(3px, #6a5df0 40%).

**커버 스켈레톤 pulse** (`components/CatCover.tsx`, §5.14): 커버 로딩 동안 `.cover-skeleton`이 `cover-pulse` 키프레임으로 `--gray-100↔--gray-150` 배경을 `--dur-shimmer`(1400ms) 주기로 교차(스피너 금지). `prefers-reduced-motion: reduce`에서는 애니메이션을 끄고 정적 `--gray-100`으로 표시.

**트랜지션 duration/ease 사용 규칙**: 코드에서 실제로 쓰이는 조합은 `--dur-fast`(120ms) + `--ease-standard`(`cubic-bezier(0.2, 0, 0.1, 1)`) 하나로 통일. 전이 속성은 컴포넌트별로 `background`/`border-color`/`color`/`box-shadow` 조합. (`--dur-base`, `--dur-slow`, `--ease-out`는 토큰으로 정의만 되고 CSS 사용처는 확인 불가.)

**테마 전환 (다크모드)**: 전환은 애니메이션 없이 즉시다. `toggleTheme`(`lib/store.tsx`)이 `<html>`에 `theme-switching` 클래스를 얹고 `data-theme`를 바꾼 뒤 강제 리플로우 후 즉시 제거 — 그 프레임 동안 `html.theme-switching *`의 `transition: none !important`가 걸려 배경·컨트롤이 어긋나지 않고 한 번에 바뀐다. hover 등 평소 120ms 트랜지션은 전환 후 그대로 동작. 모션 최소화 설정 여부와 무관하게 같은 동작(애니메이션 자체가 없으므로).

---

## 8. 데이터 모델 (Data Model, 디자인 영향분) — `lib/store.tsx`

**테마 상태** (`lib/store.tsx` + `lib/theme.ts`): `Store.theme: 'light' | 'dark'`(유효 테마)와 `toggleTheme()`. 영속 키 `mini-notion:theme`(값 `"light"|"dark"`, 부재 = 선택 없음 → OS 설정 따름). 초기값은 인라인 스크립트가 설정한 `<html data-theme>`에서 읽는다. "모든 데이터 초기화"(`resetAll`)는 이 키를 보존한다 — 테마는 계정 데이터가 아니라 기기 설정.

**`User` 타입 필드 전량** (`store.tsx:14-18`):

| 필드 | 타입 | 디자인 영향 |
|---|---|---|
| `nickname` | `string` | 최대 20자(`MAX_NICKNAME`, `me/page.tsx:12`), `#n/20` 카운터, "{nickname}님" 표기 |
| `email` | `string` | 계정 탭 이메일 행 표시 |
| `image` | `string \| null` | 프로필 이미지(Google 사진 URL 또는 업로드 dataURL). null이면 아바타에 닉네임 첫 글자 |

**`Post` 타입 필드 전량** (`store.tsx:20-28`):

| 필드 | 타입 | 디자인 영향 |
|---|---|---|
| `id` | `string` | `crypto.randomUUID()` |
| `title` | `string` | 비면 "제목 없음"(untitled 스타일) |
| `content` | `string` | 첫 줄이 리스트 스니펫, 에디터 자동 높이 |
| `favorite` | `boolean` | 즐겨찾기 별/칩 on |
| `createdAt` | `number` | 목록 정렬/메타 |
| `updatedAt` | `number` | 자동 저장·최근 정렬·"저장됨" |
| `deletedAt` | `number \| null` | null=일반, 값 있으면 휴지통 |

**디자인 제약으로 이어지는 값**:
- 별명 최대 20자 → `#n/20` 카운터(`me/page.tsx:158-160`).
- 프로필 이미지 5MB 이하(`MAX_IMAGE_BYTES = 5 * 1024 * 1024`) + `image/*`만. 초과 시 "5MB 이하 이미지만 업로드할 수 있어요." 알림(`me/page.tsx:50-63`).
- 최근 항목 상위 10개(`slice(0, 10)`, `workspace/page.tsx:26`).
- **시드 샘플 4개**(`seedPosts`, `store.tsx:60-99`): "주간 업무 정리"(2일 전, favorite), "신제품 아이디어"(3일 전), "회의 메모"(5일 전), "읽을 자료 모음"(8일 전). 첫 로그인 & 저장된 글 없을 때만 시드(`store.tsx:125-131`).
- **사용자 파생**: Supabase 세션(Google 이름·이메일·사진)이 기본값, 그 위에 `public.profile` 행(`name`/`image`, auth.users와 1:1)을 병합(`store.tsx`의 `user` memo). 프로필 행은 최초 로그인 시 DB 트리거(`on_auth_user_created` → `handle_new_user()`)가 Display name·아바타로 생성하고, `/me` 저장 시 upsert로 덮어쓴다.
- localStorage 키: `mini-notion:posts`(글 전용). 레거시 키 `mini-notion:user`, `mini-notion:user-overlay:<uid>`는 초기화 시 제거.

**`formatDate`** (`lib/format.ts`): `< 60s` → "방금", `< 1h` → "n분 전", `< 24h` → "n시간 전", 그 이상 → "M월 D일". 목록·메타·브레드크럼의 모든 상대 시간 표기가 이 함수 하나에서 나온다.

---

## 9. 에셋 & 아이콘 (Assets)

- **Pretendard Variable**: 로컬 폰트 `app/fonts/PretendardVariable.woff2`(루트에도 `PretendardVariable.woff2` 사본 존재). `next/font/local`로 로딩, weight 45~920, `display:swap`(`app/layout.tsx:6-11`). 라이선스/출처는 코드에서 명시 확인 불가(※ 코드에서 확인 불가 — Pretendard는 통상 OFL 배포).
- **Lucide 라인 아이콘**(`lucide-react`): 사용처와 크기 —
  - `Rail.tsx`: `Search`(14), `FileText`·`Star`·`Clock`·`Trash2`(15), `Settings`(15).
  - `PromptBox.tsx`: `ArrowUp`(16, 전송), `FileText`·`CheckSquare`·`Heading1`(15, 슬래시 행).
  - `Editor.tsx`: `Star`(14), `Trash2`(14), `RotateCcw`(14), `X`(14).
  - `CatCover.tsx`: `Cat`(22, 커버 로드 실패 폴백).
  - `workspace/page.tsx`: `FileText`(22, empty), `Star`(11, 목록 별), `RotateCcw`·`X`(12, 휴지통 액션).
  - `me/page.tsx`: `ArrowLeft`·`ImagePlus`·`LogOut`·`UserRound`·`X`(14~15).
- **GoogleLogo**(`components/GoogleLogo.tsx`): 브랜드 4색 SVG. `viewBox="0 0 48 48"`, 기본 `size=18`, `aria-hidden="true"`. 색상 원문: `#FFC107`, `#FF3D00`, `#4CAF50`, `#1976D2`. 로그인 버튼에 사용.
- **브랜드 마크**: 텍스트 "m"(brand-tile 26px, login-logo 44px, splash). 워드마크 "mini notion".
- **favicon**: `app/favicon.ico` 존재. `public/` 에 `file.svg`·`globe.svg`·`next.svg`·`vercel.svg`·`window.svg`(Next 기본 에셋, 앱 UI에서 직접 사용처 확인 불가).

---

## 10. 접근성 & 반응형 (Accessibility & Responsive)

**포커스 가시성**: 입력 컨테이너(`.rail-search`, `.promptbox-inner`, `.field`)는 `:focus-within`에서 `border-color:--accent` + `box-shadow:--shadow-focus`(= `0 0 0 3px` / `--focus-ring` = `color-mix(in srgb, --violet-500 40%, transparent)`). 텍스트 입력·에디터 인풋은 `outline:none`으로 브라우저 기본 아웃라인을 제거(포커스 표시는 커서/컨테이너 링에 의존).

**대비**: 본문 `--text-primary`(#2f2f2b) on `--white`(#ffffff)로 높은 대비. 3차 텍스트 `--text-tertiary`(#90908a)는 메타/플레이스홀더용 저대비(※ WCAG AA 정량 검증은 코드에 없음 — 확인 불가).

**시맨틱/보조 표기**: `<html lang="ko">`(`layout.tsx:24`). Avatar `img alt` 동적 생성. 전송 버튼 `aria-label="새 글 만들기"`. GoogleLogo `aria-hidden="true"`. 레일 푸터 `title="마이 페이지"`. 휴지통 목록 액션은 `role="button" tabIndex={0}`(`workspace/page.tsx:162-187`).

**반응형(`Responsive (light)`, `app/globals.css:1025-1038`)**: 단일 브레이크포인트 `max-width: 1024px`. 변화 = 레일 260→220px, 리스트페인 320→280px, 상세 여백 `22px 40px 80px`→`22px 24px 60px`. 로그인 카드는 `max-width:calc(100vw - 32px)`로 별도 대응. 그 외 모바일 전용 레이아웃 전환은 없음.

---

## 11. 소스 매핑 (Source Map)

| 디자인 요소 | 소스 파일:라인 |
|---|---|
| 디자인 토큰 100개(`:root`) + 다크 오버라이드 | `app/globals.css`(`:root` · `[data-theme='dark']`) |
| 테마 토글 / 테마 로직 | `components/ThemeToggle.tsx` / `lib/theme.ts` · `lib/store.tsx` |
| body 기본/타이포/selection | `app/globals.css:119-157` |
| Buttons | `app/globals.css:159-231` |
| Chip | `app/globals.css:233-258` |
| Avatar(CSS/React) | `app/globals.css:260-277` / `components/Avatar.tsx` |
| Sidebar rail(CSS/React) | `app/globals.css:279-429` / `components/Rail.tsx` |
| Workspace layout | `app/globals.css:431-447` / `app/workspace/page.tsx` |
| Prompt box + slash menu | `app/globals.css:449-572` / `components/PromptBox.tsx` |
| Post list | `app/globals.css:574-664` / `app/workspace/page.tsx:136-191` |
| Detail / editor | `app/globals.css:666-785` / `components/Editor.tsx` |
| 랜덤 고양이 커버 | `app/globals.css:721-774` / `components/CatCover.tsx` |
| Empty state | `app/globals.css:787-833` / `app/workspace/page.tsx:212-235` |
| Login | `app/globals.css:835-890` / `app/login/page.tsx` |
| Splash | `app/globals.css:892-899` / `app/page.tsx` |
| Settings (my page) | `app/globals.css:901-1023` / `app/me/page.tsx` |
| Responsive | `app/globals.css:1025-1038` |
| 폰트 로딩 | `app/layout.tsx:6-11` |
| 전역 프레임/Provider | `app/layout.tsx:18-30` |
| 상태·데이터 모델 | `lib/store.tsx` |
| 시드 샘플 4개 | `lib/store.tsx:60-99` |
| 상대 시간 포맷 | `lib/format.ts` |
| Google 로고 SVG | `components/GoogleLogo.tsx` |
| Nav 라벨/아이콘 | `components/Rail.tsx:10-22` |
| 슬래시 아이템 | `components/PromptBox.tsx:6-10` |

---

## 12. 알려진 한계 (Known Limits) — 디자인/구현 영향분 (근거: `README.md:38-45`)

- **목(mock) 인증**: "Google 계정으로 계속하기"는 실제 OAuth 없이 데모 계정(`유아이볼`/`uibowl@gmail.com`) 생성. 로그인 화면·버튼은 실제 OAuth 흐름으로 교체 가능하도록 시각만 갖춤(500ms 지연 연출).
- **localStorage 저장**: 서버·DB 없이 브라우저에 저장(운영 비용 0원). 브라우저를 바꾸면 데이터·프로필 이미지(dataURL)가 따라오지 않음 → 화면상 "빈 상태"로 시작.
- **첫 로그인 시 샘플 글 4개 시드**: 와이어프레임과 동일한 데모 데이터. 목록/즐겨찾기/휴지통 UI를 즉시 채워 보여 주기 위함.
- **미완성 슬래시 명령**: `할 일 목록`·`제목`은 "준비 중" 배지로 표시(비활성). 디자인상 자리만 확보.
- **정의만 되고 사용처 미확인 토큰**: `--gray-700/800`, `--blue-500/50`, `--green-50`, `--amber-50`, `--text-h3`, `--shadow-sm`, `--ease-out`, `--dur-base`, `--dur-slow` 등은 스케일 완결성을 위해 정의됐으나 현재 CSS에서 직접 참조 확인 불가(확장 대비 여유분).

---

## 자기 검증 체크리스트 (Self-Verification)

- [x] `:root`의 CSS 변수 개수와 문서 토큰 개수가 **일치**(코드 실측 100개 = 문서 16+8+8+8+7+3+9+23+18 = 100개. ※ 이전 판의 "91개" 표기는 92개 시점의 낡은 기록이라 함께 정정함).
- [x] `globals.css`의 컴포넌트 섹션 **13개** 모두 문서화(Buttons/Chip/Avatar/Sidebar rail/Workspace layout/Prompt box + slash menu/Post list/Detail·editor/Empty state/Login/Splash/Settings/Responsive).
- [x] React 컴포넌트 5개(Avatar/Editor/PromptBox/GoogleLogo/Rail) 모두 언급.
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
