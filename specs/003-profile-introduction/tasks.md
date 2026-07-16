# Tasks: 자기소개 (Profile Introduction)

**Input**: Design documents from `/specs/003-profile-introduction/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: TDD is MANDATORY per the project constitution (Principle VI). 모든 동작 구현 태스크는 실패 테스트(RED)를 먼저 작성·확인한 뒤에만 진행한다. Supabase 경계만 목으로 두고(store.test.tsx 기존 방침), 조회 실패 경로는 `dbMock`의 `selectError` 스위치로, 하이드레이션 경쟁은 지연 응답 목으로 구동한다(research.md D8).

**Organization**: 스토리별 독립 구현·검증이 가능하도록 유저 스토리 단위로 묶는다. 이 기능은 소스 2파일(`lib/store.tsx`, `app/me/page.tsx`)에 집중되므로 스토리 간 병렬 작업은 제한적이며, 순차(P1→P2→P3) 진행이 안전하다. CSS 등 jsdom으로 검증 불가한 시각 계층은 quickstart.md 실구동 검증으로 커버한다(헌법 V).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능(다른 파일, 미완료 태스크 의존 없음)
- **[Story]**: 소속 유저 스토리(US1, US2, US3)
- 모든 태스크에 정확한 파일 경로 명시

## Path Conventions

기존 단일 Next.js 앱 구조(plan.md Project Structure): 저장소 게이트웨이와 co-located 테스트는 `lib/`, 페이지와 co-located 테스트는 `app/me/`, 전역 스타일·토큰은 `app/globals.css`, 디자인 문서는 `DESIGN.md`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 이후 RED 판정의 기준선 확보. 이 기능은 신규 의존성·설정·DB 변경이 없으므로 베이스라인 확인만 한다.

- [x] T001 `npm run test:run`으로 기존 테스트 전체(그린) 통과를 확인해 베이스라인 확보 — 이후 실패는 전부 신규 테스트에 의한 것임을 보장 (경고 있으면 먼저 보고)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 저장소 게이트웨이(`lib/store.tsx`) 확장 — 세 스토리 전부가 의존하는 기반. introduction 배관(US1·US2의 전제)과 profileStatus/retryProfile(US1 하이드레이션 게이트·US3 오류 UI의 전제)을 여기서 완성한다(contracts/store-gateway.md).

**⚠️ CRITICAL**: 이 페이즈 완료 전에는 어떤 유저 스토리도 시작할 수 없다

- [x] T002 RED: `lib/store.test.tsx` — `dbMock`을 `introduction` 필드 포함으로 확장하고 실패 테스트 추가: (a) 프로필 조회가 `name, image, introduction` 3컬럼을 요청하고 행의 `introduction`이 `user.introduction`으로 파생(R1·R2, data-model §2), (b) 행 부재 시 `user.introduction === null`이며 오류 아님(R3), (c) `updateUser({ introduction })` 페이로드에 introduction 반영·null 전달 가능(W3), (d) introduction 없는 patch(별명만 저장)에서 기존 introduction 유지(W4), (e) upsert 페이로드가 `{ user_id, name, image, introduction }` 4필드 전체(W5). `npm run test:run`으로 실패 확인
- [x] T003 GREEN: `lib/store.tsx` — introduction 배관 최소 구현: `Profile`·`User` 타입에 `introduction: string | null` 추가, select 컬럼 확장(`'name, image, introduction'`), `updateUser`의 next 구성에 `'introduction' in patch ? (patch.introduction ?? null) : (profile?.introduction ?? null)` 추가, user 메모에 `introduction: profile?.introduction ?? null` 파생(data-model §2·§5). T002 통과·기존 테스트 그린 확인
- [x] T004 RED: `lib/store.test.tsx` — `dbMock`에 `selectError` 스위치를 추가하고 실패 테스트 추가: (a) 조회 성공 시 `profileStatus`가 `'loading'→'ready'` 전이(R2·R3), (b) 조회 실패 시 `'error'` 전이— 현재 버려지는 select error를 상태로 노출(R4), (c) uid 변경 시 `'loading'` 리셋(R5), (d) `retryProfile()` 호출로 재조회되어 성공 시 `'ready'`·데이터 반영(R6), (e) `profileStatus !== 'ready'`일 때 `updateUser`가 upsert 없이 한국어 오류를 반환(W2 — 조회 실패 상태 저장은 DB 행을 구글 기본값으로 덮어쓰는 경로이므로 차단). 실패 확인
- [x] T005 GREEN: `lib/store.tsx` — `profileStatus: 'loading' | 'ready' | 'error'` 상태와 `retryProfile()` 구현: 조회 effect를 재시도 가능한 구조(refetch 카운터 등)로 확장, `.then(({ data, error }))`로 오류 수신, cancelled 가드 유지(R7), Store 타입·context value에 두 항목 노출, `updateUser` 선두에 not-ready 가드(W2). T004 통과·기존 테스트 그린 확인

**Checkpoint**: 게이트웨이 계약(R1~R7, W1~W7) 충족 — 유저 스토리 구현 시작 가능

---

## Phase 3: User Story 1 - 마이페이지에서 자기소개를 등록하고, 다시 열면 그대로 보인다 (Priority: P1) 🎯 MVP

**Goal**: `/me` 프로필 탭에 자기소개 여러 줄 입력란이 생기고, 저장하면 `public.profile.introduction`에 보관되며, 재진입 시 저장값이 입력란에 채워진다 (FR-001·002·008·010·011). 폼 하이드레이션을 프로필 조회 완료에 게이트해, 스파이크로 재현된 "구글 기본값이 DB 값을 덮어쓰는" 경쟁을 함께 수정한다(research.md D2 — 이 수정 없이는 FR-008이 성립하지 않는다).

**Independent Test**: 자기소개 입력 → 저장 → 새로고침 → 같은 내용(줄바꿈 포함)이 채워져 있는지 확인 (quickstart.md §2 US1).

### Tests for User Story 1 (MANDATORY - TDD, Constitution Principle VI) ⚠️

> **NOTE: 테스트를 먼저 작성하고, 구현 전에 반드시 실패(RED)를 눈으로 확인한다**

- [x] T006 [US1] RED: `app/me/page.test.tsx` 신규 작성 — `app/login/page.test.tsx` 스타일(hoisted routerMock + `@/lib/supabase` 목 + 실제 StoreProvider + userEvent). 목은 지연 응답(`setTimeout 0`)과 uid별 행(`{ name, image, introduction }`)·`selectError` 스위치를 지원. 실패 테스트: (a) `aria-label="자기소개"` textarea가 별명 필드 아래 존재하고 `maxLength=150`·`rows=3`·placeholder 보유(contracts/me-profile-form.md anatomy), (b) **하이드레이션 게이트** — DB 행 `{ name: 'DB별명', introduction: 'DB소개' }`가 지연 도착해도 폼이 최종적으로 DB 값으로 채워지고 구글 기본값이 아님(D2 스파이크의 정식 승격, FR-008), (c) 줄바꿈 포함 여러 줄 입력이 값에 보존(FR-002), (d) 자기소개 입력 후 저장 클릭 → upsert 페이로드에 trim된 introduction 포함 + "저장되었습니다." 표시(FR-010·011), (e) 별명 input에 `aria-label="별명"` 존재(D7). 실패 확인
- [x] T007 [P] [US1] `app/globals.css` — `.field` 블록(:1017 인근)에 추가: `.field-multi { flex-direction: column; align-items: stretch; }`, `.field-multi .counter { align-self: flex-end; }`, `.field textarea { border: none; outline: none; resize: none; background: transparent; padding: 0; width: 100%; font-size: var(--text-base); line-height: var(--lh-relaxed); }`, `.field textarea::placeholder { color: var(--text-tertiary); }` — 전부 기존 토큰, 신규 토큰 0개(헌법 I). `.field input`에 병기 금지(`--fw-semibold` 상속 방지, research.md D4)

### Implementation for User Story 1

- [x] T008 [US1] GREEN: `app/me/page.tsx` — 자기소개 필드 구현: `MAX_INTRODUCTION = 150` 상수, `introduction` state, 별명 `.field-block` 아래에 계약 anatomy대로 `<label className="field field-multi">` + textarea(`rows={3}`, `maxLength`, `aria-label`, placeholder "자신을 간단히 소개해 보세요.") + `.counter`(`#{introduction.length}/150`) + hint("150자까지 남길 수 있어요."), 별명 input에 `aria-label="별명"`. **하이드레이션 게이트**: 초기화 effect 조건을 `user && profileStatus === 'ready' && !hydrated`로, 스플래시 조건을 `!ready || !user || profileStatus === 'loading'`으로 변경, 초기값 `user.introduction ?? ''`. `dirty`에 `introduction !== (user.introduction ?? '')` 추가(F2), 저장 게이트에 `profileStatus !== 'ready'` 추가(F4), 저장 페이로드 `introduction: introTrimmed === '' ? null : introTrimmed`(F5), 성공 시 trim 값 되메움(F6). T006 통과·기존 테스트 그린 확인

**Checkpoint**: US1 단독으로 완결 동작(등록·조회 MVP) — `npm run dev`로 quickstart.md §2 US1 확인 가능

---

## Phase 4: User Story 2 - 등록한 자기소개를 수정하거나 비울 수 있다 (Priority: P2)

**Goal**: 기존 자기소개의 수정·전체 삭제(→ NULL 저장)가 가능하고, 별명·이미지와 원자적으로 함께 저장되며, 계정 초기화 시 자기소개도 지워진다 (FR-005~007·009·014·015).

**Independent Test**: 수정 저장 → 새 내용 확인, 전부 지우고 저장 → DB에 NULL + placeholder 복귀, 초기화 → 자기소개 소거 (quickstart.md §2 US2).

### Tests for User Story 2 (MANDATORY - TDD, Constitution Principle VI) ⚠️

- [x] T009 [US2] RED: `app/me/page.test.tsx`에 실패 테스트 추가 — (a) 기존 자기소개를 다른 문장으로 수정·저장 시 새 값이 upsert되고 표시(US2-AS1), (b) 전부 지우고 저장 시 upsert 페이로드 `introduction: null`(FR-007) + 저장 후 입력란 빈 값·placeholder 노출(US2-AS2), (c) 공백·줄바꿈만 입력 후 저장도 `null`(Edge), (d) 자기소개만 변경해도 저장 버튼 활성화(FR-009, US2-AS3), (e) 자기소개 빈 값이어도 저장 가능 — `valid`는 별명만 검사(FR-005), (f) 별명+자기소개 동시 수정 시 **updateUser 1회 호출**에 두 값 모두 포함(FR-010, US2-AS4), (g) 별명만 수정·저장 시 upsert 페이로드의 introduction이 기존 값 유지(FR-014). 실패 확인
- [x] T010 [P] [US2] RED: `lib/store.test.tsx`의 resetAll describe에 실패 테스트 추가 — 자기소개가 저장된 상태에서 `resetAll()` 호출 시 upsert 페이로드에 `introduction: null` 포함(X1, FR-015 — 현행 코드는 자기소개를 남기는 버그). 실패 확인
- [x] T011 [US2] GREEN: `lib/store.tsx` — `resetAll`의 초기화 upsert에 `introduction: null` 추가(data-model §5). T010 통과 확인
- [x] T012 [P] [US2] GREEN: `app/me/page.tsx` — T009에서 남은 실패를 해소(F5 trim→null·dirty 비교의 엣지 보완 등 T008 구현의 간극). T009 통과·전체 그린 확인. T008이 이미 전부 커버해 실패가 없다면 "구현 변경 불필요"를 테스트 그린으로 입증하고 넘어간다

**Checkpoint**: US1+US2 동작 — 등록·조회·수정·비우기·초기화 완결

---

## Phase 5: User Story 3 - 길이 제한과 오류 상황을 안전하게 안내받는다 (Priority: P3)

**Goal**: 카운터가 실시간 갱신되고 150자 초과 입력이 차단되며, 저장 실패 시 입력 유지 + 오류 안내, 프로필 조회 실패 시 폼 전체 비활성 + 재시도 제공 (FR-003·004·012·013·019~021).

**Independent Test**: 150자 캡·카운터 확인, 네트워크 차단으로 저장 실패·조회 실패 재현 → 안내·재시도 확인 (quickstart.md §2 US3).

### Tests for User Story 3 (MANDATORY - TDD, Constitution Principle VI) ⚠️

- [x] T013 [US3] RED: `app/me/page.test.tsx`에 실패 테스트 추가 — (a) 입력마다 카운터가 `#{n}/150` 형식으로 즉시 갱신(FR-004, US3-AS1), (b) 150자 도달 후 추가 타이핑·붙여넣기가 반영되지 않음 — `maxLength` 경계 검증(FR-003, US3-AS2), (c) `upsertError` 상태에서 저장 → `role="alert"` 오류 안내 + textarea 입력값 유지(FR-012, US3-AS3), (d) 저장 진행 중 버튼 disabled + "저장 중…" 표시(FR-013, US3-AS4), (e) **조회 실패**(`selectError`) 시 별명 input·textarea·이미지 버튼·저장 버튼 전부 disabled + `role="alert"` 안내 + "재시도" 버튼 노출(FR-019·020, US3-AS5), (f) 재시도 클릭 → `selectError` 해제 상태에서 재조회 성공 → 폼이 DB 값으로 하이드레이션되고 저장 버튼 게이트 해제(FR-021, US3-AS6). 실패 확인
- [x] T014 [US3] GREEN: `app/me/page.tsx` — 조회 실패 오류 상태 구현: `profileStatus === 'error'`일 때 프로필 탭 입력 전부 `disabled`, `.save-error` 스타일 `role="alert"` 안내("프로필을 불러오지 못했어요.") + `btn` "재시도" 버튼(`retryProfile()` 호출), 재시도 성공 시 기존 하이드레이션 게이트(T008)가 DB 값으로 폼을 채우는지 확인(contracts/me-profile-form.md 상태 계약). 저장 실패·저장 중 동작은 기존 패턴 확장으로 커버. T013 통과·전체 그린 확인

**Checkpoint**: 세 스토리 모두 독립 동작 — 자동 테스트 레벨 완결

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 문서 동기화(헌법 I 같은 작업 내 의무)와 실구동 검증(헌법 V·VI 완료 게이트)

- [x] T015 [P] `DESIGN.md` 동기화 — §5.12: anatomy(:483)에 자기소개 `.field-block` 추가, 표(:492-499)에 `.field-multi`·`.field textarea`·`::placeholder` 행 추가, 상태(:506)에 조회 실패(disabled+재시도) 추가, React 노트(:507)에 `MAX_INTRODUCTION = 150`·`#n/150`·`aria-label`·하이드레이션 게이트 반영; §6.4(:570·572): 자기소개 필드·`profileStatus` 게이트 반영; §8: User 표(:614)에 `introduction` 행, 제약(:631)에 150자 캡, 파생(:635)에 `introduction` 컬럼·`profileStatus` 추가; §11 소스 맵(:688) 갱신; **§5.8 이후 소스 라인 범위 드리프트(~73줄) 교정**(research.md 실측 표: §5.8=668-858, §5.9=860-906, §5.10=908-969, §5.11=971-978, §5.12=980-1108+이번 추가분, §5.13 재계산)
- [ ] T016 최종 검증 — (a) `npm run test:run` 전체 그린·경고 0 확인, (b) `npm run dev`로 quickstart.md §2 실구동: US1(등록→새로고침→유지, 기본값 플래시 없음), US2(수정·비우기→DB NULL 확인·초기화), US3(150 캡, Offline 저장 실패, `/rest/v1/profile*` 차단으로 조회 실패→재시도), 회귀(별명·이미지·로그아웃·글 CRUD), (c) 결과를 근거와 함께 보고 — 통과 없이는 완료 선언 금지(헌법 V·VI)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 의존 없음 — 즉시 시작
- **Foundational (Phase 2)**: T001 이후. **모든 스토리를 블록** — 게이트웨이 계약이 세 스토리의 전제
- **US1 (Phase 3)**: Phase 2 완료 후. T006(RED) → T008(GREEN); T007(CSS)은 T006과 병렬 가능
- **US2 (Phase 4)**: US1 완료 후(같은 파일 `app/me/page.tsx`·`page.test.tsx`를 확장하므로 순차)
- **US3 (Phase 5)**: US2 완료 후(같은 이유)
- **Polish (Phase 6)**: 모든 스토리 완료 후. T015(문서)는 T016(검증)과 병렬 가능하나 T016 보고 전 완료 필수

### Story Independence 참고

스토리 간 파일이 겹쳐(단일 폼 기능) 팀 병렬화는 부적합하지만, 각 스토리는 완료 시점마다 독립적으로 테스트·시연 가능한 증분이다(US1만으로 MVP).

### Within Each Story

- RED(실패 확인) 없이 GREEN 진행 금지 — 테스트보다 먼저 작성된 프로덕션 코드는 폐기 대상(헌법 VI Iron Law)
- 각 GREEN 태스크는 해당 테스트 통과 + 전체 스위트 회귀 없음까지 확인

### Parallel Opportunities

- T007(globals.css) ∥ T006(page.test.tsx) — 다른 파일
- T010(store.test.tsx) ∥ T009(page.test.tsx) — 다른 파일
- T011(store.tsx) ∥ T012(page.tsx) — 다른 파일
- T015(DESIGN.md) ∥ T016의 자동 테스트 단계

---

## Parallel Example: User Story 1

```bash
# T006(RED 테스트 작성)과 T007(CSS)은 서로 다른 파일이므로 동시 진행 가능:
Task: "app/me/page.test.tsx에 US1 실패 테스트 작성"
Task: "app/globals.css에 .field-multi/.field textarea 추가"
# 단, T008(GREEN)은 T006의 RED 확인 후에만 시작
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1(베이스라인) → Phase 2(게이트웨이 — CRITICAL)
2. Phase 3(US1): 등록·조회 + 하이드레이션 경쟁 수정
3. **STOP and VALIDATE**: quickstart.md §2 US1 실구동 — 이 시점에 자기소개 등록·조회가 완결된 MVP
4. 이어서 US2(수정·비우기·초기화) → US3(길이·오류) → Polish(문서·최종 검증) 순 증분 확장

### 주의 사항

- `lib/store.tsx` 수정 시 기존 별명·이미지 테스트(store.test.tsx 프로필 describe)가 계속 그린이어야 한다(FR-018) — upsert 페이로드 단언이 4필드로 바뀌므로 기존 단언의 `introduction` 필드 추가 수정은 허용(동작 불변, 형태 확장)
- DB는 어떤 태스크에서도 변경하지 않는다(FR-017·SC-007) — 마이그레이션·정책 태스크가 없는 것이 의도된 상태다
