# Phase 0 Research: 페이지 서버 저장 및 소유자별 접근 제어

**Feature**: `specs/003-supabase-page-storage` | **Date**: 2026-07-16

스펙의 Technical Context에서 미확정이던 항목과, 기존 코드·실제 DB·프레임워크 문서를 대조해 확인한 사실을 정리한다. 모든 항목은 추측이 아니라 실제 확인 결과다(헌법 원칙 II).

---

## R1. 클라이언트 데이터 페칭 방식

**Decision**: `lib/store.tsx`의 `StoreProvider` 안에서 `useEffect` + `useState`로 supabase-js를 직접 호출한다. 새 데이터 페칭 라이브러리를 도입하지 않는다.

**Rationale**: Next.js 16 문서(`node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md:231-236`)는 클라이언트 컴포넌트 페칭에 두 가지만 제시한다 — React `use` API, 또는 SWR/React Query. 둘 다 이 저장소에 맞지 않는다.

- `use` API는 **서버 컴포넌트가 promise를 만들어 내려주는** 구조를 전제한다(같은 문서 `:238-272`). 이 앱의 인증은 브라우저 세션 기반(`lib/supabase.ts`의 `persistSession`/`detectSessionInUrl` PKCE 싱글턴)이라, 서버 컴포넌트는 현재 사용자가 누구인지 알 수 없다. 이를 쓰려면 `@supabase/ssr` + 쿠키 기반 세션으로 인증 구조 전체를 바꿔야 하는데, 스펙 Assumptions가 "인증 방식은 바꾸지 않는다"로 못 박았다.
- SWR/React Query는 신규 의존성이다. 헌법 원칙 IV(YAGNI)는 "PRD가 실제로 요구할 때만" 도입을 허용한다. 페이지 목록 1개를 계정당 한 번 읽는 요구에 캐시 라이브러리는 과하다.

무엇보다 **이 패턴은 이미 이 저장소에 있다**. `lib/store.tsx:171-186`이 `public.profile`을 정확히 이 방식(`useEffect` + `supabase.from().select()`)으로 읽는다. 같은 파일에 두 가지 페칭 방식이 공존하는 것보다 하나로 맞추는 편이 낫다.

**Alternatives considered**:
- `@supabase/ssr` + 서버 컴포넌트 페칭 → 인증 구조 변경 필요, 스펙 Assumptions 위반, 범위 폭증.
- SWR 도입 → 신규 의존성, 원칙 IV 위반. 재검증·폴링 등 이 기능이 요구하지 않는 기능값.

---

## R2. RLS 정책 구성

**Decision**: `public.page`에 `authenticated` 역할 대상 4개 정책(SELECT/INSERT/UPDATE/DELETE)을 추가한다. 칼럼 구성은 손대지 않는다.

```sql
create policy "Users can view own page" on public.page
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users can insert own page" on public.page
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Users can update own page" on public.page
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own page" on public.page
  for delete to authenticated using ((select auth.uid()) = user_id);
```

**Rationale**: 실제 DB를 조회해 확인한 사실들이 이 형태를 강제한다.

1. `public.page`는 RLS가 **켜져 있고 정책이 0개**다(`pg_policies` 조회 결과, Supabase advisor `rls_enabled_no_policy` INFO도 동일 보고). Postgres에서 RLS 활성 + 정책 없음 = **전면 거부**다. 즉 지금 앱을 붙이면 읽기도 쓰기도 전부 실패한다. 정책 추가는 선택이 아니라 동작의 전제다.
2. 정책 추가는 **칼럼 구성 변경이 아니다.** 사용자의 "DB 테이블 구조는 변경하면 안 돼" 제약은 지켜진다.
3. 기존 `public.profile`의 정책 3개가 이미 `to authenticated` + `(select auth.uid()) = user_id` 형태다. 같은 패턴을 따라 일관성을 유지한다.
4. `(select auth.uid())`로 감싸는 형태는 Supabase 권장이다. 행마다 함수를 재평가하지 않고 InitPlan으로 한 번만 평가돼 목록 조회가 빨라진다. 기존 `profile` 정책도 이 형태다.

**Alternatives considered**:
- `using (true)` + 클라이언트 `.eq('user_id', uid)` 필터 → **거부.** FR-007이 "클라이언트 화면 로직이 아니라 데이터 저장소 자체에서 강제"를 요구한다. 클라이언트 필터는 요청을 조작하면 그만이다.
- `auth.role() = 'authenticated'` 조건 → **거부.** Supabase가 deprecated 했고, 익명 로그인이 켜지면 조용히 뚫린다. `TO` 절을 쓴다.
- UPDATE에 `with check` 생략 → **거부.** `with check` 없이는 사용자가 자기 행의 `user_id`를 남의 것으로 바꿔 넘길 수 있다.

---

## R3. anon 역할 노출 — 이 기능의 최대 위험

**Decision**: `anon`에게는 어떤 정책도 만들지 않는다. 정책 작성 후 실제 DB에서 비로그인 접근이 거부되는지 반드시 검증한다.

**Rationale**: 실제 권한을 조회한 결과, **`anon` 역할이 `public.page`에 `SELECT, INSERT, UPDATE, DELETE` 전체 GRANT를 갖고 있다**(`profile`도 동일). Data API 노출은 RLS와 별개 층이며, 이 프로젝트는 두 테이블 모두 두 역할에 GRANT가 열려 있다.

즉 **RLS 정책이 유일한 방어선**이다. 지금은 정책이 0개라 우연히 안전하지만, 정책을 `to authenticated` 없이 쓰거나 `using (true)`로 쓰는 순간 비로그인 사용자에게 전체 페이지가 열린다. FR-007·SC-003·SC-004가 걸린 지점이다.

`to authenticated`로 명시하면 `anon`에는 해당되는 정책이 없어 RLS가 거부한다. 이것이 스토리 2(남의 페이지는 보이지 않는다)와 스토리 3(로그인해야 쓸 수 있다)을 저장소 층에서 성립시킨다.

**검증 방법**: 목(mock)으로는 절대 확인할 수 없다. 실제 DB에 대해 익명 요청과 타 사용자 요청을 날려 거부를 확인해야 한다(`quickstart.md` 참조).

---

## R4. 낙관적 갱신에서의 식별자·생성 시각

**Decision**: 식별자는 클라이언트가 `crypto.randomUUID()`로 만들어 insert에 함께 보낸다. 생성 시각은 낙관적 렌더 시점엔 클라이언트 값을 쓰고, 서버 응답의 `created_at`으로 교체한다.

**Rationale**: FR-022(화면 먼저 반영)와 FR-018(새 페이지 즉시 생성 + 편집기 열기)을 함께 만족하려면, 서버 왕복 **이전에** 행을 식별할 id가 필요하다. 편집기 선택 상태(`selectedId`)가 id에 걸려 있기 때문이다.

`page.id`는 `gen_random_uuid()` 기본값을 갖지만, 명시적으로 id를 넣어도 기본값이 무시될 뿐 **구조 변경이 아니다**. 기존 코드도 이미 `crypto.randomUUID()`로 id를 만들고 있어(`lib/store.tsx:104`) 변화가 작다.

`created_at`은 `now()` 기본값이 진실이다. 낙관적 렌더용 클라이언트 시각은 잠깐 쓰이고 서버 값으로 대체된다. insert 시 `.select().single()`로 확정 행을 받아 교체한다.

**Alternatives considered**:
- DB 기본값에 id를 맡기고 응답을 기다려 렌더 → FR-022(즉시 반영) 위반, 새 페이지 생성이 네트워크 지연만큼 느려짐.
- `created_at`도 클라이언트 값으로 확정 → 기기 시계가 틀리면 정렬(FR-011)이 깨짐. 서버 값이 진실이어야 한다.

---

## R5. 자동 저장 디바운스

**Decision**: `setTimeout` 800ms 디바운스를 `lib/store.tsx` 안에 두고, 페이지 전환·언마운트 시 대기 중인 저장을 즉시 실행(flush)한다. 테스트는 `vi.useFakeTimers()`로 결정적으로 검증한다.

**Rationale**: FR-016(800ms 디바운스)·FR-017(이탈 시 즉시 저장)의 직접 구현이다. 헌법이 "시간 의존 코드는 `vi.useFakeTimers()`로 결정적으로 테스트한다"고 이미 규정하고 있어(기술 제약 절) 테스트 방법이 정해져 있다.

디바운스를 스토어에 두는 이유는 원칙 III(단일 저장소 게이트웨이) 때문이다. 저장 타이밍은 영속성의 일부이므로 컴포넌트가 아니라 `store.tsx`가 소유해야 한다.

flush가 필요한 지점: 다른 페이지 선택(`selectedId` 변경), 편집기 언마운트, 로그아웃. 이 셋에서 대기 타이머를 취소하고 즉시 저장한다.

**주의**: 저장 중 사용자가 계속 타이핑하면 최신 값이 뒤이어 저장돼야 한다. 요청 순서가 뒤집히면 옛 값이 최종본이 될 수 있으므로, 페이지별로 "마지막 요청만 반영" 규칙(진행 중 요청 무시 또는 세대 카운터)을 둔다.

**Alternatives considered**:
- 컴포넌트(`Editor.tsx`)에 디바운스 배치 → 원칙 III 위반. 저장 정책이 UI에 흩어진다.
- `requestIdleCallback`/`beforeunload` 의존 → 브라우저별 신뢰도 편차, 테스트 어려움.

---

## R6. 테스트 대역(test double) 경계

**Decision**: 기존 `lib/store.test.tsx`의 방식을 확장한다 — `vi.mock('./supabase')`로 모듈 경계를 in-memory 대역으로 대체하고, `page` 테이블 대역이 `select/insert/update/delete` + `eq/order/single`을 실제 데이터 구조 그대로 지원하게 만든다.

**Rationale**: 헌법 원칙 VI가 "목은 불가피할 때만, 외부 경계에서만" 그리고 "목은 실제 데이터 구조를 완전하게 반영한다"고 규정한다. `lib/supabase.ts`는 네트워크 경계이고, 기존 테스트가 이미 이 지점을 대역으로 채워 `profile` 동작을 검증한다(`lib/store.test.tsx:31-47`). 같은 경계에 `page`를 추가하는 것이 일관된다.

대역은 실제 칼럼(`id`, `created_at`, `title`, `content`, `user_id`)을 그대로 갖고, 실패 주입(`insertError`, `deleteError` 등)을 지원해 FR-023·FR-024의 롤백 경로를 테스트한다.

**한계(중요)**: 이 대역은 **RLS를 검증하지 못한다.** 대역은 소유자 필터를 흉내 낼 뿐이고, 실제 정책이 올바른지는 알려주지 않는다. R3의 실제 DB 검증이 반드시 별도로 필요하다. 목의 동작을 검증하는 함정(헌법이 금지)에 빠지지 않도록, 소유자 격리 테스트는 "스토어가 남의 행을 화면에 올리지 않는가"가 아니라 실제 DB 검증으로 판정한다.

---

## R7. 내비게이션 축소 — `recent`의 소멸

**Decision**: Rail의 내비 항목을 `all` 하나만 남긴다. `favorites`·`trash`(FR-012)에 더해 **`recent`도 제거**한다.

**Rationale**: 이건 스펙이 명시하진 않았지만 FR-013에서 직접 따라 나오는 결과다. 현재 `recent`는 `updatedAt` 내림차순 상위 10개다(`app/workspace/page.tsx:22-27`). FR-013이 수정 시각과 최근 수정순 정렬을 제거하므로, `recent`가 정렬할 기준 자체가 사라진다. 남는 선택지는 `createdAt` 정렬인데 그러면 `all`과 **완전히 동일한 목록**이 된다. 라벨만 다르고 내용이 같은 내비 항목은 사용자를 속이는 것이다.

`NavKey`가 단일 값이 되면 타입·필터·카운트 로직이 통째로 사라진다(`filterPosts`의 switch 4갈래 → 검색 필터만 남음). 검색은 Rail에 그대로 남는다.

**사용자 확인 필요**: 내비 항목 4개 중 3개가 사라져 "내 업무" 섹션에 `전체 페이지` 하나만 남는다. 스펙이 직접 요구한 바는 아니므로 완료 보고에서 명시적으로 알린다.

---

## R8. 목록 스켈레톤 — 기존 패턴 재사용

**Decision**: `.cover-skeleton`의 pulse 패턴을 그대로 따르는 `.listrow-skeleton`을 추가한다. 새 디자인 토큰을 만들지 않는다.

**Rationale**: FR-020(스켈레톤)이 요구하는 것을 이 저장소가 이미 갖고 있다. `app/globals.css:740-758`의 `.cover-skeleton`이 `--gray-100 ↔ --gray-150`을 `--dur-shimmer`(1400ms) 주기로 교차하고, `prefers-reduced-motion: reduce`에서 애니메이션을 끈다. 같은 키프레임(`cover-pulse`)과 토큰을 재사용하면 헌법 원칙 I(임의 값 금지)을 지키면서 시각적으로도 한 시스템으로 읽힌다.

스켈레톤 행은 `.listrow`의 박스 수치(`padding:10px 12px`, `--radius-lg`, `--border-subtle`)를 그대로 써서 로딩 → 실제 목록 교체 시 레이아웃 시프트가 없게 한다. `.cover`가 세 상태에 같은 박스를 쓰는 것과 같은 원리다.

**DESIGN.md 동기화 필요**: §5.7(Post list)에 스켈레톤 상태 추가, §5.15 신설 또는 §5.7 내 편입. CLAUDE.md 규칙상 같은 작업 안에서 처리한다.

---

## R9. 실패 알림 표면 — 현재 없음

**Decision**: 세 지점에 최소한의 표시를 추가한다. 토스트 시스템을 새로 만들지 않는다.

| 실패 | 표시 | 근거 FR |
|---|---|---|
| 수정 저장 실패 | 기존 `.save-state` 확장 (`저장됨` / `저장 중…` / `저장 안 됨`) | FR-024 |
| 목록 불러오기 실패 | `.list-empty` 자리에 `.list-error`(빈 상태와 다른 문구) | FR-008, 엣지 케이스 |
| 생성·삭제 실패(롤백 후) | 리스트페인 상단 인라인 알림 `.list-notice` | FR-023 |

**Rationale**: 이 앱에는 **토스트·알림 컴포넌트가 없다**(DESIGN.md §5 전체 확인). FR-008/023/024가 사용자에게 실패를 알리라고 요구하므로 무언가는 필요하다.

`.save-state`는 이미 에디터 브레드크럼에 "저장됨 {시각}"을 표시한다(`components/Editor.tsx:51`, `app/globals.css:708`). 저장 상태를 말하는 자리가 이미 있으니 여기를 확장하는 게 자연스럽다. 단 FR-013으로 `updatedAt`이 사라지므로 "저장됨 {시각}"의 시각 부분은 없어지고 상태 문구만 남는다.

빈 상태와 실패를 반드시 구분해야 한다(엣지 케이스 명시). `.list-empty`를 재사용하되 문구를 갈라 쓰면 "페이지가 없다"와 "못 불러왔다"가 섞인다. 별도 클래스로 나눈다.

**DESIGN.md 동기화 필요**: §5.7에 `.list-error`·`.list-notice`, §5.8에 `.save-state` 상태 확장.

**Alternatives considered**:
- 토스트 시스템 도입 → 원칙 IV(YAGNI) 위반. 알림 3종에 전역 큐·타이머·포털은 과하다.
- `window.alert` → 디자인 시스템 밖. 흐름을 끊는다.

---

## R10. 레거시 localStorage 정리

**Decision**: `mini-notion:posts` 키를 초기화 시 제거한다. 기존 레거시 키 정리 코드(`lib/store.tsx:143-147`) 옆에 나란히 둔다.

**Rationale**: FR-014가 "브라우저에 남아 있는 이전 페이지 데이터는 정리해 화면에 영향을 주지 않도록 한다"를 요구한다. 이 저장소엔 이미 같은 일을 하는 선례가 둘 있다 — `LEGACY_USER_KEY`(가짜 로그인 시절), `LEGACY_OVERLAY_PREFIX`(프로필 로컬 오버레이). `POSTS_KEY`도 같은 운명이며 같은 방식으로 처리한다.

시드 로직(`seedPosts`, `lib/store.tsx:94-133`)과 `hadStoredPosts` ref는 통째로 삭제된다(FR-014).

---

## R11. 범위 밖이나 보고할 보안 경고

**Decision**: 고치지 않는다. 사용자에게 알린다.

Supabase security advisor가 이 기능과 무관한 기존 경고 2건을 보고한다.

- **`public.rls_auto_enable()`이 `anon`/`authenticated`에게 실행 가능** (WARN ×2). `SECURITY DEFINER` 함수가 `public` 스키마에 있어 `/rest/v1/rpc/rls_auto_enable`로 누구나 호출할 수 있다. Postgres는 새 함수에 `PUBLIC` 실행 권한을 기본 부여하므로 사실상 공개 엔드포인트다. 사용자가 만든 함수로 보이며 이번 기능이 건드리지 않는다.
- **Leaked password protection 비활성** (WARN). 이 앱은 Google OAuth만 쓰므로 실질 영향이 없다.

이번 작업 범위(FR-001~024)에 포함되지 않아 손대지 않되, 첫 항목은 실제 노출면이므로 완료 보고에서 알린다.

---

## R12. 해소되지 않은 항목

| 항목 | 상태 | 처리 |
|---|---|---|
| 콘텐츠 최대 길이 | 미정 | `text` 칼럼은 사실상 무제한. 스펙 엣지 케이스가 "수만 자"까지만 요구. 별도 제한 두지 않음 |
| 요청 제한(rate limit) | 미정 | 디바운스(R5)가 실질적 완화. Supabase 기본 제한에 의존 |
| 동시 수정 충돌 | 스펙에서 제외 | 나중 저장이 최종(Assumptions 명시) |

Technical Context에 NEEDS CLARIFICATION으로 남은 항목은 없다.
