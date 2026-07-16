# Contract: 스토어 공개 API (`lib/store.tsx`)

**Feature**: `specs/003-supabase-page-storage` | **Date**: 2026-07-16

`lib/store.tsx`는 이 앱의 유일한 영속성 게이트웨이다(헌법 원칙 III). 컴포넌트는 `useStore()`로만 페이지에 접근하며 supabase-js를 직접 부르지 않는다. 이 파일은 그 경계의 계약이다.

---

## 변경 후 `Store` 타입

```ts
export type Page = {
  id: string
  title: string
  content: string
  createdAt: number
}

type PageStatus = 'loading' | 'ready' | 'error'
type SaveStatus = 'saved' | 'saving' | 'error'

type Store = {
  ready: boolean
  user: User | null

  pages: Page[]
  pagesStatus: PageStatus          // FR-020, FR-021 — 빈 상태와 로딩·실패를 구분
  saveStatus: SaveStatus           // FR-024 — 편집 저장 상태
  notice: string | null            // FR-023 — 롤백 후 사용자 알림
  dismissNotice: () => void

  login: () => Promise<{ error: string | null }>
  logout: () => Promise<void>
  updateUser: (patch: Partial<User>) => Promise<{ error: string | null }>

  createPage: (title?: string, content?: string) => Promise<string | null>
  updatePage: (id: string, patch: Partial<Pick<Page, 'title' | 'content'>>) => void
  deletePage: (id: string) => Promise<void>
  discardIfEmpty: (id: string) => Promise<void>
  flushPending: () => Promise<void>

  resetAll: () => Promise<void>
}
```

### 제거되는 API

| 제거 | 근거 |
|---|---|
| `posts` | → `pages` (Q5 용어 통일) |
| `createPost` / `updatePost` | → `createPage` / `updatePage` |
| `toggleFavorite` | FR-012 — 즐겨찾기 제거 |
| `trashPost` / `restorePost` | FR-012 — 휴지통 제거 |
| `deletePostForever` | → `deletePage` (영구 삭제가 유일한 삭제) |

---

## 동작 계약

### `createPage(title?, content?) → Promise<string | null>`

| # | 계약 | 근거 |
|---|---|---|
| 1 | 비로그인 시 아무것도 만들지 않고 `null` 반환 | FR-002 |
| 2 | `crypto.randomUUID()`로 id를 만들고 목록 맨 앞에 **즉시** 추가한 뒤 id를 반환한다. 서버 응답을 기다리지 않는다 | FR-018, FR-022 |
| 3 | 서버에 `{ id, title, content, user_id: uid }`를 insert하고 확정 행의 `created_at`으로 낙관적 값을 교체한다 | R4 |
| 4 | insert 실패 시 그 페이지를 목록에서 제거하고 `notice`를 설정한다 | FR-023 |

### `updatePage(id, patch) → void`

| # | 계약 | 근거 |
|---|---|---|
| 1 | 화면(메모리) 상태를 즉시 갱신한다 | FR-022 |
| 2 | 서버 저장은 **800ms 디바운스**. 연속 입력은 한 번의 저장으로 합쳐진다 | FR-016, SC-010 |
| 3 | 저장 실패 시 **사용자 입력을 되돌리지 않는다.** `saveStatus = 'error'`만 설정한다 | FR-024 |
| 4 | 같은 페이지의 응답이 뒤집혀 도착해도 마지막 입력이 최종본이어야 한다 | R5 |

### `flushPending() → Promise<void>`

대기 중인 디바운스 저장을 즉시 실행한다. 페이지 전환·편집기 언마운트·로그아웃 시 호출한다. (FR-017)

### `deletePage(id) → Promise<void>`

| # | 계약 | 근거 |
|---|---|---|
| 1 | 목록에서 즉시 제거한다 | FR-022 |
| 2 | 서버 삭제 실패 시 **원래 자리에 복원**하고 `notice`를 설정한다 | FR-023, 스토리 4 시나리오 4 |
| 3 | 삭제 확인(FR-015)은 **호출자(UI)의 책임**이다. 스토어는 확인을 묻지 않는다 | FR-015 |

> 확인을 UI에 두는 이유: 스토어는 `window.confirm`을 몰라야 테스트 가능하고, `discardIfEmpty`는 같은 삭제를 확인 없이 해야 한다(FR-019). 확인을 스토어에 넣으면 두 경로가 충돌한다.

### `discardIfEmpty(id) → Promise<void>`

`title === '' && content === ''`인 경우에만 삭제한다. 확인을 묻지 않는다. 페이지 이탈 시 호출한다. (FR-019)

### `pagesStatus`

| 값 | 의미 | UI |
|---|---|---|
| `loading` | 불러오는 중 | 스켈레톤. **빈 상태 안내 금지** (FR-021) |
| `ready` | 완료 | 목록 또는 빈 상태 안내 |
| `error` | 실패 | 실패 안내. 빈 상태 안내와 **구분** |

로그아웃 상태에서는 `pages`가 항상 `[]`다 (FR-010).

---

## 호출자 계약 (`app/workspace/page.tsx`)

| 상황 | 해야 할 일 | 근거 |
|---|---|---|
| 삭제 버튼 | `window.confirm` 후에만 `deletePage` | FR-015 |
| 다른 페이지 선택 | 이전 페이지에 `flushPending()` → `discardIfEmpty(이전 id)` | FR-017, FR-019 |
| `pagesStatus === 'loading'` | 스켈레톤만. 빈 상태 금지 | FR-021 |
| `notice !== null` | 알림 표시 + 닫기 제공 | FR-023 |

---

## 불변식

1. **컴포넌트는 supabase-js를 직접 부르지 않는다.** (원칙 III)
2. **소유권은 스토어가 보장하지 않는다.** 스토어는 `user_id`로 필터하지 않는다 — RLS가 애초에 남의 행을 주지 않기 때문이다. 클라이언트 필터를 보안으로 쓰지 않는다(FR-007).
3. **`pages`는 항상 `createdAt` 내림차순이다.** (FR-011)
4. **로그아웃 시 `pages`는 비워진다.** (FR-010)
