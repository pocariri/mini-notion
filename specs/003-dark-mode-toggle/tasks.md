# Tasks: 다크모드 (Dark Mode)

**Input**: Design documents from `/specs/003-dark-mode-toggle/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/(theme-runtime, themetoggle-component), quickstart.md

**Tests**: TDD is MANDATORY per the project constitution (Principle VI). 동작을 갖는 모든 태스크는 실패 테스트(RED)를 먼저 작성한 뒤 구현(GREEN)한다. CSS·설정 파일은 헌법의 TDD 예외 범주이나, 라이트 외관 불변(기존 테스트 전체 통과)과 quickstart 실구동으로 검증한다.

**Organization**: 사용자 스토리 단위로 묶어 각 스토리를 독립적으로 구현·검증할 수 있게 한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 가능(다른 파일, 미완 태스크에 의존 없음)
- **[Story]**: 소속 사용자 스토리(US1, US2, US3)

## Path Conventions

단일 Next.js 앱 — 저장소 루트 기준 `app/`, `components/`, `lib/`, 테스트는 대상 옆 co-locate(`*.test.ts(x)`).

---

## Phase 1: Setup

**Purpose**: 베이스라인 확립 (프로젝트는 이미 초기화됨 — 신규 의존성 0)

- [X] T001 베이스라인 확인: `npm run test:run`으로 기존 52개 테스트 통과를 기록 (이후 모든 단계의 회귀 기준)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 스토리가 의존하는 공통 기반 — 유효 테마 도출 규칙과 테스트 경계

**⚠️ CRITICAL**: 이 페이즈 완료 전에는 어떤 스토리도 시작할 수 없다

- [X] T002 [P] `vitest.setup.ts`에 `matchMedia` in-memory 경계 구현 추가 — 기존 `MemoryStorage` 패턴을 따라 제어 가능한 MediaQueryList(현재 jsdom 29.1.1에서 `matchMedia === undefined` 실측) + 테스트 헬퍼(`setSystemDark(boolean)` — `change` 이벤트 디스패치 포함), `afterEach`에서 라이트로 초기화
- [X] T003 [P] `lib/theme.test.ts` 작성 (RED) — 유효 테마 도출 순수 함수 계약: 저장값 `"light"`/`"dark"`는 그대로, `null`·손상값(`"banana"` 등)은 OS 다크 여부로 폴백, OS 판별 불가 시 라이트(spec Edge Case). `THEME_KEY = 'mini-notion:theme'` 상수 export 검증. `npm run test:run`으로 실패 확인
- [X] T004 `lib/theme.ts` 최소 구현 (GREEN) — `resolveTheme(saved, systemDark)` 도출 규칙(data-model.md `savedTheme ?? (systemDark ? 'dark' : 'light')`), 저장값 검증 함수, `THEME_KEY` 상수. T003 통과 확인

**Checkpoint**: 도출 규칙·테스트 경계 준비 완료 — 스토리 구현 시작 가능

---

## Phase 3: User Story 1 - 사이드바 토글로 다크모드 켜고 끄기 (Priority: P1) 🎯 MVP

**Goal**: 두 사이드바의 토글로 전 화면이 즉시(새로고침·어긋남 없이) 라이트↔다크 전환되고 작업 상태가 보존된다

**Independent Test**: `/workspace`에서 토글 클릭 → 전체 UI가 한 번에 어두워지고, 재클릭 시 복귀. 입력 중이던 글·스크롤·선택 내비 유지 (quickstart 시나리오 A + D의 다크 순회)

### Tests for User Story 1 (MANDATORY - TDD, Constitution Principle VI) ⚠️

> **NOTE: 먼저 작성하고 실패를 눈으로 확인한 뒤 구현한다 (RED → GREEN → REFACTOR)**

- [X] T005 [P] [US1] `lib/store.test.tsx`에 테마 상태 테스트 추가 (RED) — `theme` 초기값이 `<html data-theme>`를 따름(부재 시 light), `toggleTheme()`가 유효 테마의 반대로 전이(라이트→다크→라이트), 전환 시 `document.documentElement.dataset.theme` 즉시 갱신, `localStorage['mini-notion:theme']`에 저장, `posts`·`user` 상태 불변(FR-004)
- [X] T006 [P] [US1] `components/ThemeToggle.test.tsx` 작성 (RED) — contracts/themetoggle-component.md의 테스트 계약 5건: ① 라이트일 때 "다크 모드"+`aria-checked=false` ② 클릭 시 `data-theme='dark'`+라벨 "라이트 모드" ③ 재클릭 복귀 ④ 두 개 렌더 시 하나 클릭에 둘 다 동기화(두 레일 상황, FR-001) ⑤ `role="switch"` 조회 + 키보드 전환

### Implementation for User Story 1

- [X] T007 [US1] `lib/store.tsx`에 `theme`/`toggleTheme` 추가 (T005 GREEN) — Store 타입 확장, 초기값은 `documentElement.dataset.theme`(이중 판정 금지, contracts/theme-runtime.md), `toggleTheme`은 상태·`data-theme`·localStorage 동시 갱신(쓰기 실패 try-catch 무시, FR-017) + 전환 순간 `<html>`에 `theme-switching` 클래스를 얹고 강제 리플로우 후 제거(FR-003a)
- [X] T008 [US1] `components/ThemeToggle.tsx` 구현 (T006 GREEN) — `.navitem` 클래스 `<button type="button" role="switch">`, lucide `Moon`/`Sun` 15px, 라벨 "다크 모드"/"라이트 모드", `aria-checked`, props 없음(useStore 전용)
- [X] T009 [P] [US1] `components/Rail.tsx`에 `<ThemeToggle />` 삽입 — `rail-spacer` 아래·`rail-footer` 위
- [X] T010 [P] [US1] `app/me/page.tsx` 마이 페이지 레일에 `<ThemeToggle />` 삽입 — `rail-spacer` 아래·"업무로 돌아가기" 위
- [X] T011 [US1] `app/globals.css` 사전 정리 (라이트 외관 변화 0) — ① `#fff` 리터럴 3곳(:307 `.brand-tile`, :499 `.send`, :936 `.login-logo`)을 신설 `--text-on-inverse`·기존 `--text-on-accent`로 토큰화 ② 원시 팔레트 직접 참조 12곳(research.md D3-3: ::selection·avatar·btn-danger:hover·trash-banner·send disabled·선택 로우 보더·커버 스켈레톤/폴백)을 기존 시맨틱 토큰 재포인팅 또는 신설 시맨틱 토큰(라이트 값 = 현재 값)으로 치환. 완료 기준: `npm run test:run` 전체 통과 + 라이트 화면 픽셀 변화 없음(육안)
- [X] T012 [US1] `app/globals.css`에 `[data-theme='dark']` 블록 추가 — 시맨틱 토큰(Surfaces 7·Text 6·Borders 3·Accent roles 5·신설 토큰) + `--text-primary` 명시 오버라이드(별칭 없는 유일 토큰) + `--shadow-xs/sm/md/lg` 재정의 + `color-scheme: dark`. 원시 팔레트 재정의 금지(research.md D3). 모든 텍스트·배경 조합 대비 수치 검증: 본문 4.5:1, 큰 텍스트·UI 3:1(FR-009, SC-003) — 계산 결과를 T014의 DESIGN.md 표에 병기할 수 있게 기록
- [X] T013 [US1] `app/globals.css`에 `.theme-switching` 억제 규칙 추가 — `html.theme-switching *, html.theme-switching *::before, html.theme-switching *::after { transition: none !important; }` (T007의 store 로직이 사용, FR-003a)
- [X] T014 [US1] `DESIGN.md` 동기화 (헌법 원칙 I — 같은 작업 내 필수) — §3에 다크 토큰 표·신설 토큰(대비 수치 병기), §5에 ThemeToggle 컴포넌트 절, §7에 전환 규칙(트랜지션 억제), 자기검증 체크리스트 토큰 수 정정(713행의 낡은 "91개" 포함). 신설 토큰 목록을 사용자에게 보고

**Checkpoint**: US1 완결 — 토글로 전 화면 다크 전환 가능, 독립 검증(quickstart A) 후 MVP 배포 가능

---

## Phase 4: User Story 2 - 선택한 테마가 유지됨 (Priority: P2)

**Goal**: 재방문·새로고침·화면 이동·로그아웃 후에도 선택한 테마가 깜빡임 없이 유지된다

**Independent Test**: 다크 전환 → 강새로고침 5회에 라이트 프레임 0회, 브라우저 재시작 후 다크 유지, `/login`도 다크 (quickstart 시나리오 B + D 초기화·손상값)

### Tests for User Story 2 (MANDATORY - TDD, Constitution Principle VI) ⚠️

- [X] T015 [P] [US2] `lib/theme.test.ts`에 부팅 적용 테스트 추가 (RED) — `applyInitialTheme()`(인라인 스크립트와 동일 로직의 export 함수)가 저장값/손상값/부재×OS 조합별로 `documentElement.dataset.theme`를 올바르게 설정, localStorage 접근 실패(throw하는 스토리지)에도 예외 전파 없이 폴백(FR-017), **어떤 경로에서도 localStorage에 쓰지 않음**(불변 조건 2)
- [X] T016 [P] [US2] `lib/store.test.tsx`에 유지 테스트 추가 (RED) — `resetAll()` 후 `mini-notion:theme` 키 보존(FR-018) + posts 키는 삭제됨, 저장소 쓰기 실패 시에도 세션 내 토글 동작 지속(FR-017)

### Implementation for User Story 2

- [X] T017 [US2] `lib/theme.ts`에 `applyInitialTheme` + 직렬화용 IIFE 소스 문자열 추가 (T015 GREEN) — contracts/theme-runtime.md 인라인 스크립트 계약(try/catch 전체 랩, 읽기 전용)
- [X] T018 [US2] `app/layout.tsx` 수정 — `<html lang="ko" data-theme="light" suppressHydrationWarning>` + `<head>`에 `<script dangerouslySetInnerHTML>`(T017의 IIFE 소스). Next.js 공식 패턴(`node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md` `## Themes`, 원문 확인 완료) 그대로 적용(FR-012)
- [X] T019 [US2] `lib/store.tsx`의 `resetAll`이 테마 키를 건드리지 않음을 보장 (T016 GREEN) — 현재 `POSTS_KEY`만 지우는 구현 유지를 테스트로 고정(회귀 방지). 쓰기 실패 폴백이 T007에서 미비하면 보강

**Checkpoint**: US1+US2 완결 — 새로고침·재방문에도 깜빡임 없이 유지 (quickstart B 실구동 확인)

---

## Phase 5: User Story 3 - 첫 방문 시 운영체제 설정 존중 (Priority: P3)

**Goal**: 선택한 적 없는 사용자는 OS 설정대로 열리고, 선택 전까지 OS 변경을 따라가며, 선택 후엔 사용자 선택이 우선한다

**Independent Test**: 저장값 없음 + OS 다크 에뮬레이션 → 다크로 열림, 에뮬레이션 전환 시 즉시 반영, 라이트 직접 선택 후엔 OS 무시 (quickstart 시나리오 C)

### Tests for User Story 3 (MANDATORY - TDD, Constitution Principle VI) ⚠️

- [X] T020 [US3] `lib/store.test.tsx`에 OS 연동 테스트 추가 (RED) — T002 헬퍼 사용: ① 저장값 없음+OS 다크 → `theme === 'dark'`(FR-013) ② 저장값 없는 동안 `setSystemDark` 전환 → `theme`·`data-theme` 즉시 반영(FR-016) ③ 토글로 선택 후 OS 전환 → 무시(FR-015) ④ 토글은 항상 현재 유효 테마의 반대를 저장(선택 없음+OS 다크에서 토글 → `"light"` 저장, data-model.md 전이) ⑤ 첫 렌더가 OS 값을 저장하지 않음(불변 조건 2) ⑥ `matchMedia` 미지원 환경 폴백(라이트)

### Implementation for User Story 3

- [X] T021 [US3] `lib/store.tsx`에 `matchMedia('(prefers-color-scheme: dark)')` 구독 추가 (T020 GREEN) — `change` 이벤트를 저장된 선택이 없는 동안만 유효 테마에 반영, 언마운트 시 구독 해제, `matchMedia` 부재 시 구독 생략(라이트 폴백)

**Checkpoint**: 세 스토리 모두 독립 동작 — 전체 기능 완성

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 회귀 확인과 실구동 검증(헌법 원칙 V — 타입체크·테스트 통과만으로 완료 선언 금지)

- [X] T022 전체 회귀: `npm run test:run` — 기존 52개 + 신규 전부 경고 0으로 통과 확인 (헌법 VI 완료 기준)
- [X] T023 quickstart.md 시나리오 A–E 실구동 검증 — `npm run dev`로 토글 즉시성(A), 강새로고침 깜빡임 0(B), OS 에뮬레이션(C), 엣지(D: 손상값·초기화 보존·다크 4화면 순회·키보드), 대비 수치 확인(E). 로그인 필요 화면은 OAuth 가능 환경에서, 불가 시 `/login`·스플래시 범위 + 자동 테스트로 갈음(quickstart §0)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 의존 없음
- **Foundational (Phase 2)**: Phase 1 뒤 — 모든 스토리를 블로킹 (T003→T004 순서, T002는 병렬)
- **User Stories (Phase 3–5)**: Phase 2 완료 후. US1이 MVP이자 최우선. US2·US3는 서로 독립이며 US1의 store 확장(T007)에만 의존
- **Polish (Phase 6)**: 원하는 스토리 완료 후

### User Story Dependencies

- **US1 (P1)**: Foundational만 필요 — 다른 스토리 의존 없음
- **US2 (P2)**: T007(store의 theme 존재)에 의존. US1의 CSS와는 무관하게 검증 가능
- **US3 (P3)**: T002(matchMedia 경계)와 T007에 의존. US2와 독립

### Within Each User Story

- 테스트(RED) 확인 후에만 구현(GREEN) — 실패를 눈으로 확인하는 단계 생략 금지
- store(모델) → 컴포넌트 → 화면 삽입 → CSS 순
- 각 태스크 또는 논리 단위마다 커밋

### Parallel Opportunities

- Phase 2: T002 ∥ T003 (다른 파일)
- US1 테스트: T005 ∥ T006 / US1 삽입: T009 ∥ T010 (T008 뒤)
- US2 테스트: T015 ∥ T016
- US2와 US3는 팀이 있다면 병렬 진행 가능 (T007 이후)

---

## Parallel Example: User Story 1

```bash
# RED 단계 — 두 테스트 파일 동시 작성:
Task: "lib/store.test.tsx에 테마 상태 테스트 추가 (T005)"
Task: "components/ThemeToggle.test.tsx 작성 (T006)"

# GREEN 뒤 화면 삽입 동시 진행:
Task: "components/Rail.tsx에 ThemeToggle 삽입 (T009)"
Task: "app/me/page.tsx 레일에 ThemeToggle 삽입 (T010)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 → Phase 2 (T001–T004)
2. Phase 3: US1 (T005–T014)
3. **STOP and VALIDATE**: quickstart 시나리오 A + 다크 4화면 순회 — 이 시점에 "토글로 어두운 화면에서 글 쓰기"가 완결
4. 이후 새로고침 시 테마가 풀리는 것은 US2가 해결(정상 — US1 범위 밖)

### Incremental Delivery

1. US1 → 검증 → MVP (토글 전환)
2. US2 → 검증 (유지 + 깜빡임 0)
3. US3 → 검증 (OS 존중)
4. Polish → 전체 회귀 + 실구동 A–E

---

## Notes

- 신설 토큰(T011·T012)은 T014에서 DESIGN.md 반영과 함께 사용자 보고 필수(헌법 원칙 I)
- 인라인 스크립트(T017–T018)는 store 게이트웨이의 문서화된 예외 — plan.md Complexity Tracking 참조. localStorage **쓰기**는 어디서도 store 밖에서 하지 않는다
- `GoogleLogo.tsx`의 브랜드색 4개는 의도적으로 미변경(research.md D3-4) — 다크 QA에서 "잔재"로 오인 금지
- 커밋은 태스크 단위, 각 checkpoint에서 스토리 독립 검증 가능
