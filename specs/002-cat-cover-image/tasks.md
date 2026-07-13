# Tasks: 랜덤 고양이 커버 이미지 (Random Cat Cover Image)

**Input**: Design documents from `/specs/002-cat-cover-image/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: TDD is MANDATORY per the project constitution (Principle VI). 모든 동작 구현 태스크는 실패 테스트(RED)를 먼저 작성·확인한 뒤에만 진행한다. jsdom 경계(이미지 네트워크 로드)는 `fireEvent.load/error` 디스패치로 검증한다(research.md D6).

**Organization**: 스토리별 독립 구현·검증이 가능하도록 유저 스토리 단위로 묶는다. CSS·문서 동기화처럼 jsdom으로 검증 불가능한 시각 계층은 quickstart.md 실구동 검증으로 커버한다(헌법 V).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능(다른 파일, 미완료 태스크 의존 없음)
- **[Story]**: 소속 유저 스토리(US1, US2, US3)
- 모든 태스크에 정확한 파일 경로 명시

## Path Conventions

기존 단일 Next.js 앱 구조(plan.md Project Structure): 컴포넌트와 co-located 테스트는 `components/`, 전역 스타일·토큰은 `app/globals.css`, 디자인 문서는 `DESIGN.md`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 이후 RED 판정의 기준선 확보. 이 기능은 신규 의존성·설정이 없으므로 베이스라인 확인만 한다.

- [x] T001 `npm run test:run`으로 기존 테스트 전체(그린) 통과를 확인해 베이스라인 확보 — 이후 실패는 전부 신규 테스트에 의한 것임을 보장 (경고 있으면 먼저 보고)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 없음 — 이 기능은 기존 앱 인프라(테스트 하니스, 디자인 토큰 체계, Editor 구조)를 그대로 사용한다. DB·인증·라우팅 등 선행 기반 작업이 존재하지 않는다.

**Checkpoint**: T001 완료 즉시 유저 스토리 구현 시작 가능

---

## Phase 3: User Story 1 - 글을 열면 제목 위에 고양이 커버가 보인다 (Priority: P1) 🎯 MVP

**Goal**: 에디터의 제목 입력창 위에 cataas 랜덤 고양이 이미지가 커버로 표시되고, 글 전환 시 새로 로드되며, 편집 중 재요청이 발생하지 않는다 (FR-001, FR-002, FR-006~009).

**Independent Test**: 워크스페이스에서 글을 열어 제목 위 커버에 고양이 사진이 표시되는지, 글 전환 시 새 이미지가 로드되는지 확인 (quickstart.md 시나리오 A).

### Tests for User Story 1 (MANDATORY - TDD, Constitution Principle VI) ⚠️

> **NOTE: 테스트를 먼저 작성하고, 구현 전에 반드시 실패(RED)를 눈으로 확인한다**

- [x] T002 [US1] RED: `components/CatCover.test.tsx` 신규 작성 — 실패 테스트: (a) `data-testid="cover-image"` `<img>`의 `src`가 `https://cataas.com/cat/cute`로 시작하고 `width=760`과 `r=` 캐시버스터 쿼리를 포함(contracts/catcover-component.md), (b) `fireEvent.load` 후 이미지가 표시 상태, (c) 리렌더(rerender) 시 `src` 불변(재요청 없음), (d) 이미지 `alt=""`(장식). `npm run test:run`으로 "컴포넌트 부재"로 실패함을 확인

### Implementation for User Story 1

- [x] T003 [US1] GREEN: `components/CatCover.tsx` 최소 구현 — props 없는 클라이언트 컴포넌트. `useState` 초기화 함수로 마운트 시 1회 nonce 생성해 `src` 고정(research.md D2), 고정 크기 `.cover` 컨테이너 + `.cover-img` `<img alt="" data-testid="cover-image" onLoad=...>`(상태 머신은 data-model.md). T002 통과·기존 테스트 그린 확인
- [x] T004 [US1] RED: `components/Editor.test.tsx`에 통합 실패 테스트 추가 — (a) Editor 렌더 시 커버 이미지가 존재하고 DOM 순서상 제목 입력창(placeholder "제목 없음")보다 앞, (b) 다른 `post.id`로 rerender하면 커버 `src`가 바뀜(key 리마운트, FR-007/008), (c) 휴지통 글(`deletedAt` 설정)에서도 커버 렌더. 실패 확인
- [x] T005 [US1] GREEN: `components/Editor.tsx` 수정 — `.detail-toolbar`(및 trash-banner) 다음, `.title-input` 바로 앞에 `<CatCover key={post.id} />` 삽입(contracts/catcover-component.md 배치 계약). T004 통과·기존 카운터 테스트 회귀 없음 확인
- [x] T006 [P] [US1] `app/globals.css`에 `.cover`·`.cover-img` 스타일 추가 — `.cover`: `width:100%`, `height:180px`, `margin:0 0 18px`, `border-radius:var(--radius-lg)`, `overflow:hidden`; `.cover-img`: `width/height:100%`, `object-fit:cover`, `display:block`. 전 값이 기존 토큰·스케일 준수(매직 컬러 금지, 헌법 I)

**Checkpoint**: US1 단독으로 완결 동작 — `npm run dev`로 quickstart.md 시나리오 A 확인 가능 (MVP)

---

## Phase 4: User Story 2 - 로딩 중에는 스켈레톤이 자리를 지킨다 (Priority: P2)

**Goal**: 이미지 도착 전까지 커버 자리에 스피너 없는 스켈레톤이 표시되고, 로드 완료 시 같은 자리에서 이미지로 교체되며 레이아웃 시프트가 없다 (FR-003, FR-004).

**Independent Test**: 네트워크 스로틀링(Slow 3G) 상태로 글을 열어 스켈레톤 표시·스피너 부재·교체 시 무시프트를 확인 (quickstart.md 시나리오 B).

### Tests for User Story 2 (MANDATORY - TDD, Constitution Principle VI) ⚠️

- [x] T007 [US2] RED: `components/CatCover.test.tsx`에 실패 테스트 추가 — (a) 마운트 직후(`load` 이벤트 전) `data-testid="cover-skeleton"` 표시 + 이미지는 숨김 상태, (b) 스켈레톤에 `aria-hidden="true"`, (c) `fireEvent.load` 후 스켈레톤 제거 + 이미지 표시, (d) 회전 스피너 요소 부재. 실패 확인

### Implementation for User Story 2

- [x] T008 [US2] GREEN: `components/CatCover.tsx`에 `loading` 상태 분기 구현 — `CoverLoadState('loading'→'loaded')` 전이(data-model.md), loading 동안 `.cover-skeleton` 렌더 + `.cover-img` 숨김(이미지는 DOM에 유지해 load 이벤트 수신). T007 통과 확인
- [x] T009 [P] [US2] `app/globals.css`에 스켈레톤 스타일 + 신규 토큰 추가 — `:root` 모션 스케일에 `--dur-shimmer: 1400ms` 추가(research.md D4), `.cover-skeleton`: `background:var(--gray-100)`, `--gray-100↔--gray-150` pulse 키프레임 애니메이션(`var(--dur-shimmer)`), `@media (prefers-reduced-motion: reduce)`에서 애니메이션 제거·정적 표시

**Checkpoint**: US1+US2 동작 — quickstart.md 시나리오 B 확인 가능

---

## Phase 5: User Story 3 - 이미지 로드에 실패해도 편집은 멀쩡하다 (Priority: P3)

**Goal**: 로드 실패 시 스켈레톤이 조용한 중립 폴백으로 전환되고, 오류 팝업 없이 편집 기능이 그대로 동작한다 (FR-005).

**Independent Test**: DevTools Offline 상태로 글을 열어 폴백 전환·편집 정상 동작을 확인 (quickstart.md 시나리오 C).

### Tests for User Story 3 (MANDATORY - TDD, Constitution Principle VI) ⚠️

- [x] T010 [US3] RED: `components/CatCover.test.tsx`에 실패 테스트 추가 — (a) `fireEvent.error` 후 `data-testid="cover-fallback"` 표시 + 스켈레톤·이미지 부재, (b) 폴백에 `aria-hidden="true"`, (c) 오류 텍스트/alert 부재(조용한 폴백). 실패 확인

### Implementation for User Story 3

- [x] T011 [US3] GREEN: `components/CatCover.tsx`에 `error` 상태 구현 — `onError`로 `'loading'→'error'` 전이, `.cover-fallback`(중앙 lucide `Cat` 아이콘) 렌더. T010 통과 확인
- [x] T012 [P] [US3] `app/globals.css`에 `.cover-fallback` 스타일 추가 — `background:var(--gray-100)`, `border:1px solid var(--border-subtle)`, 중앙 정렬, `color:var(--text-disabled)` (contracts/catcover-component.md 스타일 계약)

**Checkpoint**: 세 스토리 모두 독립 동작 — quickstart.md 시나리오 C 확인 가능

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 문서 동기화(헌법 I 의무), 회귀 가드, 리팩터링, 최종 검증

- [x] T013 [P] `DESIGN.md` 동기화 — §3.9에 `--dur-shimmer` 토큰 행 추가(합계 91→92 갱신), §5에 "커버(CatCover)" 컴포넌트 하위 섹션 신설(해부·토큰·상태·React 동작), §5.8 에디터 해부 구조에 `.cover` 반영, §6.2 워크스페이스 화면 설명 갱신 (헌법 I — 기능 완료 선언 전 필수)
- [x] T014 [P] `components/Editor.test.tsx`에 회귀 가드 테스트 추가 — (a) 커버 로딩 중(load 이벤트 전) 제목 타이핑이 즉시 반영(FR-006/SC-003), (b) 커버 error 후에도 내용 편집·카운터 정상(SC-004). ※ 구성상 처음부터 통과하는 가드 테스트임을 주석으로 명시(TDD 드라이버가 아닌 회귀 방지 목적)
- [x] T015 리팩터링 패스 — 그린 유지 상태에서 `components/CatCover.tsx`·`components/Editor.tsx` 정리(중복 제거·네이밍), 동작 추가 금지 (Red-Green-**Refactor**)
- [x] T016 전체 검증: `npm run test:run` 전체 테스트 경고 없이 통과 확인 (헌법 VI 완료 기준)
- [x] T017 실구동 검증: `npm run dev`로 quickstart.md 시나리오 A~D 전부 수행·확인 (헌법 V — 타입체크·빌드 통과만으로 완료 선언 금지)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 의존 없음 — 즉시 시작
- **Foundational (Phase 2)**: 태스크 없음 — T001 후 바로 스토리 진행
- **User Stories (Phase 3~5)**: 각 스토리는 독립 검증 가능하나, 세 스토리가 같은 파일(`CatCover.tsx`/`CatCover.test.tsx`)을 다루므로 **한 세션에서는 우선순위 순서(US1 → US2 → US3) 순차 진행을 권장**
- **Polish (Phase 6)**: 원하는 스토리 완료 후. T013·T014는 병렬 가능, T015 → T016 → T017 순서

### User Story Dependencies

- **US1 (P1)**: T001 이후 시작. 다른 스토리 의존 없음 — 단독 MVP
- **US2 (P2)**: 개념상 독립(컴포넌트 loading 상태만 다룸). 같은 파일을 수정하므로 US1 뒤 진행 권장
- **US3 (P3)**: 동일 — US2 뒤 진행 권장

### Within Each User Story (TDD 사이클)

- RED 태스크(실패 확인)가 끝나기 전에 해당 GREEN 태스크 시작 금지
- 컴포넌트 테스트(T002) → 컴포넌트 구현(T003) → 통합 테스트(T004) → 통합 구현(T005) 순서 유지 — T004를 T003보다 먼저 쓰면 import 에러로 "잘못된 이유의 실패"가 됨
- CSS 태스크(T006/T009/T012)는 같은 스토리의 GREEN 태스크와 병렬 가능(다른 파일)

### Parallel Opportunities

```text
US1: T005 (Editor.tsx)   ∥  T006 (globals.css)
US2: T008 (CatCover.tsx) ∥  T009 (globals.css + 토큰)
US3: T011 (CatCover.tsx) ∥  T012 (globals.css)
Polish: T013 (DESIGN.md) ∥  T014 (Editor.test.tsx)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1(T001)로 베이스라인 확보
2. Phase 3(T002~T006) 완료 → **STOP & VALIDATE**: quickstart.md 시나리오 A로 US1 단독 검증
3. 이 시점에 이미 데모 가능한 MVP (커버 표시 + 전환 재로드; 로딩 상태는 빈 고정 박스)

### Incremental Delivery

1. US1 → 시나리오 A 검증 (MVP: 고양이 커버 표시)
2. US2 → 시나리오 B 검증 (스켈레톤 로딩 경험)
3. US3 → 시나리오 C 검증 (실패 내성)
4. Polish → DESIGN.md 동기화 + 시나리오 D(엣지) 포함 전체 검증 후 완료 선언

### 주의 (Notes)

- 각 태스크(또는 논리 단위) 후 커밋 권장
- `lib/store.tsx`·`localStorage`는 어떤 태스크에서도 건드리지 않는다(헌법 III, FR-009)
- CSS 값은 전부 기존 토큰 참조 — 새 매직 값 발견 시 즉시 토큰화 검토(헌법 I)
- T013(DESIGN.md)과 T017(실구동 검증)을 건너뛰고 완료 선언하는 것은 헌법 위반
