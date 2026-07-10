---

description: "Task list for 내용 글자 수 카운터 (Content Character Counter)"
---

# Tasks: 내용 글자 수 카운터 (Content Character Counter)

**Input**: Design documents from `/specs/001-content-char-count/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/counter-ui.md

**Tests**: TDD is MANDATORY (Constitution Principle VI). Every behavior-bearing task has a test task written and confirmed FAILING (RED) before its implementation task (GREEN).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 (Setup·Foundational·Polish have no story label)
- Exact file paths are included in each description.

## Path Conventions

단일 Next.js 앱(저장소 루트 = `03-notion/10-notion-harness`). 소스는 `lib/`, `components/`, `app/`에 위치하고, 테스트는 대상 소스 옆에 `*.test.ts(x)`로 co-locate 한다(헌법 기술 제약).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 기준선 확인. 이 기능은 클라이언트 전용 파생값이라 신규 의존성·설정이 없다.

- [X] T001 기준선 확인: 저장소 루트에서 `npm run test:run`을 실행해 기존 테스트가 모두 통과(green)함을 확인하고, 신규 패키지 설치가 필요 없음을 확인한다(plan.md: 신규 의존성 0).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 두 사용자 스토리가 공통으로 의존하는 순수 계산 함수 `charCount`. 표시(US1)와 재계산(US2) 모두 이 함수를 통해 값을 얻는다.

**⚠️ CRITICAL**: 이 단계가 끝나야 US1/US2 구현을 시작할 수 있다.

- [X] T002 `lib/format.test.ts`에 `charCount` **실패 테스트**를 추가한다 — contracts/counter-ui.md C1-1~C1-5: `""`→`0`, `"안녕하세요"`→`5`, `"a b\nc"`→`5`, `"  "`→`2`, `"👍"`→`2`. `npm run test:run`으로 **RED**(구현 부재로 실패)을 확인한다.
- [X] T003 `lib/format.ts`에 `export function charCount(text: string): number { return text.length }`를 구현한다. `npm run test:run`으로 T002가 통과(**GREEN**)함을 확인한다. (T002에 의존)

**Checkpoint**: `charCount` 준비 완료 — 사용자 스토리 구현 시작 가능.

---

## Phase 3: User Story 1 - 작성 중 글자 수 실시간 확인 (Priority: P1) 🎯 MVP

**Goal**: 내용 입력 칸에 타이핑하는 동안 편집 영역 우측 하단에 `N자` 카운터가 실시간으로 갱신되며 보인다.

**Independent Test**: 글 하나를 열고 내용 칸에 입력·삭제하면 우측 하단 카운터가 즉시 해당 글자 수(`N자`)로 바뀌는지 확인.

### Tests for User Story 1 (MANDATORY - TDD, Constitution Principle VI) ⚠️

> 먼저 작성하고 **FAIL(RED)** 확인 후 구현한다.

- [X] T004 [US1] `components/Editor.test.tsx`(신규)에 US1 **실패 컴포넌트 테스트**를 작성한다(@testing-library/react + user-event). 케이스: 빈 내용 → `0자`(C2-1), 내용 `"안녕하세요"` → `5자`(C2-2), 내용 칸에 타이핑 시 카운터 즉시 갱신(C2-3, `post.content`를 상태로 보유하고 `onPatch`로 갱신하는 소형 테스트 하네스로 감싸 `userEvent.type` 검증), 제목만 변경 시 카운터 불변(C2-5). 필수 props는 `makePost`/no-op 핸들러 헬퍼로 제공. `npm run test:run`으로 **RED** 확인.

### Implementation for User Story 1

- [X] T005 [US1] `components/Editor.tsx`에서 `@/lib/format`의 `charCount`를 import 하고, `.detail-inner` 안 `.content-input`(textarea) **바로 뒤**에 `<div className="content-counter">{charCount(post.content)}자</div>`를 렌더한다. (T004의 렌더 테스트가 통과하게 됨)
- [X] T006 [P] [US1] `app/globals.css`에 `.content-counter` 규칙을 추가한다(신규 토큰 금지 — 원칙 I): `position: sticky; bottom: 16px; margin-left: auto; width: fit-content; margin-top: 12px; padding: 4px 10px;` + `font-family: var(--font-mono); font-size: var(--text-2xs); color: var(--text-tertiary); background: var(--surface-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-pill); box-shadow: var(--shadow-xs);`. (`.detail`이 스크롤 컨테이너이므로 sticky가 편집 영역 하단에 고정됨)
- [X] T007 [US1] `npm run test:run` 실행 — US1 컴포넌트 테스트 + Foundational + 기존 스위트가 모두 통과(**GREEN**)하고 회귀가 없음을 확인한다.
- [X] T008 [P] [US1] `DESIGN.md` §5.8(Detail/editor) 해부에 `.content-counter`를 동기화한다 — 구조 위치(`.detail-inner` 내 `.content-input` 뒤), sticky 배치, 사용 토큰(mono/2xs/tertiary/surface-card/border-subtle/radius-pill/shadow-xs)을 기록해 코드와 문서를 일치시킨다.

**Checkpoint**: US1 단독으로 완전 동작·테스트 가능 = **MVP 완성**(보이는 실시간 카운터).

---

## Phase 4: User Story 2 - 기존 글의 글자 수 확인 (Priority: P2)

**Goal**: 이미 작성된 글을 열거나 다른 글로 전환하면, 입력 없이도 카운터가 그 글의 글자 수를 즉시 표시한다(휴지통 읽기 전용 글 포함).

**Independent Test**: 내용이 있는 기존 글을 선택/전환하면 타이핑 없이 카운터가 올바른 `N자`를 표시하고, 휴지통 글을 열어도 카운터가 보이는지 확인.

> **Note**: US1의 카운터는 `post.content`를 무조건 렌더하므로 US2 동작 상당수가 US1 구현에서 자연히 성립한다. TDD 원칙에 따라 US2 테스트를 먼저 작성해 실제로 통과/실패를 확인하고, 실패 시에만 최소 구현을 추가한다.

### Tests for User Story 2 (MANDATORY - TDD, Constitution Principle VI) ⚠️

- [X] T009 [P] [US2] `components/Editor.test.tsx`에 US2 테스트를 추가한다: (a) 내용이 있는 post를 타이핑 없이 렌더하면 올바른 `N자` 표시, (b) 다른 `post`로 **rerender**하면 카운터가 새 글자 수로 갱신(C2-6), (c) `deletedAt !== null`(휴지통·readOnly) post도 카운터를 표시(C2-7). `npm run test:run` 실행해 어떤 케이스가 **RED**인지 기록한다.

### Implementation for User Story 2

- [X] T010 [US2] `components/Editor.tsx`에서 카운터가 **모든 post 상태(readOnly/휴지통 포함)** 에 대해 무조건 렌더되고 post 전환 시 현재 `post.content`를 반영하도록 보장한다. T009의 실패 케이스를 통과(**GREEN**)시킨다. (US1에서 이미 무조건 렌더 중이면 변경 불필요임을 확인하고 테스트 통과를 기록)

**Checkpoint**: US1·US2 모두 독립적으로 동작.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 전체 검증과 동작 확인(원칙 V).

- [X] T011 [P] `npm run test:run` 전체 재실행 — 신규 + 기존 테스트 전부 통과, 회귀 0, 그리고 각 신규 테스트가 구현 전 올바른 이유로 실패했었음(TDD 증거)을 확인한다.
- [X] T012 quickstart.md 검증을 `npm run dev`로 수행한다(시나리오 A~I): 실시간 갱신, 빈 내용 `0자`, 긴 글 스크롤 시 카운터 고정 가시성(FR-001), 제목 무관(FR-006), 글 전환 갱신(FR-005), 휴지통 표시, 공백·줄바꿈 계산. 신규 색·매직값이 없음(토큰만 사용, 원칙 I)을 함께 확인한다.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 의존성 없음 — 즉시 시작.
- **Foundational (Phase 2)**: Setup 완료 후. **모든 사용자 스토리를 차단**(공유 `charCount`).
- **US1 (Phase 3)**: Foundational 완료 후. MVP.
- **US2 (Phase 4)**: US1의 카운터 요소(T005)를 재사용하므로 US1 구현에 의존(같은 UI의 확장). Foundational 완료 필수.
- **Polish (Phase 5)**: US1(및 원하면 US2) 완료 후.

### Within Each User Story

- 테스트(RED)를 구현(GREEN)보다 먼저 작성·확인.
- US1: T004(RED) → T005 + T006(구현) → T007(GREEN 확인) → T008(문서 동기화).
- US2: T009(RED) → T010(GREEN).

### Parallel Opportunities

- **Foundational**: T002 → T003 순차(RED→GREEN, 병렬 아님).
- **US1**: T005(Editor.tsx)와 T006(globals.css)는 서로 다른 파일 → **[P] 병렬 가능**. T008(DESIGN.md)도 다른 파일 → 구현 후 **[P]** 진행 가능.
- **US2**: T009는 독립 테스트 파일 편집 → [P].
- **Polish**: T011(테스트)·T012(dev 육안)는 별개 프로세스.

---

## Parallel Example: User Story 1

```bash
# RED 확인(T004) 후, 구현 두 파일을 병렬로:
Task: "T005 [US1] components/Editor.tsx에 .content-counter 요소 추가"
Task: "T006 [P] [US1] app/globals.css에 .content-counter 스타일 추가"
# 이어서 GREEN 확인(T007), 문서 동기화(T008 [P]) 진행
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup(T001) → Phase 2 Foundational(T002–T003, `charCount` RED→GREEN).
2. Phase 3 US1(T004 RED → T005/T006 구현 → T007 GREEN → T008 문서).
3. **STOP & VALIDATE**: 실행 앱에서 실시간 카운터를 확인(quickstart A~E). 여기까지가 배포 가능한 MVP.

### Incremental Delivery

1. Setup + Foundational → 공유 함수 준비.
2. US1 → 실시간·가시 카운터(MVP) → 데모.
3. US2 → 기존 글/전환/휴지통 표시 검증(대부분 US1에서 성립) → 데모.
4. Polish → 전체 테스트 + 실제 구동 검증.

---

## Notes

- [P] = 서로 다른 파일, 미완 태스크에 대한 의존 없음.
- 각 신규 테스트는 구현 전 **RED**를 눈으로 확인해야 함(원칙 VI).
- 신규 의존성·저장소(localStorage) 변경·디자인 토큰 추가 **0개**.
- US2는 US1 UI의 확장이라 독립 구현이 아닌 US1 위에 쌓이는 검증 중심 단계다.
- 태스크 또는 논리 단위마다 커밋 권장. 체크포인트에서 스토리 단독 검증 가능.
