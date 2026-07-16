# Quickstart: 페이지 서버 저장 검증 가이드

**Feature**: `specs/003-supabase-page-storage` | **Date**: 2026-07-16

이 기능이 실제로 동작하는지 확인하는 절차. 헌법 원칙 V가 "타입체크·빌드 통과만으로 완료로 간주하지 않는다"고 규정하므로, **아래 A·B·C를 모두 통과해야 완료**다.

- **A. 자동 테스트** — 스토어 로직·UI 동작
- **B. 실제 DB 검증** — RLS. **목으로는 검증 불가.** 생략하면 보안 요구(FR-007)가 미검증으로 남는다
- **C. 실제 앱 구동** — 사용자 흐름

---

## 사전 준비

```bash
npm install
```

`.env.local`에 다음이 필요하다(`.env.example` 참조). 이 워크트리에는 없을 수 있다 — 원본 체크아웃에서 복사한다.

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

검증에는 **서로 다른 Google 계정 2개**(A·B)가 필요하다. 소유자 격리(스토리 2·4)는 계정 하나로 확인할 수 없다.

---

## A. 자동 테스트

```bash
npm run test:run
```

**기대**: 전부 통과. 기준선은 이 기능 착수 전 52개(5파일)였다.

TDD 순서를 지켰다면 각 테스트는 구현 전에 **올바른 이유로 실패**하는 것을 먼저 확인했어야 한다(헌법 원칙 VI). 실패를 본 적 없는 테스트는 무엇을 검증하는지 알 수 없다.

커버해야 할 동작:

| 영역 | 검증 |
|---|---|
| 목록 로드 | `pagesStatus` 전이 `loading → ready`, `created_at` 내림차순 |
| 빈 상태 vs 로딩 | 로딩 중 빈 상태 안내가 나오지 않음 (FR-021, SC-009) |
| 생성 | 즉시 목록 추가, 실패 시 제거 + 알림 (FR-018, FR-022, FR-023) |
| 자동 저장 | `vi.useFakeTimers()`로 800ms 디바운스, 연속 입력 1회 저장 (FR-016, SC-010) |
| flush | 페이지 전환 시 대기 저장 즉시 실행 (FR-017) |
| 저장 실패 | 입력 내용 유지 + `saveStatus='error'` (FR-024) |
| 빈 페이지 자동 삭제 | 이탈 시 삭제, 확인 없음 (FR-019) |
| 삭제 롤백 | 실패 시 목록 복원 + 알림 (FR-023) |
| 로그아웃 | `pages`가 비워짐 (FR-010) |

---

## B. 실제 DB 검증 (RLS) — 생략 금지

`lib/store.test.tsx`의 대역은 in-memory 객체다. **RLS가 올바른지 전혀 알려주지 않는다.** 아래는 실제 DB에 대해 확인한다.

### B1. 정책이 존재하고 대상이 맞는가

```sql
select policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public' and tablename = 'page'
order by policyname;
```

**기대**: 4행(SELECT/INSERT/UPDATE/DELETE). 모두 `roles = {authenticated}`. `anon` 대상 정책 **0개**. UPDATE 행은 `qual`과 `with_check`가 **둘 다** 채워져 있어야 한다.

### B2. advisor 경고 해소

Supabase advisor(security)를 실행한다.

**기대**: `public.page`의 `rls_enabled_no_policy` 경고가 사라진다.

> 참고: `public.rls_auto_enable()` 관련 WARN 2건과 leaked password protection WARN은 이 기능과 무관한 기존 경고다(research.md R11). 남아 있어도 이 검증의 실패가 아니다.

### B3. 비로그인 접근이 거부되는가 (SC-004)

브라우저 콘솔에서 **로그아웃 상태**로:

```js
const { data, error } = await supabase.from('page').select('*')
console.log({ rows: data?.length, error })
```

**기대**: `rows: 0`. 데이터가 한 줄이라도 나오면 **즉시 중단** — `anon`에 GRANT가 열려 있어(research.md R3) 정책이 잘못되면 전체가 노출된다.

비로그인 insert도 시도한다.

```js
await supabase.from('page').insert({ id: crypto.randomUUID(), title: 'x', content: '', user_id: '00000000-0000-0000-0000-000000000000' })
```

**기대**: 거부.

### B4. 남의 페이지가 보이지 않는가 (SC-003)

1. A 계정으로 로그인 → 페이지 작성 → id 기록
2. 로그아웃 → B 계정으로 로그인
3. 목록 확인 → **A의 페이지가 없어야 한다**
4. B 콘솔에서 A의 id를 직접 지정:

```js
const { data } = await supabase.from('page').select('*').eq('id', 'A의-페이지-id')
console.log(data)  // 기대: []
```

### B5. 남의 페이지를 삭제할 수 없는가 (SC-005)

B 계정 콘솔에서:

```js
const { data, error } = await supabase.from('page').delete().eq('id', 'A의-페이지-id').select()
console.log({ deleted: data?.length, error })  // 기대: deleted: 0
```

그 뒤 A로 다시 로그인해 **페이지가 그대로 있는지** 확인한다. 이 확인을 빠뜨리면 안 된다 — `delete`가 0행을 반환해도 실제로 지워졌는지는 A만 알 수 있다.

### B6. user_id를 남에게 넘길 수 없는가 (WITH CHECK)

A 계정 콘솔에서 자기 페이지의 소유자를 B로 바꾸려 시도:

```js
const { data, error } = await supabase.from('page').update({ user_id: 'B의-uid' }).eq('id', 'A의-페이지-id').select()
console.log({ updated: data?.length, error })  // 기대: 거부 또는 0행
```

---

## C. 실제 앱 구동

```bash
npm run dev
```

### C1. 저장이 계정에 남는가 (스토리 1, SC-002)

1. A 계정 로그인 → `/page`로 새 페이지 생성 → 제목·내용 입력
2. **개발자도구 → Application → Local Storage 전체 삭제** → 새로고침 → 재로그인
3. **기대**: 페이지가 그대로 보인다. (localStorage가 아니라 서버에 있다는 증거)

### C2. 로딩 중 빈 상태가 번쩍이지 않는가 (SC-009)

1. DevTools Network에서 속도를 `Slow 3G`로 제한
2. 새로고침

**기대**: 목록 자리에 스켈레톤. **"페이지가 없어요"가 잠깐이라도 보이면 실패**(FR-021).

### C3. 자동 저장이 합쳐지는가 (SC-010)

1. Network 탭 필터를 `page`로
2. 편집기에서 문장 하나를 빠르게 타이핑

**기대**: 글자 수만큼이 아니라 **입력을 멈춘 뒤 1회** 요청. 멈추고 1초 이내 저장 완료.

### C4. 빈 페이지가 남지 않는가 (FR-019)

1. 새 페이지 생성 → 아무것도 입력하지 않고 다른 페이지 선택
2. **기대**: 그 빈 페이지가 목록에서 사라진다
3. DB에서도 확인: `select count(*) from page where coalesce(title,'')='' and coalesce(content,'')='';` → 기대 `0`

### C5. 실패가 사용자에게 보이는가 (FR-008, FR-023, FR-024)

1. DevTools Network를 `Offline`으로
2. 편집기에 입력 → **기대**: 입력 내용 유지 + "저장 안 됨" 표시(FR-024). 내용이 사라지면 실패
3. 삭제 시도 → **기대**: 목록에서 사라졌다가 **되돌아오고** 알림 표시(FR-023)
4. Offline 상태로 새로고침 → **기대**: 실패 안내. "페이지가 없어요"가 뜨면 실패(빈 상태와 실패는 구분해야 함)

### C6. 삭제 확인 (FR-015)

1. 삭제 버튼 → **기대**: 확인 대화상자
2. 취소 → 페이지 유지
3. 확인 → 삭제, 재접속해도 없음

### C7. 제거된 기능이 흔적 없이 사라졌는가 (FR-012, FR-013, R7)

**기대**: 즐겨찾기 칩·별, 휴지통 내비·배너·복원 버튼, "수정 {시각}" 표시가 어디에도 없다. Rail 내비는 `전체 페이지` 하나만 남는다.

### C8. 새 사용자 (FR-014)

새 Google 계정으로 첫 로그인.

**기대**: 예시 페이지 4개가 **생기지 않고** 빈 목록 + 빈 상태 안내.

---

## 완료 판정

- [ ] A: `npm run test:run` 전부 통과, 각 테스트가 구현 전 실패를 확인했음
- [ ] B: B1~B6 전부 기대대로 (**RLS는 목으로 대체 불가**)
- [ ] C: C1~C8 전부 기대대로
- [ ] `DESIGN.md` 동기화 완료 (스켈레톤·실패 표시 추가, 즐겨찾기·휴지통·수정시각 제거)

하나라도 미달이면 완료가 아니다. 특히 **B를 건너뛰고 완료를 선언하지 않는다** — 이 기능의 핵심 요구가 소유자 격리이고, 그것은 실제 DB에서만 증명된다.
