# Research: 사이드바 접기/펼치기

**Date**: 2026-07-16 | **Plan**: [plan.md](./plan.md)

Technical Context에 NEEDS CLARIFICATION은 없다. `/speckit-clarify`가 계획 단계로 미룬(Deferred) 설계 결정 4건과, 구현 경로를 확정하는 데 필요한 추가 결정 4건을 코드베이스 실물 확인으로 해소했다. 모든 사실은 이 워크트리의 실제 파일에서 검증했다(추측 없음 — 헌법 원칙 II).

## R1. 접힌 레일 폭: 56px, 토큰 2개 신설

**Decision**: `--rail-width: 260px`, `--rail-width-collapsed: 56px` 토큰을 `:root`에 추가하고 `.rail`이 `width: var(--rail-width)`, `.rail.collapsed`가 `width: var(--rail-width-collapsed)`를 쓴다. ≤1024px 미디어쿼리는 `--rail-width`만 220px로 재정의한다(접힌 폭은 불변).

**Rationale**:
- 현재 260px은 `app/globals.css:281`과 `:1110`(≤1024px에서 220px) 두 곳에 리터럴로 존재하고 폭 토큰이 없다. 토큰화하면 접기 기능이 리터럴을 3곳 이상으로 늘리는 대신 1곳으로 줄인다.
- 56px 산출 근거: 레일 좌우 패딩 12px×2를 빼면 내부 폭 32px — navitem(아이콘 15px + 패딩 8px×2 = 31px)과 푸터 아바타(30px)가 정확히 들어가는 최소 폭이다. 기존 스케일(아바타 30, 브랜드 타일 26)과 정합.
- SC-002 검산: 1280px 화면에서 260−56 = **204px ≥ 200px** 충족. 접힌 폭이 60px을 넘으면 SC-002가 깨지므로 상한도 만족.
- 44px류 터치 타깃 기준은 버튼의 세로 히트 영역(패딩 포함 ~29px 높이 + 전폭)으로 기존 navitem과 동일 수준 — 기존 컴포넌트보다 나빠지지 않는다(Edge case "터치·클릭 대상 크기" 응답).

**Alternatives considered**:
- 48px(VS Code 액티비티바): 내부 폭 24px로 아바타 30px가 잘림 — 레일 패딩을 함께 줄여야 해서 변경 반경이 커짐. 기각.
- 64px: 여유는 있으나 SC-002 마진이 196px…이 아니라 260−64=196 < 200으로 **SC-002 위반**. 기각.
- 토큰 없이 리터럴 56px: 헌법 원칙 I(매직 값 금지) 위반. 기각.

## R2. 폭 전환 모션: `--dur-base`(180ms) + `--ease-standard`, reduced-motion 생략

**Decision**: `.rail`에 `transition: width var(--dur-base) var(--ease-standard)`를 준다. `globals.css:758`의 기존 `prefers-reduced-motion: reduce` 블록에 레일 전환 무효화를 추가한다(FR-012). 본문(`.detail`)은 flex가 자연스럽게 따라오므로 별도 애니메이션 없음.

**Rationale**:
- DESIGN.md:604의 현행 규칙은 "실사용 조합은 `--dur-fast`(120ms)+`--ease-standard` 하나"인데, 이는 hover/보더 같은 미세 전환용이다. 204px의 공간 이동은 더 긴 duration이 적정하며, `--dur-base: 180ms`는 **이미 토큰으로 정의**되어 있으나 사용처가 없던 값이라 신규 값 도입 없이 스케일 안에서 해결된다.
- 180ms는 SC-003(≤300ms)을 여유 있게 충족.
- 첫 사용이므로 DESIGN.md §7 모션 사용 규칙을 같은 작업에서 갱신해야 한다(원칙 I 동기화 조항). reduced-motion 선례(CatCover 스켈레톤, DESIGN.md:602)와 같은 방식으로 확장.

**Alternatives considered**:
- `--dur-fast` 120ms 통일 유지: 규칙은 단순하지만 큰 레이아웃 변화가 뚝 끊겨 보임(FR-005의 "시각적 연속" 저하). 기각.
- `--dur-slow` 260ms: SC-003은 통과하나 조작감이 느려지고, 리스트페인·본문 리플로우가 길게 노출됨. 기각.
- JS 애니메이션(FLIP 등): CSS transition으로 충분한데 복잡성만 추가(원칙 IV). 기각.

## R3. 접힌 상태 툴팁: `aria-label` + `data-tip` CSS 의사요소, `:hover`/`:focus-visible`

**Decision**: 접힌 레일의 아이콘 조작부(내비 4개·검색 버튼·푸터 링크·토글)는 (a) 항상 `aria-label`로 접근 가능한 이름을 갖고, (b) `data-tip` 속성 + `.rail.collapsed [data-tip]:hover::after, :focus-visible::after` CSS 툴팁으로 시각 라벨을 띄운다. 내비 툴팁은 카운트가 있으면 포함한다(예: `전체 글 (3)`). 스타일은 기존 토큰만 사용: `--surface-inverse` 배경, `#fff` 텍스트(기존 brand-tile과 동일 조합), `--radius-sm`, `--text-2xs`, `--shadow-md`.

**Rationale**:
- FR-014가 호버 **및** 키보드 포커스 시 라벨 확인을 요구하는데, 네이티브 `title`은 키보드 포커스에 반응하지 않아 요건 미달. CSS 의사요소는 의존성 0으로 두 트리거를 모두 처리(원칙 IV).
- 라벨 텍스트는 접힘 시 `display:none`으로 사라져 접근성 트리에서도 제거되므로, 상태와 무관하게 버튼에 `aria-label`을 상시 부여해 이름을 안정화한다(FR-010·FR-014 동시 충족).
- 신규 색상 없음 — 다크 툴팁은 `--surface-inverse`(#1a1a17) 재사용. 신규 컴포넌트 패턴이므로 DESIGN.md §5에 문서화한다.

**Alternatives considered**:
- `title` 속성만: 키보드 포커스 미지원, 표시 지연 — FR-014 미달. 기각.
- 툴팁 라이브러리(radix/floating-ui): 의존성 추가, 원칙 IV 위반. 기각.
- 항상 보이는 축약 라벨: 56px에 텍스트가 들어가지 않고 FR-014("텍스트 요소를 감춘다")와 모순. 기각.

## R4. ≤1024px 반응형: 접힌 폭 56px 동일 유지

**Decision**: 미디어쿼리는 펼침 폭만 220px로 줄이고(현행 유지, 토큰 재정의로 이전), 접힌 폭은 화면 폭과 무관하게 56px이다.

**Rationale**: 접힌 레일은 이미 최소 폭이라 더 줄일 것이 없고, 분기당 상태가 2×2로 늘어나는 것을 막는다(FR-011: 기존 규격을 깨뜨리지 않으면서 두 폭 모두에서 동작). 검산: 1024px 화면에서 접으면 본문이 +164px — SC-002는 1280px 기준이므로 위반 아님.

**Alternatives considered**: 좁은 화면 전용 접힌 폭(예: 48px) — 이득 8px에 상태 분기 배가. YAGNI 기각.

## R5. 영속화: `mini-notion:sidebar-collapsed` 단일 boolean 키, store 게이트웨이 경유

**Decision**: `lib/store.tsx`에 모듈 상수 `SIDEBAR_KEY = 'mini-notion:sidebar-collapsed'`를 추가하고, 기존 posts 패턴을 그대로 따른다 — 마운트 이펙트에서 `loadJSON<boolean>` 하이드레이션(값이 `true`가 아니면 전부 `false`로 정규화), `ready` 게이트 걸린 write-through 이펙트로 저장. Store 컨텍스트에 `sidebarCollapsed: boolean`과 `toggleSidebar(): void`를 노출한다. 키는 uid 네임스페이스 없이 브라우저 단위(FR-017, Clarification Q1). `resetAll()`은 건드리지 않는다.

**Rationale**:
- 헌법 원칙 III: 영속 상태는 store 게이트웨이 단독 경유. 검증된 4단계 패턴(키 상수 → loadJSON → 마운트 하이드레이션 → ready 게이트 write-through)이 `lib/store.tsx:48,63-70,149,195-198`에 이미 존재하므로 그대로 복제한다.
- `typeof v === 'boolean' ? v : false`가 아닌 `v === true` 정규화: 손상·비정상 값 전부를 펼침 기본값으로 흡수(FR-007). `loadJSON`의 try/catch가 JSON 파싱 실패도 null로 만든다.
- `resetAll()` 불변 근거: FR-017은 로그아웃·계정 전환이 접힘 상태를 초기화하지 않을 것을 요구한다. `resetAll`은 글 데이터 초기화 기능이고 UI 환경설정은 데이터가 아니므로 범위 밖 — 스펙이 요구하지 않는 삭제를 추가하지 않는다(원칙 IV).

**Alternatives considered**:
- `mini-notion:ui` 객체 키(향후 UI 설정 확장 대비): 추측성 일반화, 원칙 IV 위반. 필요해지는 시점에 마이그레이션해도 늦지 않다. 기각.
- uid 네임스페이스 키: Clarification Q1에서 브라우저 단위로 확정, 직전 커밋(f221d08)이 per-uid 오버레이를 걷어낸 방향과도 배치. 기각.
- React 외부 모듈 상태 + storage 이벤트: 탭 간 동기화는 명시적 범위 밖(Assumptions). 기각.

## R6. 하이드레이션 플래시(FR-016): 기존 `ready` 게이트 재사용

**Decision**: 별도 장치를 만들지 않는다. 두 페이지 모두 `ready && user`가 되기 전에는 `.splash`를 렌더하고 레일을 그리지 않으므로, 마운트 이펙트에서 하이드레이션된 `sidebarCollapsed`가 레일의 **첫 페인트부터** 반영된다. 검증 항목: `app/me/page.tsx`도 동일 게이트를 쓰는지 구현 시 확인하고, Rail 위치의 splash 게이트보다 먼저 레일이 그려지는 경로가 없음을 quickstart 시나리오로 확인.

**Rationale**: localStorage 읽기는 동기라 마운트 이펙트 시점에 즉시 완료되고, splash가 첫 페인트를 가리므로 펼침→접힘 점프가 사용자에게 보일 창이 없다. SSR 표면도 없다(클라이언트 컴포넌트 + splash). 추가 코드 0줄로 FR-016 충족.

**Alternatives considered**: `<script>` 인라인 선주입(테마 플래시 방지 패턴) — splash 게이트가 이미 있는 구조에서 불필요한 복잡성. 기각.

## R7. Rail 컴포넌트 API: presentational 유지, prop 2개 추가

**Decision**: `Rail`은 상태 없는 prop 제어 컴포넌트로 유지하고 `collapsed: boolean`, `onToggleCollapse: () => void`를 추가한다. 토글 버튼은 `.brand` 행에 두며(펼침: 우측 끝, 접힘: 타일 아래 세로 배치), `aria-expanded={!collapsed}` + 고정 `aria-label`을 갖는다. 내비 라벨 텍스트와 카운트는 `<span>`으로 감싸 CSS로 감춘다. 접힘 상태의 검색은 `.rail-search` 대신 검색 아이콘 버튼을 렌더하고, 클릭 시 `onToggleCollapse` 호출 후 검색 입력에 포커스를 옮긴다(FR-015 — 펼침과 동일 취급이므로 FR-015a 자동 충족).

**Rationale**:
- 현재 `Rail.tsx:33`은 완전 prop 제어라 `components/Editor.test.tsx` 패턴(프로바이더 없이 noop 콜백으로 직접 렌더)으로 테스트 가능 — 이 성질을 지키면 TDD 비용이 최소가 된다(원칙 VI).
- 두 페이지가 이미 `useStore()`를 쓰므로 배선은 각각 2줄 수준(FR-008 일관성은 단일 store 값에서 자동 확보).
- 토글이 레일 DOM의 첫 버튼이 되어 SC-004의 "탭 5회 이내 도달"이 구조적으로 보장된다.
- 아이콘: lucide 1.23.0에 실물 확인된 `PanelLeftClose`(펼침 상태에서 표시)/`PanelLeftOpen`(접힘 상태에서 표시), size 15로 기존 아이콘 크기와 통일.

**Alternatives considered**:
- Rail이 `useStore()` 직접 호출: 배선은 줄지만 presentational 성질이 깨져 테스트에 프로바이더+Supabase 목이 필요해짐. 기각.
- 토글을 레일 밖 플로팅 버튼으로: FR-001a·Assumptions("버튼은 사이드바 안")와 모순. 기각.

## R8. 테스트 전략(TDD 매핑)

**Decision**: 프로덕션 변경 전 실패 테스트를 다음 순서로 작성한다.

| 대상 | 테스트 파일 | 검증(FR 매핑) |
|---|---|---|
| store 기본값·토글·영속·복구 | `lib/store.test.tsx` (확장) | 기본 펼침(FR-007), toggleSidebar 반전(FR-001), localStorage 왕복(FR-006), 손상값→false(FR-007), 키가 uid 무관 상수(FR-017) |
| Rail 렌더·상호작용·a11y | `components/Rail.test.tsx` (신규) | 토글 존재·aria-expanded·고정 이름(FR-010), 클릭→onToggleCollapse(FR-001), 접힘 시 라벨·카운트·사용자명 숨김 + aria-label 유지(FR-014), 접힘 내비 클릭→onNav(FR-013), 접힘 검색 버튼→onToggleCollapse(FR-015), data-tip 존재(FR-014) |
| 페이지 배선 | 기존 테스트 회귀 + quickstart 실기동 | FR-008, FR-016 |

CSS 선언값(56px, transition 180ms, 툴팁 시각, reduced-motion)은 jsdom에서 계산 스타일이 나오지 않으므로 클래스·속성 단언까지만 자동화하고, 시각 결과는 quickstart.md 시나리오의 실기동(`npm run dev`)으로 검증한다(원칙 V·VI 병행 — CSS는 설정 파일 성격의 TDD 예외 범주로 처리하되 행동 단언은 유지).

**Alternatives considered**: Playwright 등 E2E 도입 — 시각 검증 자동화는 가능하나 신규 인프라·의존성(원칙 IV 위반)이며 현 테스트 스택 규약(Vitest+RTL)을 벗어남. 기각.
