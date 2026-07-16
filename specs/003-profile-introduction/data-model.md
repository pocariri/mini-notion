# Data Model: 자기소개 (Profile Introduction)

**Date**: 2026-07-16 | **Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

## 1. 영속 데이터 — `public.profile` (변경 금지)

Supabase MCP로 실측 확인한 현행 스키마. **이번 기능은 이 테이블을 읽고 쓰기만 하며, DDL·RLS 변경은 0건이어야 한다**(FR-017, SC-007).

| 컬럼 | 타입 | 제약 | 이번 기능에서의 사용 |
|---|---|---|---|
| `id` | uuid | PK, `gen_random_uuid()` | 사용 안 함 |
| `created_at` | timestamptz | `now()` | 사용 안 함 |
| `name` | text | nullable | 기존 — 별명 (읽기·쓰기, 동작 불변) |
| `user_id` | uuid | UNIQUE, FK → `auth.users.id` | upsert `onConflict` 키 (기존 그대로) |
| `image` | text | nullable | 기존 — 프로필 이미지 (동작 불변) |
| **`introduction`** | **text** | **nullable** | **신규 사용 — 자기소개 (읽기·쓰기 개시)** |

- RLS(실측): 본인 행만 SELECT / INSERT / UPDATE (`(select auth.uid()) = user_id`, `authenticated`). DELETE 정책 없음. 자기소개는 이 정책으로 자동 커버 → FR-016 충족, 추가 정책 불필요.
- 행 생성: 가입 시 DB 트리거(`on_auth_user_created` → `handle_new_user()`)가 구글 이름·사진으로 시드(DESIGN.md §8). `introduction`은 시드되지 않으므로 초기값 NULL.
- `introduction`에 길이 제약 없음 → 150자 캡은 앱 계층 책임(연구 D5).

## 2. 앱 타입 (`lib/store.tsx`)

```ts
// 내부 — DB 행 미러. introduction 추가.
type Profile = {
  name: string | null
  image: string | null
  introduction: string | null   // 신규
}

// 공개 — 파생 사용자. introduction 추가.
export type User = {
  nickname: string
  email: string
  image: string | null
  introduction: string | null   // 신규. 구글 메타데이터에는 대응값이 없다.
}
```

### 파생 규칙 (user 메모, store.tsx:295-303 확장)

| User 필드 | 파생식 | 비고 |
|---|---|---|
| `nickname` | `profile?.name ?? base.nickname` | 기존 그대로 |
| `email` | `base.email` | 기존 그대로 |
| `image` | `profile ? profile.image : base.image` | 기존 그대로 (명시적 null = 제거) |
| `introduction` | `profile?.introduction ?? null` | **신규.** 구글 기본값이 존재하지 않으므로 base 폴백 없음 — 행이 없거나 값이 NULL이면 그냥 "없음" |

## 3. 값 규칙 (검증)

| 규칙 | 내용 | 근거 |
|---|---|---|
| 최대 길이 | 150 (UTF-16 코드 유닛, `String.length` = HTML `maxLength` 기준) | FR-003, 연구 D5 |
| 입력 형식 | 여러 줄 평문. 줄바꿈 보존, 서식 없음 | FR-002, Assumption |
| 정규화 | 저장 시 `trim()`. 폼 입력 중에는 원본 유지 | FR-006 |
| 없음 표현 | trim 결과 `''` → **NULL** 저장. `''`는 DB에 저장하지 않는다(이중 표현 금지) | FR-007, 연구 D6 |
| 선택성 | 빈 값도 유효 — 폼 `valid` 게이트에 불참(별명만 필수 유지) | FR-005 |
| dirty 판정 | 폼 값(string) vs `user.introduction ?? ''` 비교 | FR-009 |

## 4. 상태 전이 — 프로필 조회 (`profileStatus`, 신규)

`profile === null`의 3중 의미(로딩/행 없음/실패)를 해소하는 명시적 상태(연구 D2·D3).

```
                 uid 확정(로그인/계정 전환)
                          │
                          ▼
                    ┌──────────┐
      retryProfile()│ loading  │
     ┌─────────────►│          │
     │              └────┬─────┘
     │        조회 성공   │   조회 실패(error 반환)
     │   (행 존재 or 부재)│
     │            ┌──────┴──────┐
     │            ▼             ▼
     │       ┌────────┐    ┌────────┐
     │       │ ready  │    │ error  │──┐
     │       └────────┘    └────────┘  │
     │                                 │
     └─────────────────────────────────┘
```

| 상태 | 의미 | profile 값 | UI 결과 (/me 프로필 탭) |
|---|---|---|---|
| `loading` | 조회 진행 중 (또는 로그아웃 상태로 무의미) | `null` | 스플래시 유지 — 폼 미하이드레이션 (D2) |
| `ready` | 조회 완료. 행 존재(profile=행) 또는 부재(profile=null, 구글 기본값 사용) | 행 or `null` | 폼 하이드레이션·저장 가능 |
| `error` | 조회 실패 | `null` | 폼 비활성 + 오류 안내 + 재시도 (FR-019·020) |

- 전이 규칙: uid 변경 시 무조건 `loading`으로 리셋. `retryProfile()`은 `error`(또는 임의 상태)에서 재조회를 트리거해 `loading`으로.
- 가드: `updateUser`는 `profileStatus !== 'ready'`이면 upsert 없이 오류 반환(FR-020 — 조회 실패 상태의 upsert는 `profile ?? base` 폴백으로 DB 행 전체를 구글 기본값으로 덮어쓰는 경로이므로 원천 차단).
- 페이지 하이드레이션: `ready && user && profileStatus === 'ready' && !hydrated`일 때 1회. `error → (재시도) → ready` 전이 시에도 같은 조건으로 하이드레이션된다(FR-021).

## 5. 쓰기 페이로드

모든 쓰기는 전체 행 upsert(기존 패턴 유지, `onConflict: 'user_id'`):

| 경로 | 페이로드 | 변화 |
|---|---|---|
| `updateUser` (저장) | `{ user_id, name, image, introduction }` | `introduction` 필드 추가 — patch에 없으면 `profile?.introduction ?? null` 유지 (FR-010·014) |
| `resetAll` (초기화) | `{ user_id, name: base.nickname, image: base.image, introduction: null }` | `introduction: null` 추가 (FR-015 — 현행 코드는 자기소개를 남기는 버그) |
