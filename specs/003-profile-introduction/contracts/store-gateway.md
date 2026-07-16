# Contract: 저장소 게이트웨이 (`lib/store.tsx`)

원칙 III — 프로필의 읽기·쓰기는 이 게이트웨이를 통해서만 한다. `/me` 페이지는 Supabase를 직접 호출하지 않는다.

## Store 공개 API 변경

```ts
export type User = {
  nickname: string
  email: string
  image: string | null
  introduction: string | null      // [신규]
}

type Store = {
  ready: boolean
  user: User | null                // user.introduction 포함
  profileStatus: 'loading' | 'ready' | 'error'   // [신규]
  retryProfile: () => void                        // [신규]
  updateUser: (patch: Partial<User>) => Promise<{ error: string | null }>
  // ...나머지 기존 그대로 (login, logout, posts CRUD, resetAll)
}
```

## 동작 계약

### 조회 (uid 확정 시 자동, `retryProfile()`로 수동 재시도)

| # | 조건 | 보장 |
|---|---|---|
| R1 | 조회 요청 | `select('name, image, introduction').eq('user_id', uid).maybeSingle()` — 컬럼 3개 |
| R2 | 성공 + 행 존재 | `profileStatus='ready'`, `user`가 DB 값 반영 (`introduction: profile.introduction`) |
| R3 | 성공 + 행 부재 (`data: null`) | `profileStatus='ready'`, `user`는 구글 기본값 + `introduction: null` — 오류 아님 |
| R4 | 실패 (`error` 반환) | `profileStatus='error'`, `profile` 미설정 — **오류를 더 이상 버리지 않는다** (현행 store.tsx:180은 `data`만 구조분해) |
| R5 | uid 변경(로그인/로그아웃/계정 전환) | `profileStatus`는 `'loading'`으로 리셋 후 재조회 |
| R6 | `retryProfile()` 호출 | `'loading'` 전이 후 재조회. 성공하면 R2/R3, 실패하면 R4 |
| R7 | 언마운트/uid 변경 후 늦게 도착한 응답 | 무시(cancelled 가드 유지) — 상태를 덮어쓰지 않는다 |

### 쓰기 — `updateUser(patch)`

| # | 조건 | 보장 |
|---|---|---|
| W1 | 미로그인 | `{ error: '로그인이 필요합니다.' }`, upsert 없음 (기존 그대로) |
| W2 | **`profileStatus !== 'ready'`** | **`{ error: <한국어 안내> }`, upsert 없음** — FR-020. 조회 실패 상태의 upsert는 DB 행을 구글 기본값으로 덮어쓰는 경로이므로 게이트웨이 차원에서 차단 |
| W3 | `patch.introduction` 제공(값 or null) | upsert 페이로드의 `introduction`에 그대로 반영 |
| W4 | `patch`에 `introduction` 부재 | `profile?.introduction ?? null` 유지 — 별명/이미지만 저장해도 자기소개 불변 (FR-014) |
| W5 | upsert 페이로드 | `{ user_id, name, image, introduction }` + `{ onConflict: 'user_id' }` — 항상 4필드 전체 행 |
| W6 | upsert 실패 | `{ error: message }`, 로컬 상태 불변 (기존 그대로) |
| W7 | upsert 성공 | `setProfile(next)` 후 `{ error: null }` — `user.introduction` 즉시 갱신 (기존 패턴) |

### 초기화 — `resetAll()`

| # | 보장 |
|---|---|
| X1 | 초기화 upsert 페이로드에 `introduction: null` 포함 — 자기소개도 지워진다 (FR-015) |

## 검증 (테스트 경계)

목은 `./supabase` 모듈 경계에만 둔다(기존 store.test.tsx 방침). `dbMock`은 `introduction` 필드와 `selectError` 스위치를 갖도록 확장해 R4·R6·W2 경로를 실제로 구동한다.
