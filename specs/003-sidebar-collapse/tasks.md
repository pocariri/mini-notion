# Tasks: 사이드바 접기/펼치기

**Input**: Design documents from `/specs/003-sidebar-collapse/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/store-api.md, contracts/rail-component.md, quickstart.md

**Tests**: TDD is MANDATORY per the project constitution (Principle VI). Every behavior-bearing task has a test task written and failing FIRST (RED) before its implementation task (GREEN). CSS 선언값(폭·transition·툴팁 시각·reduced-motion)은 jsdom에서 검증 불가하므로 클래스·속성 단언까지 자동화하고 시각 결과는 quickstart 실기동으로 검증한다(plan.md Constitution Check VI 예외 근거).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

기존 Next.js 단일 앱 구조(`app/`, `components/`, `lib/`, 저장소 루트). 테스트는 소스 옆 co-locate (`*.test.tsx`).

---

## Phase 1: Setup

**Purpose**: 베이스라인 확인 — 신규 인프라 없음(기존 앱, 의존성 추가 0개)

- [X] T001 `npm run test:run`으로 베이스라인 그린 확인(52개 통과 상태에서 시작해야 신규 실패가 전부 이번 작업 소산임이 보장됨)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: US1·US2가 공통으로 딛는 폭 토큰화 — 행동 불변 리팩터링

**⚠️ CRITICAL**: US1의 CSS 작업(V-1 후반)이 이 토큰 위에서 이루어지므로 선행 필수

- [X] T002 `app/globals.css`: `:root`에 `--rail-width: 260px` 추가, `.rail`의 `width:260px` 리터럴(globals.css:281)을 `var(--rail-width)`로, ≤1024px 미디어쿼리(globals.css:1110)의 `width:220px`를 `--rail-width: 220px` 재정의로 교체(contracts/rail-component.md V-1 전반부). 행동 불변 확인: `npm run test:run` 그린 + 두 뷰포트에서 레일 폭 육안 확인

**Checkpoint**: 폭이 토큰에서 파생 — 사용자 스토리 구현 시작 가능

---

## Phase 3: User Story 1 - 사이드바를 접어 읽기 공간 확보하기 (Priority: P1) 🎯 MVP

**Goal**: 토글 버튼 클릭으로 레일이 260px ↔ 56px(아이콘 전용)를 오가고, 접힌 동안에도 내비게이션이 동작하며, 확보 공간이 본문으로 넘어간다 (FR-001~005, 013~015a).

**Independent Test**: 워크스페이스에서 토글 클릭 → 접힘·본문 확장 확인, 재클릭 → 복원 확인, 접힌 채 내비 아이콘 클릭 → 목록 전환 확인 (quickstart Q-1~Q-6).

### Tests for User Story 1 (MANDATORY - TDD, Constitution Principle VI) ⚠️

> **NOTE: 작성 후 `npm run test:run`으로 실패(RED)를 눈으로 확인한 뒤에만 구현 착수**

- [X] T003 [P] [US1] `lib/store.test.tsx`에 추가: `sidebarCollapsed` 초기값 `false`(S-1), `toggleSidebar()` 호출마다 반전(S-2). 기존 `renderHook` 하니스 재사용 — RED 확인
- [X] T004 [P] [US1] `components/Rail.test.tsx` 신규(Editor.test.tsx 패턴 — 프로바이더 없이 noop 콜백 직접 렌더): 토글 버튼이 `collapsed` 양쪽 값에서 렌더되고 접근 가능한 이름 "사이드바 접기/펼치기"를 가지며(C-1·C-2 이름 부분) 레일의 첫 번째 버튼이고(C-1), 클릭 시 `onToggleCollapse` 정확히 1회 호출(C-3) — RED 확인
- [X] T005 [US1] `components/Rail.test.tsx`에 접힘 렌더 계약 추가: `collapsed=true`면 루트 클래스 `rail collapsed`(C-4), 내비 버튼 4개가 `aria-label`(NAV_LABELS)을 갖고 클릭 시 `onNav` 호출·`.active` 유지(C-5·C-6), 라벨·카운트가 `span.navitem-label`·`.count`로 래핑(C-6), `.rail-search` 대신 `aria-label="검색"` 버튼이 렌더되고 클릭 시 `onToggleCollapse` 호출(C-7), 푸터 링크 존속(C-9) — RED 확인

### Implementation for User Story 1

- [X] T006 [P] [US1] `lib/store.tsx`: `sidebarCollapsed` useState(false) + `toggleSidebar` 콜백을 `Store` 타입·`useMemo` value 객체·의존성 배열에 추가(contracts/store-api.md — 이 단계는 인메모리만, 영속화는 US2) → T003 GREEN
- [X] T007 [P] [US1] `components/Rail.tsx`: props에 `collapsed`/`onToggleCollapse` 추가, `.brand`에 토글 버튼(lucide `PanelLeftClose`/`PanelLeftOpen` size 15, `aria-label="사이드바 접기/펼치기"`, 레일 첫 버튼 위치), 루트 `className` 분기, 내비 라벨 `<span className="navitem-label">` 래핑 + 버튼 `aria-label={NAV_LABELS[key]}`, 접힘 시 검색 아이콘 버튼(`aria-label="검색"`) 렌더 — 클릭 시 `onToggleCollapse` 호출 후 ref로 검색 input 포커스(FR-015·015a) → T004·T005 GREEN
- [X] T008 [P] [US1] `app/globals.css`: `--rail-width-collapsed: 56px` 토큰(V-1 후반), `.rail.collapsed { width: var(--rail-width-collapsed) }`, `.rail`에 `transition: width var(--dur-base) var(--ease-standard)`(V-2), 접힘 숨김 규칙 — `.brand-name`·`.section-label`·`.navitem-label`·`.count`·`.rail-username`·`.gear`·`.rail-search` 숨김, 아이콘·아바타 중앙 정렬, `.brand` 세로 스택(V-5). 본문 확장은 flex 자연 동작(V-6, 추가 규칙 없음)
- [X] T009 [US1] `app/workspace/page.tsx`: `useStore()`에서 `sidebarCollapsed`/`toggleSidebar`를 꺼내 `<Rail collapsed onToggleCollapse>` 배선 (T006·T007 의존)
- [ ] T010 [US1] 체크포인트 검증: `npm run test:run` 전체 그린 + `npm run dev`로 quickstart.md Q-1~Q-6 실기동 통과(헌법 원칙 V — 테스트 통과만으로 완료 선언 금지)

**Checkpoint**: US1 단독으로 완전 동작 — MVP. 이 시점에 데모 가능

---

## Phase 4: User Story 2 - 선택한 사이드바 상태가 유지되기 (Priority: P2)

**Goal**: 접힘 상태가 `mini-notion:sidebar-collapsed` 키로 저장되어 새로고침·화면 이동·재로그인 후에도 복원되고, 손상값은 조용히 펼침으로 복구된다 (FR-006~008, 016~017).

**Independent Test**: 접은 뒤 새로고침 → 접힘 유지, `/me` 왕복 → 접힘 유지, 손상값 주입 → 펼침 복구 (quickstart Q-7~Q-10).

### Tests for User Story 2 (MANDATORY - TDD, Constitution Principle VI) ⚠️

- [X] T011 [US2] `lib/store.test.tsx`에 영속화 계약 추가(in-memory `MemoryStorage` 실물로 왕복 검증, 목 금지): 토글 후 `localStorage['mini-notion:sidebar-collapsed'] === 'true'`(S-3), 사전 저장값 `'true'`면 하이드레이션 후 `sidebarCollapsed === true`(S-4), `'"garbage"'`·`'1'`·비 JSON이어도 예외 없이 `false`(S-5), auth 세션 이벤트(`fire()`) 전후 값 불변 + 키에 uid 미포함(S-6), `ready` 전 write-through 미실행(S-7), `resetAll()` 후 키 존속(S-8) — RED 확인
- [X] T012 [P] [US2] `components/Rail.test.tsx`는 변경 없음을 확인(영속화는 store 소관 — Rail이 localStorage를 만지면 계약 위반이므로 Rail 소스에 `localStorage` 문자열이 없음을 단언하는 회귀 가드는 두지 않고 코드 리뷰로 확인). 이 태스크는 검증 전용 — 신규 테스트 없음, 기존 스위트 그린 유지 확인

### Implementation for User Story 2

- [X] T013 [US2] `lib/store.tsx`: 모듈 상수 `SIDEBAR_KEY = 'mini-notion:sidebar-collapsed'`, 기존 마운트 이펙트(store.tsx:142-166)에서 `setSidebarCollapsed(loadJSON(SIDEBAR_KEY) === true)` 하이드레이션(정규화 규칙: data-model.md), posts 패턴과 동일한 `ready` 게이트 write-through 이펙트 추가(store.tsx:195-198 형태), `resetAll` 불변 → T011 GREEN
- [X] T014 [US2] `app/me/page.tsx`: 워크스페이스와 동일 배선(FR-008) + `/me`도 `ready` 게이트 뒤에서만 레일을 페인트해 FR-016(플래시 없음)이 성립하는지 소스에서 확인, 아니면 동일 게이트 적용
- [ ] T015 [US2] 체크포인트 검증: `npm run test:run` 전체 그린 + quickstart.md Q-7~Q-10 실기동 통과(새로고침 플래시 육안 확인 포함)

**Checkpoint**: US1+US2 동작 — 상태가 화면 이동·재방문을 넘어 유지됨

---

## Phase 5: User Story 3 - 키보드·보조기술로 토글 사용하기 (Priority: P3)

**Goal**: 키보드만으로 토글에 도달·실행 가능하고, 버튼이 상태를 AT에 노출하며(aria-expanded), 접힌 아이콘의 라벨이 호버·포커스 툴팁으로 보이고, 모션 축소 설정이 존중된다 (FR-009~012, 014 툴팁).

**Independent Test**: Tab ≤5회로 토글 도달 → Enter로 전환 → 포커스 링·툴팁·aria 상태 확인, OS 모션 축소 시 즉시 전환 (quickstart Q-11~Q-14, §3 VoiceOver).

### Tests for User Story 3 (MANDATORY - TDD, Constitution Principle VI) ⚠️

- [X] T016 [US3] `components/Rail.test.tsx`에 a11y 계약 추가: 토글이 `aria-expanded={!collapsed}`를 정확히 반영(C-2), 키보드 실행(Enter/Space)이 클릭과 동일하게 `onToggleCollapse` 호출(FR-009, user-event 사용), 접힘 상태에서 토글·검색·내비 4개·푸터 링크가 `data-tip`을 갖고 내비 `data-tip`은 카운트 포함(예: `전체 글 (3)`), 푸터는 `마이 페이지`(C-8) — RED 확인

### Implementation for User Story 3

- [X] T017 [US3] `components/Rail.tsx`: 토글에 `aria-expanded={!collapsed}` 추가, 접힘 상태 아이콘 조작부에 `data-tip` 속성 부여(내비는 `count !== undefined ? `${label} (${count})` : label`, 푸터 `마이 페이지`, 검색 `검색`, 토글 `사이드바 접기/펼치기`) → T016 GREEN
- [X] T018 [US3] `app/globals.css`: 툴팁 CSS — `.rail.collapsed [data-tip]:hover::after`·`:focus-visible::after`에 `content: attr(data-tip)`, 스타일은 기존 토큰만(`--surface-inverse` 배경·`#fff` 텍스트·`--radius-sm`·`--text-2xs`·`--shadow-md`)(V-4); 기존 `@media (prefers-reduced-motion: reduce)` 블록(globals.css:758)에 `.rail { transition: none }` 추가(V-3); 전역 포커스 링이 토글·아이콘 버튼에 보이는지 확인(FR-009, 신규 작업 없어야 정상)
- [ ] T019 [US3] 체크포인트 검증: `npm run test:run` 전체 그린 + quickstart.md Q-11~Q-14 실기동 + §3 VoiceOver 스팟 체크("확장됨/축소됨" 낭독 확인)

**Checkpoint**: 세 스토리 모두 독립 동작 — 기능 완성

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 문서 동기화(헌법 게이트)·정리·최종 검증

- [X] T020 [P] `DESIGN.md` 동기화(헌법 원칙 I NON-NEGOTIABLE 게이트): §3에 `--rail-width`/`--rail-width-collapsed` 토큰, §5.4에 collapsed 상태·토글 버튼·툴팁 패턴(해부·수치·상태 표 형식 유지), §6.2 3-pane 폭 기술 갱신, §7(DESIGN.md:604) 모션 규칙에 `--dur-base` 첫 사용 기록. §5.13 반응형 라인 인용 드리프트(1025-1038 → 실제 1109-1121)도 이 기회에 수정
- [X] T021 리팩터링 패스(그린 유지): `components/Rail.tsx`·`lib/store.tsx`·`app/globals.css`에서 중복·네이밍 정리, 접힘 분기 렌더 단순화 여지 확인 — 각 변경 후 `npm run test:run` 그린 확인
- [ ] T022 최종 검증: `npm run test:run` 경고 0으로 전체 그린 + quickstart.md 전체(Q-1~Q-14, §3, §4 문서 체크리스트) 통과 확인 후 완료 선언(헌법 원칙 V·VI 완료 기준)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 의존성 없음 — 즉시 시작
- **Foundational (Phase 2)**: T001 이후. **US1을 블록**(US2·US3는 간접 의존)
- **US1 (Phase 3)**: T002 이후. 다른 스토리 비의존
- **US2 (Phase 4)**: T002 이후 시작 가능하나 T006(store 상태)·T009(배선)를 딛으므로 실질적으로 US1 이후 권장. US1과 파일이 겹침(`lib/store.tsx`, `lib/store.test.tsx`)
- **US3 (Phase 5)**: T007(Rail 구조) 이후. US2와 파일 비중복이므로 US2와 병렬 가능
- **Polish (Phase 6)**: 원하는 스토리 전부 완료 후

### User Story Dependencies

- **US1 (P1)**: Foundational만 의존 — 독립 MVP
- **US2 (P2)**: US1의 store 상태(T006) 위에 영속화를 얹음 — US1 완료 후 착수
- **US3 (P3)**: US1의 Rail 구조(T007) 위에 aria·툴팁을 얹음 — US1 완료 후 착수, US2와 병렬 가능

### Within Each User Story

- 테스트(RED 확인) → 구현(GREEN) → 체크포인트(실기동) 순서 엄수
- store(모델) → Rail(컴포넌트) → page(배선) 순서

### Parallel Opportunities

- T003 ‖ T004 (다른 파일: store.test vs Rail.test)
- T006 ‖ T007 ‖ T008 (다른 파일: store.tsx vs Rail.tsx vs globals.css — 계약이 클래스명을 고정하므로 병행 안전)
- US2(T011~T015) ‖ US3(T016~T019) (파일 비중복: store 계열 vs Rail·CSS 계열 — 단 T016·T012가 같은 Rail.test.tsx를 만지므로 T012는 검증 전용으로 충돌 없음)
- T020 ‖ T021 (DESIGN.md vs 소스)

---

## Parallel Example: User Story 1

```bash
# RED 단계 — 두 테스트 파일 동시 작성:
Task: "T003 store 기본값·토글 테스트 in lib/store.test.tsx"
Task: "T004 Rail 토글 버튼 테스트 in components/Rail.test.tsx"

# GREEN 단계 — 세 파일 동시 구현:
Task: "T006 sidebarCollapsed/toggleSidebar in lib/store.tsx"
Task: "T007 토글·접힘 렌더 분기 in components/Rail.tsx"
Task: "T008 토큰·collapsed·transition·숨김 규칙 in app/globals.css"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1(T001) → Phase 2(T002) 완료
2. Phase 3: T003·T004 병렬(RED) → T005(RED) → T006·T007·T008 병렬(GREEN) → T009 → T010 실기동
3. **STOP & VALIDATE**: quickstart Q-1~Q-6 — 이 시점에 사용자 요청("버튼 클릭으로 접기/펼치기")이 완전히 충족된 데모 가능 상태
4. 이후 스토리는 증분

### Incremental Delivery

1. Setup+Foundational → 토큰 기반 확보
2. US1 → 실기동 검증 → **MVP 데모 가능**
3. US2 → 새로고침·화면 이동 유지 검증
4. US3 → 키보드·AT·모션 축소 검증
5. Polish → DESIGN.md 동기화 + 최종 검증 후 완료 선언

### Parallel Team Strategy

혼자 작업 기준 순차(US1 → US2 ‖ US3 → Polish)가 기본. 2인이라면 US1 완료 후 A가 US2(store 계열), B가 US3(Rail·CSS 계열)를 병렬 진행 — 파일 경계가 겹치지 않는다.

---

## Notes

- [P] = 다른 파일·미완료 태스크 비의존
- 모든 테스트 태스크는 구현 전 RED를 **눈으로** 확인해야 한다(올바른 이유로 실패하는지 포함 — 헌법 원칙 VI Iron Law)
- 태스크 단위 또는 논리 단위마다 커밋
- 각 체크포인트에서 멈추고 스토리 독립 검증 가능
- `Rail.tsx`는 localStorage·useStore 접근 금지(계약 위반) — 위반 발견 시 즉시 수정
