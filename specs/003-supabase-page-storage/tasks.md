---

description: "Task list for 페이지 서버 저장 및 소유자별 접근 제어"
---

# Tasks: 페이지 서버 저장 및 소유자별 접근 제어

**Input**: Design documents from `specs/003-supabase-page-storage/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: TDD는 헌법 원칙 VI에 따라 **의무**다. 동작을 갖는 모든 작업은 구현 전에 실패하는 테스트를 먼저 작성하고, 그 실패를 **눈으로 확인**한 뒤 구현한다(RED → GREEN → REFACTOR). 테스트 작업은 선택이 아니다.

**Organization**: 작업은 사용자 스토리별로 묶여 각 스토리를 독립적으로 구현·테스트할 수 있다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (다른 파일, 선행 의존 없음)
- **[Story]**: 소속 사용자 스토리 (US1~US4)
- 모든 작업에 정확한 파일 경로를 포함한다

## Path Conventions

이 저장소는 단일 Next.js 앱이다. 백엔드 디렉터리가 없다 — DB가 곧 백엔드이고 RLS가 곧 인가 계층이다.

- 스토어(유일한 영속성 게이트웨이): `lib/store.tsx`
- 테스트: 대상 소스 옆에 co-locate (`lib/store.test.tsx`, `components/Editor.test.tsx`)
- 화면: `app/workspace/page.tsx`, 컴포넌트: `components/`
- 스타일: `app/globals.css` (토큰은 `:root`)
- DB: 마이그레이션 디렉터리 없음. `contracts/rls-policies.sql`을 MCP `execute_sql`로 적용

## ⚠️ 두 종류의 검증

이 기능에는 성격이 다른 검증 둘이 있다. 섞으면 안 된다.

| 종류 | 도구 | 검증 대상 |
|---|---|---|
| **자동 테스트** | `npm run test:run` (Vitest + 대역) | 스토어 로직, UI 동작, 디바운스, 롤백 |
| **실제 DB 검증** | 실제 Supabase (MCP / 브라우저 콘솔) | **RLS 소유자 격리** |

**목(mock)은 RLS를 검증하지 못한다**(research.md R6). 대역은 in-memory 객체일 뿐 정책이 옳은지 전혀 알려주지 않는다. `[DB]` 표시가 붙은 작업은 실제 DB에 대해 수행하며, 생략하면 이 기능의 핵심 보안 요구(FR-007)가 미검증으로 남는다.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 착수 기준선 확보

- [X] T001 워크트리에 `.env.local`이 있는지 확인하고 없으면 원본 체크아웃에서 복사 (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — `.env.example` 참조). 시크릿 파일이므로 사용자가 직접 처리한다
- [X] T002 `npm run test:run`으로 기준선 확인 — 착수 시점 5파일 52테스트 전부 통과. 실패가 있으면 이 기능 착수 전에 원인을 밝힌다
- [ ] T003 소유자 격리 검증용 Google 계정 2개(A·B) 확보. 계정 하나로는 US2·US4를 검증할 수 없다

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 사용자 스토리의 전제. RLS 정책, 축소된 데이터 모델, 테스트 대역.

**⚠️ CRITICAL**: 이 단계가 끝나기 전엔 어떤 스토리도 시작할 수 없다.

**⚠️ 순서 주의**: T004(정책)를 가장 먼저 한다. 정책이 없으면 `public.page`는 RLS 활성 + 정책 0개로 **모든 접근이 거부**되어 실제 DB에 대해 아무것도 확인할 수 없다.

### RLS 정책 — 실제 DB

- [X] T004 [DB] `specs/003-supabase-page-storage/contracts/rls-policies.sql`의 정책 4개를 MCP `execute_sql`로 `public.page`에 적용 — SELECT(FR-004), INSERT(FR-002·FR-003), UPDATE(FR-006, `using`+`with check` 둘 다), DELETE(FR-005). 소유권을 저장소 층에서 강제하는 지점이다(FR-007). `to authenticated` 명시 필수, `anon` 대상 정책은 만들지 않는다. `using (true)` 절대 금지 — `anon`에 전체 GRANT가 열려 있어 곧바로 전면 노출된다(research.md R3). **칼럼 구성은 건드리지 않는다** — 정책 추가는 구조 변경이 아니다(FR-009)
- [X] T005 [DB] 검증 V1: `select policyname, cmd, roles, qual, with_check from pg_policies where schemaname='public' and tablename='page'` → 4행, 전부 `roles={authenticated}`, `anon` 대상 0개, UPDATE 행은 `qual`·`with_check` **둘 다** 채워져 있어야 한다
- [X] T006 [DB] 검증 V2: Supabase security advisor 실행 → `public.page`의 `rls_enabled_no_policy` 경고 해소 확인. (`rls_auto_enable` WARN 2건과 leaked password WARN은 이 기능과 무관한 기존 경고이므로 남아 있어도 정상 — research.md R11)

### 기능 축소 — 확정된 저장 구조에 자리가 없는 것 제거

> 이 묶음은 **localStorage 상태를 유지한 채** 진행한다. 즐겨찾기·휴지통·수정시각만 걷어내 앱이 계속 동작하는 중간 상태를 만든다. 저장소 교체(US1)와 섞지 않아야 리뷰가 가능하다(원칙 V).
>
> TDD 주석: 이 묶음은 신규 동작이 아니라 **삭제**다. 제거되는 기능의 테스트를 먼저 지우고 구현을 지운 뒤, 남은 테스트가 전부 통과하는지 확인한다.

- [X] T007 `lib/store.test.tsx`에서 즐겨찾기·휴지통·복원 관련 테스트를 삭제하고 `npm run test:run`으로 나머지가 통과하는지 확인
- [X] T008 `lib/store.tsx`에서 `toggleFavorite`·`trashPost`·`restorePost`를 제거하고 `deletePostForever`를 `deletePost`로 정리. `Post` 타입에서 `favorite`·`deletedAt` 필드 삭제
- [X] T009 `lib/store.tsx`의 `Post` 타입에서 `updatedAt` 삭제, `updatePost`에서 `updatedAt` 갱신 제거 (FR-013)
- [X] T010 [P] `components/Rail.tsx`에서 `NavKey`를 `'all'` 단일 값으로 축소하고 `favorites`·`recent`·`trash` 항목·아이콘·라벨 제거. `Star`·`Clock`·`Trash2` import 정리 (FR-012, research.md R7 — `recent`는 `updatedAt` 제거로 `all`과 동일해지므로 함께 사라진다)
- [X] T011 [P] `components/Editor.tsx`에서 즐겨찾기 칩, 휴지통 배너, 복원·영구삭제 버튼, `doc-meta`의 "수정 {시각}", `save-state`의 시각 표시 제거. `inTrash` 분기 전체 삭제
- [X] T012 [P] `components/Editor.test.tsx`에서 제거된 UI(즐겨찾기·휴지통·수정시각)를 검증하던 테스트 삭제
- [X] T013 `app/workspace/page.tsx`에서 `filterPosts`의 4갈래 switch를 검색 필터만 남기고 제거. `counts`에서 `favorites`·`trash` 제거, 리스트로우의 별 아이콘·`trash-row-actions`·nav별 날짜 분기 제거 (FR-011 — 항상 `createdAt` 내림차순)
- [X] T014 [P] `app/globals.css`에서 죽은 스타일 제거: `.listrow-meta .star`, `.trash-row-actions`, `.trash-banner`, `.chip.on`(즐겨찾기 전용인 경우)
- [ ] T015 [P] `DESIGN.md` §5.4(내비 4→1)·§5.7(별·trash-row-actions 제거, 날짜 규칙 단일화)·§5.8(즐겨찾기 칩·휴지통 배너·수정시각 제거)·§8(데이터 모델) 동기화 — CLAUDE.md 규칙상 코드 변경과 같은 작업에서 처리
- [X] T016 `npm run test:run` 통과 확인. 이 시점의 앱은 여전히 localStorage로 동작하되 즐겨찾기·휴지통·수정시각이 없다

### 용어 통일 및 테스트 대역

- [X] T017 `Post` → `Page` 기계적 이름 변경 (`lib/store.tsx`, `lib/store.test.tsx`, `components/Editor.tsx`, `components/Editor.test.tsx`, `app/workspace/page.tsx`): `Post`→`Page`, `posts`→`pages`, `createPost`→`createPage`, `updatePost`→`updatePage`, `deletePost`→`deletePage`. 동작 변경 없음 (Q5 결정)
- [X] T018 `lib/store.test.tsx`의 `dbMock`에 `page` 테이블 in-memory 대역 추가 — 실제 칼럼(`id`, `created_at`, `title`, `content`, `user_id`)을 그대로 반영하고 `select().eq().order()`, `insert().select().single()`, `update().eq()`, `delete().eq()` 체인을 지원. 실패 주입(`selectError`/`insertError`/`updateError`/`deleteError`) 포함 (research.md R6, 기존 `profile` 대역 방식 확장)

**Checkpoint**: 정책이 서 있고, 데이터 모델이 DB 구조와 일치하며, 대역이 준비됐다. 스토리 착수 가능.

---

## Phase 3: User Story 1 - 내 페이지가 계정에 저장된다 (Priority: P1) 🎯 MVP

**Goal**: 페이지가 브라우저가 아니라 사용자 계정에 보관된다. 기기·브라우저를 바꿔도, 브라우저 데이터를 지워도 페이지가 남는다.

**Independent Test**: A 계정으로 페이지를 작성하고 localStorage를 전부 비운 뒤 재로그인했을 때 페이지가 그대로 보이면 통과 (quickstart C1).

### Tests for User Story 1 (MANDATORY - TDD, Constitution Principle VI) ⚠️

> **먼저 작성하고, 구현 전에 실패를 눈으로 확인한다 (RED → GREEN → REFACTOR)**

- [X] T019 [US1] `lib/store.test.tsx`에 목록 로드 테스트 작성 — 로그인 시 `page` 테이블을 읽고 `pagesStatus`가 `loading → ready`로 전이하며 `createdAt` 내림차순으로 정렬됨 (FR-001, FR-011, FR-020)
- [X] T020 [US1] `lib/store.test.tsx`에 로딩·빈·실패 3상태 구분 테스트 작성 — `loading` 중에는 빈 상태로 판정되지 않고, 로드 실패 시 `pagesStatus='error'`가 되며 빈 목록과 구분됨 (FR-021, SC-009)
- [X] T021 [US1] `lib/store.test.tsx`에 생성 낙관적 갱신 테스트 작성 — `createPage()`가 서버 응답 전에 목록 맨 앞에 행을 추가하고 id를 반환하며, insert 실패 시 그 행을 제거하고 `notice`를 설정함 (FR-018, FR-022, FR-023)
- [X] T022 [US1] `lib/store.test.tsx`에 자동 저장 디바운스 테스트 작성 — `vi.useFakeTimers()`로 연속 입력이 800ms 후 **1회** 저장으로 합쳐짐을 검증 (FR-016, SC-010)
- [X] T023 [US1] `lib/store.test.tsx`에 flush 테스트 작성 — `flushPending()`이 대기 중인 저장을 지연 없이 즉시 실행함 (FR-017)
- [X] T024 [US1] `lib/store.test.tsx`에 저장 실패 테스트 작성 — update 실패 시 **사용자 입력을 되돌리지 않고** `saveStatus='error'`만 설정함. 입력 내용이 유지되는지 반드시 확인 (FR-024)
- [X] T025 [US1] `lib/store.test.tsx`에 응답 역전 테스트 작성 — 같은 페이지의 저장 응답이 순서를 바꿔 도착해도 마지막 입력이 최종 상태로 남음 (research.md R5)
- [X] T026 [US1] `lib/store.test.tsx`에 빈 페이지 자동 삭제 테스트 작성 — `discardIfEmpty(id)`가 `title===''&&content===''`일 때만 삭제하고 확인을 묻지 않음 (FR-019)
- [X] T027 [US1] `lib/store.test.tsx`에 레거시 정리 테스트 작성 — 초기화 시 `mini-notion:posts` 키가 제거되고 그 내용이 목록에 나타나지 않음 (FR-014)
- [X] T028 [US1] `npm run test:run` 실행 → T019~T027이 **올바른 이유로 실패**하는지 눈으로 확인. 실패를 보지 않은 테스트는 무엇을 검증하는지 알 수 없다

### Implementation for User Story 1

- [X] T029 [US1] `lib/store.tsx`에 `Page` 모델과 매핑 구현 — DB `created_at`(timestamptz) → `createdAt`(epoch ms), `title`/`content`의 NULL → `''` 정규화. 확정된 5칼럼만 사용하고 새 칼럼을 요구하지 않는다 (FR-009, data-model.md §2)
- [X] T030 [US1] `lib/store.tsx`에 `pagesStatus`(`loading`/`ready`/`error`) 상태와 uid 변경 시 목록 로드 `useEffect` 구현 — `.select().eq('user_id', uid).order('created_at', {ascending:false})`. 기존 `profile` 로드 패턴을 따른다 (research.md R1)
- [X] T031 [US1] `lib/store.tsx`에서 `seedPosts`·`hadStoredPosts`·`POSTS_KEY` 저장 `useEffect` 제거하고 `mini-notion:posts` 레거시 키 정리 추가 — 기존 `LEGACY_USER_KEY`·`LEGACY_OVERLAY_PREFIX` 정리 코드 옆에 나란히 (FR-014, research.md R10)
- [X] T032 [US1] `lib/store.tsx`에 `createPage` 구현 — `crypto.randomUUID()`로 id 생성, 즉시 목록 추가 후 id 반환, `insert().select().single()`로 확정 `created_at` 교체, 실패 시 제거 + `notice` (FR-018, FR-022, FR-023, research.md R4)
- [X] T033 [US1] `lib/store.tsx`에 `updatePage` + 800ms 디바운스 + `flushPending` 구현 — 본인 페이지의 제목·내용 수정을 서버에 보관(FR-006), 메모리 즉시 갱신, 페이지별 세대 카운터로 응답 역전 방지, 실패 시 입력 유지 + `saveStatus='error'` (FR-016, FR-017, FR-022, FR-024, research.md R5)
- [X] T034 [US1] `lib/store.tsx`에 `discardIfEmpty` 구현 — 제목·내용이 모두 빈 경우에만 삭제, 확인 없음 (FR-019)
- [X] T035 [US1] `lib/store.tsx`에 `notice`/`dismissNotice` 구현 (FR-023, contracts/store-api.md)
- [X] T036 [US1] `npm run test:run`으로 T019~T027 통과 확인 (GREEN)
- [X] T037 [P] [US1] `app/globals.css`에 `.listrow-skeleton` 추가 — 기존 `cover-pulse` 키프레임과 `--dur-shimmer`·`--gray-100`/`--gray-150` 재사용, `.listrow`의 박스 수치(`padding:10px 12px`, `--radius-lg`, `--border-subtle`)를 그대로 써 레이아웃 시프트 방지. **신규 토큰 금지** (FR-020, research.md R8, 헌법 원칙 I)
- [X] T038 [P] [US1] `app/globals.css`에 `.list-error`(불러오기 실패)와 `.list-notice`(롤백 알림) 추가 — 기존 토큰만 사용 (FR-008, FR-023, research.md R9)
- [X] T039 [US1] `app/workspace/page.tsx`에 스켈레톤·빈 상태·실패 표시 연결 — `pagesStatus==='loading'`이면 스켈레톤만(빈 상태 안내 **금지**), `'error'`면 `.list-error`, `'ready'`이고 0건일 때만 빈 상태 안내 (FR-020, FR-021, SC-009)
- [X] T040 [US1] `app/workspace/page.tsx`에 `notice` 표시와 닫기 연결, 페이지 전환 시 `flushPending()` → `discardIfEmpty(이전 id)` 호출 연결 (FR-017, FR-019, FR-023, contracts/store-api.md 호출자 계약)
- [X] T041 [US1] `components/Editor.tsx`의 `.save-state`를 저장 상태 표시로 확장 — `저장됨`/`저장 중…`/`저장 안 됨` (FR-024, research.md R9)
- [ ] T042 [P] [US1] `DESIGN.md` §5.7에 스켈레톤·`.list-error`·`.list-notice` 상태 추가, §5.8에 `.save-state` 상태 확장 문서화 — 코드 변경과 같은 작업에서 (CLAUDE.md 디자인 규칙)
- [ ] T043 [US1] quickstart C1·C2·C3 수행 — localStorage 비우고 재로그인해도 페이지 유지(SC-002), 저장 후 새로고침 시 내용 그대로(SC-007), Slow 3G에서 빈 상태 번쩍임 없음(SC-009), 연속 타이핑이 1회 요청으로 합쳐짐(SC-010)
- [ ] T044 [US1] 목록 표시 시간 측정 — 정상 네트워크에서 로그인 후 목록이 **2초 이내** 표시되는지 DevTools Network·Performance로 확인. 초과하면 원인을 밝힌다(직렬 왕복 여부 등) (SC-006)

**Checkpoint**: 페이지가 계정에 저장된다. 이 시점에서 멈춰도 핵심 가치가 성립한다 — **MVP**.

---

## Phase 4: User Story 2 - 남의 페이지는 보이지 않는다 (Priority: P1)

**Goal**: 각 사용자는 자신이 작성한 페이지만 볼 수 있다. 다른 사용자의 페이지는 목록·직접 접근 어느 경로로도 열람되지 않는다.

**Independent Test**: A 계정으로 페이지를 작성한 뒤 B 계정으로 로그인해 목록이 비어 있고, B가 A의 페이지 id를 직접 지정해도 열람되지 않으면 통과.

> **격리의 실체는 T004의 RLS 정책**(`using ((select auth.uid()) = user_id)`)이다. 이 단계는 그 보장이 실제로 성립하는지 **실제 DB로 증명**하고, 클라이언트가 격리를 흉내 내지 않는지 확인한다.

### Tests for User Story 2 (MANDATORY - TDD, Constitution Principle VI) ⚠️

- [X] T045 [US2] `lib/store.test.tsx`에 로그아웃 시 목록 비움 테스트 작성 — 세션이 사라지면 `pages`가 `[]`가 되어 이전 사용자의 페이지가 화면에 남지 않음 (FR-010)
- [X] T046 [US2] `lib/store.test.tsx`에 계정 전환 테스트 작성 — uid가 바뀌면 이전 계정의 목록이 즉시 비워지고 새 계정의 목록을 다시 불러옴 (FR-010, SC-003)
- [X] T047 [US2] `npm run test:run` → T045·T046가 올바른 이유로 실패하는지 확인

### Implementation for User Story 2

- [X] T048 [US2] `lib/store.tsx`에서 uid 변경·로그아웃 시 `pages`를 비우고 재로드하도록 구현 (FR-010)
- [X] T049 [US2] `npm run test:run`으로 T045·T046 통과 확인 (GREEN)

### 실제 DB 검증 — 목으로 대체 불가

- [ ] T050 [DB] [US2] quickstart B4 수행 — A로 페이지 작성 후 B로 로그인해 목록에 A의 페이지가 없는지 확인. 이어서 B 콘솔에서 `supabase.from('page').select('*').eq('id','A의-id')` → **`[]` 기대** (SC-003)
- [X] T051 [DB] [US2] 클라이언트가 소유자 필터를 보안으로 쓰지 않는지 `lib/store.tsx` 리뷰 — RLS가 이미 남의 행을 주지 않는다. `.eq('user_id', uid)`는 성능·명확성 용도일 뿐이며, 이것이 유일한 격리 수단이 되어선 안 된다 (FR-007, contracts/store-api.md 불변식 2)

**Checkpoint**: 소유자 격리가 저장소 층에서 성립하고 실제 DB로 증명됐다.

---

## Phase 5: User Story 3 - 로그인해야 페이지를 쓸 수 있다 (Priority: P1)

**Goal**: 로그인하지 않은 사람은 페이지를 만들 수 없고, 만들어진 페이지에는 반드시 작성자가 소유자로 기록된다.

**Independent Test**: 로그아웃 상태에서 페이지 작성을 시도했을 때 페이지가 생성되지 않고 로그인을 요구받으면 통과.

### Tests for User Story 3 (MANDATORY - TDD, Constitution Principle VI) ⚠️

- [X] T052 [US3] `lib/store.test.tsx`에 비로그인 생성 차단 테스트 작성 — `createPage()`가 `null`을 반환하고 목록·DB 어디에도 행을 만들지 않음 (FR-002)
- [X] T053 [US3] `lib/store.test.tsx`에 소유자 기록 테스트 작성 — 생성된 행의 `user_id`가 현재 세션 uid와 일치함 (FR-003)
- [X] T054 [US3] `lib/store.test.tsx`에 세션 만료 저장 거부 테스트 작성 — 편집 중 세션이 사라지면 저장이 거부되고 `saveStatus='error'`가 됨 (FR-024, 스토리 3 시나리오 3)
- [X] T055 [US3] `npm run test:run` → T052~T054이 올바른 이유로 실패하는지 확인

### Implementation for User Story 3

- [X] T056 [US3] `lib/store.tsx`의 `createPage`·`updatePage`에 uid 가드 구현 — uid가 없으면 생성하지 않고 `null` 반환, 저장은 거부 (FR-002, FR-003)
- [X] T057 [US3] `app/workspace/page.tsx`에서 비로그인 상태 처리 확인 — 기존 `/login` 리다이렉트가 이미 있으므로 회귀만 확인 (FR-002)
- [X] T058 [US3] `npm run test:run`으로 T052~T054 통과 확인 (GREEN)

### 실제 DB 검증 — 목으로 대체 불가

- [ ] T059 [DB] [US3] quickstart B3 수행 — **로그아웃 상태**에서 `supabase.from('page').select('*')` → **0행 기대**. 한 줄이라도 나오면 즉시 중단하고 T004 정책을 재점검한다. `anon`에 전체 GRANT가 열려 있어 정책이 유일한 방어선이다 (SC-004, research.md R3)
- [X] T060 [DB] [US3] 비로그인 insert 시도 → 거부 확인 (FR-002, SC-004)

**Checkpoint**: 비로그인 접근이 저장소 층에서 차단됨이 실제 DB로 증명됐다.

---

## Phase 6: User Story 4 - 내 페이지만 삭제할 수 있다 (Priority: P2)

**Goal**: 사용자는 자신의 페이지를 확인 절차를 거쳐 삭제할 수 있고, 다른 사용자의 페이지는 삭제할 수 없다.

**Independent Test**: A가 자신의 페이지를 삭제하면 재로그인해도 없고, B가 A의 페이지 삭제를 시도하면 실패하며 A의 페이지가 그대로 남아 있으면 통과.

### Tests for User Story 4 (MANDATORY - TDD, Constitution Principle VI) ⚠️

- [X] T061 [US4] `lib/store.test.tsx`에 삭제 낙관적 갱신 테스트 작성 — `deletePage(id)`가 서버 응답 전에 목록에서 제거함 (FR-005, FR-022)
- [X] T062 [US4] `lib/store.test.tsx`에 삭제 롤백 테스트 작성 — 삭제 실패 시 그 페이지가 **원래 자리에 복원**되고 `notice`가 설정됨 (FR-023, 스토리 4 시나리오 4)
- [X] T063 [US4] `lib/store.test.tsx`에 스토어가 확인을 묻지 않음을 검증 — `deletePage`는 `window.confirm`을 호출하지 않는다. 확인은 호출자 책임이며, 그래야 `discardIfEmpty`가 확인 없이 삭제할 수 있다 (FR-015, FR-019, contracts/store-api.md)
- [X] T064 [US4] `app/workspace/page.tsx` 테스트에 삭제 확인 게이트 테스트 작성 — 확인을 취소하면 삭제가 일어나지 않고 페이지가 목록에 남음 (FR-015, 스토리 4 시나리오 2)
- [X] T065 [US4] `npm run test:run` → T061~T064이 올바른 이유로 실패하는지 확인

### Implementation for User Story 4

- [X] T066 [US4] `lib/store.tsx`에 `deletePage` 구현 — 즉시 목록 제거, `.delete().eq('id', id)`, 실패 시 원래 위치에 복원 + `notice`. 확인은 묻지 않는다 (FR-005, FR-022, FR-023)
- [X] T067 [US4] `app/workspace/page.tsx`에 삭제 확인 연결 — `window.confirm` 통과 시에만 `deletePage` 호출, 문구는 복원 불가임을 알린다. 선택 중이던 페이지였다면 선택 해제 (FR-015)
- [X] T068 [US4] `components/Editor.tsx`의 삭제 버튼을 `deletePage` 경로로 연결 (FR-005, FR-015)
- [X] T069 [US4] `npm run test:run`으로 T061~T064 통과 확인 (GREEN)

### 실제 DB 검증 — 목으로 대체 불가

- [ ] T070 [DB] [US4] quickstart B5 수행 — B 계정에서 `supabase.from('page').delete().eq('id','A의-id').select()` → **0행 기대**. 이어서 **A로 재로그인해 페이지가 그대로 있는지 확인**. `delete`가 0행을 반환해도 실제로 지워졌는지는 A만 알 수 있다 (SC-005)
- [ ] T071 [DB] [US4] quickstart B6 수행 — A 계정에서 자기 페이지의 `user_id`를 B로 바꾸려 시도 → 거부 기대. `with check` 없이는 남에게 소유권을 떠넘길 수 있다 (research.md R2)

**Checkpoint**: 네 스토리 모두 독립적으로 동작하고 검증됐다.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 잔재 정리, 문서 동기화, 전체 검증

- [X] T072 [P] 죽은 코드 정리 — `lib/format.ts`의 `formatDate`가 여전히 쓰이는지 확인(생성 시각 표시에 필요하므로 유지), 사용되지 않는 lucide 아이콘 import 제거, `app/globals.css`의 미사용 셀렉터 정리
- [ ] T073 [P] `DESIGN.md` §8(데이터 모델)을 최종 상태로 동기화 — `Page` 타입 4필드(`id`/`title`/`content`/`createdAt`), 영속성이 localStorage가 아닌 Supabase임을 반영
- [X] T074 [P] `README.md`에 localStorage 기반 서술이 남아 있으면 갱신
- [X] T075 quickstart A 완주 — `npm run test:run` 전체 통과
- [ ] T076 [DB] quickstart B 완주 — B1~B6 전부 기대대로. **이 항목을 건너뛰고 완료를 선언하지 않는다**
- [ ] T077 quickstart C 완주 — C1~C8 전부 기대대로. 특히 C4(빈 페이지가 DB에 남지 않음), C5(오프라인에서 저장·삭제·로드 실패가 모두 사용자에게 안내되는지 — SC-008), C7(제거된 기능 흔적 없음), C8(새 사용자 빈 목록)
- [ ] T078 기기 간 동기화 확인 — A 계정으로 한 기기(또는 다른 브라우저 프로필)에서 페이지를 작성하고, 다른 기기에서 같은 계정으로 로그인해 그 페이지가 그대로 보이는지 확인. localStorage를 비우는 C1과 달리 **실제로 다른 클라이언트**에서 확인해야 한다 (SC-001, FR-001)
- [ ] T079 `/speckit-constitution`으로 헌법 개정 제안 — 기술 제약 절의 "영속성: 브라우저 localStorage(서버·DB 없음)"와 "인증: 목 인증"이 현재 코드와 어긋난다. MINOR 개정 (plan.md Constitution Check 참조)
- [ ] T080 사용자에게 보고 — Rail 내비가 4개에서 1개로 축소된 결과(research.md R7)와, 이 기능과 무관하지만 실재하는 보안 경고(`public.rls_auto_enable()`이 `SECURITY DEFINER`로 `anon`에게 노출)를 알린다

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 의존 없음. 즉시 시작
- **Foundational (Phase 2)**: Setup 완료 후. **모든 스토리를 차단**
  - T004(정책)가 T005·T006과 이후 모든 `[DB]` 작업을 차단
  - T007~T016(기능 축소)이 T017(이름 변경)을 차단
  - T018(대역)이 US1의 모든 테스트를 차단
- **User Stories (Phase 3~6)**: Foundational 완료 후
  - US1이 US2·US3·US4를 차단한다 — 넷 다 `lib/store.tsx`의 같은 페이지 상태·낙관적 갱신 기반 위에 서기 때문이다. 스펙상으로는 독립 슬라이스지만, 이 저장소에서는 단일 게이트웨이(원칙 III)라 파일이 겹친다
  - US2·US3·US4는 US1 완료 후 서로 병렬 가능
- **Polish (Phase 7)**: 원하는 스토리 전부 완료 후

### User Story Dependencies

- **US1 (P1)**: Foundational 후 시작. 다른 스토리에 의존하지 않음 → **MVP**
- **US2 (P1)**: US1의 페이지 로드 경로 필요. 격리 자체는 T004 정책이 이미 제공하므로 이 단계는 증명과 로그아웃 처리
- **US3 (P1)**: US1의 `createPage` 필요. 차단 자체는 T004의 `to authenticated`가 제공
- **US4 (P2)**: US1의 낙관적 갱신·`notice` 기반 필요

### Within Each User Story

- 테스트를 먼저 작성하고 **실패를 눈으로 확인**한 뒤 구현 (원칙 VI)
- 스토어(`lib/store.tsx`) → 화면(`app/workspace/page.tsx`, `components/`) → 스타일(`app/globals.css`) → 문서(`DESIGN.md`)
- 자동 테스트 GREEN 후 `[DB]` 실검증

### Parallel Opportunities

- **Phase 2**: T010·T011·T012·T014·T015가 서로 다른 파일이라 병렬 가능. 단 T007~T009(`lib/store.tsx`·`lib/store.test.tsx`)를 먼저 끝내야 한다
- **Phase 3**: T037·T038(CSS)과 T042(DESIGN.md)가 스토어 작업과 병렬 가능. T019~T027은 모두 `lib/store.test.tsx` 한 파일이므로 **병렬 불가**
- **Phase 4~6**: US1 완료 후 세 스토리 병렬 가능
- **Phase 7**: T072·T073·T074 병렬 가능

> **주의**: 이 저장소는 영속 상태를 `lib/store.tsx` 한 파일에 모으므로(원칙 III), 스토어를 건드리는 작업은 대부분 직렬이다. 병렬 여지는 주로 UI·CSS·문서 쪽이다.

---

## Parallel Example: Phase 2 기능 축소

```bash
# T007~T009 (lib/store.tsx, lib/store.test.tsx) 완료 후, 서로 다른 파일이므로 동시 진행:
Task: "components/Rail.tsx에서 NavKey를 'all' 단일 값으로 축소"        # T010
Task: "components/Editor.tsx에서 즐겨찾기 칩·휴지통 배너 제거"          # T011
Task: "components/Editor.test.tsx에서 제거된 UI 테스트 삭제"           # T012
Task: "app/globals.css에서 죽은 스타일 제거"                          # T014
Task: "DESIGN.md §5.4·§5.7·§5.8·§8 동기화"                          # T015
```

## Parallel Example: Phase 3 US1 표면 작업

```bash
# 스토어 구현(T029~T036)과 병렬로:
Task: "app/globals.css에 .listrow-skeleton 추가 (cover-pulse 재사용)"   # T037
Task: "app/globals.css에 .list-error / .list-notice 추가"              # T038
Task: "DESIGN.md §5.7·§5.8 상태 문서화"                               # T042
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup 완료
2. Phase 2 Foundational 완료 — **정책(T004)이 가장 먼저**. 없으면 아무것도 동작하지 않는다
3. Phase 3 US1 완료
4. **멈추고 검증**: quickstart C1(localStorage 비우고 재로그인해도 페이지 유지)
5. 이 시점에 "페이지가 계정에 안전하게 저장된다"는 핵심 가치가 성립

### Incremental Delivery

1. Setup + Foundational → 정책·모델·대역 준비
2. US1 → 독립 검증 → **MVP**
3. US2 → 소유자 격리 실증 → 배포 가능
4. US3 → 비로그인 차단 실증
5. US4 → 삭제 + 롤백
6. Polish → 문서 동기화 + 전체 검증

### 이 기능 고유의 주의

- **T004를 미루지 않는다.** `public.page`는 RLS 활성 + 정책 0개라 전면 거부 상태다. 정책 없이 US1을 짜면 모든 호출이 실패하고 원인이 코드인지 정책인지 구분할 수 없다
- **`[DB]` 작업을 자동 테스트로 대체하지 않는다.** 대역은 RLS를 검증하지 못한다(research.md R6). 특히 T059(비로그인 select 0행)은 이 기능에서 가장 중요한 단일 검증이다 — `anon`에 전체 GRANT가 열려 있기 때문이다
- **Phase 2의 기능 축소를 저장소 교체와 섞지 않는다.** 축소는 localStorage 상태를 유지한 채 끝내 앱이 계속 동작하게 한다. 두 변화를 한 덩어리로 만들면 리뷰가 불가능하다(원칙 V)

---

## Notes

- `[P]` = 다른 파일, 선행 의존 없음
- `[DB]` = 실제 Supabase에 대한 검증. 목으로 대체 불가
- `[Story]` 라벨로 작업과 스토리를 추적
- **구현 전 테스트 실패를 반드시 눈으로 확인** (원칙 VI). 실패를 본 적 없는 테스트는 무엇을 검증하는지 알 수 없다
- 작업 단위 또는 논리적 묶음마다 커밋
- 체크포인트에서 멈춰 스토리를 독립 검증할 수 있다
- 피해야 할 것: 모호한 작업, 같은 파일 동시 편집, 스토리 독립성을 깨는 교차 의존
