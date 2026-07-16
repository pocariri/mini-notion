# Phase 1 Data Model: 페이지 서버 저장 및 소유자별 접근 제어

**Feature**: `specs/003-supabase-page-storage` | **Date**: 2026-07-16

---

## 1. 저장 구조 (변경 금지)

`public.page`는 이미 존재하며 **칼럼 구성을 변경하지 않는다**(FR-009, 사용자 제약). 아래는 실제 DB에서 읽어온 현재 구조다.

| 칼럼 | 타입 | Null | 기본값 | 비고 |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `created_at` | `timestamptz` | NOT NULL | `now()` | 정렬 기준 (FR-011) |
| `title` | `text` | NULL 허용 | — | 빈 제목 가능 |
| `content` | `text` | NULL 허용 | — | 빈 내용 가능 |
| `user_id` | `uuid` | **NOT NULL** | — | FK → `auth.users.id` (`page_user_id_fkey`) |

- **RLS**: 활성. **정책 0개 → 현재 전면 거부.**
- **GRANT**: `authenticated`, `anon` 모두 `SELECT/INSERT/UPDATE/DELETE` 보유. → **RLS가 유일한 방어선**(research.md R3).
- 테이블 코멘트: "미니 노션에 페이지 관리하는 테이블입니다."

### 구조에 없는 것 (기능 제거의 원인)

| 없는 칼럼 | 이 때문에 제거되는 것 | 근거 |
|---|---|---|
| `favorite` | 즐겨찾기 전체 | FR-012 |
| `deleted_at` | 휴지통·복원·소프트 삭제 | FR-012 |
| `updated_at` | 수정 시각 표시, 최근 수정순 정렬, `recent` 내비 | FR-013, research.md R7 |

---

## 2. 클라이언트 모델

```ts
// lib/store.tsx
export type Page = {
  id: string        // uuid, 클라이언트 생성 (research.md R4)
  title: string     // DB NULL → '' 로 정규화
  content: string   // DB NULL → '' 로 정규화
  createdAt: number // epoch ms. DB created_at(timestamptz)에서 변환
}
```

**기존 `Post`에서의 변화**: `favorite`·`updatedAt`·`deletedAt` 3개 필드 삭제, 타입명 `Post` → `Page`(Q5 결정).

### 매핑 규칙

| DB | 클라이언트 | 변환 |
|---|---|---|
| `id` | `id` | 그대로 |
| `title` | `title` | `?? ''` — NULL을 빈 문자열로 |
| `content` | `content` | `?? ''` — NULL을 빈 문자열로 |
| `created_at` | `createdAt` | `Date.parse(created_at)` → epoch ms |
| `user_id` | (없음) | 클라이언트 모델에 담지 않음. 세션이 곧 소유자이고, RLS가 남의 행을 애초에 주지 않는다 |

`title`/`content`를 `''`로 정규화하는 이유: 기존 UI가 `post.title || '제목 없음'`, `post.content.split('\n')[0]`처럼 문자열임을 전제한다(`app/workspace/page.tsx:142-148`). `null`이 새면 런타임 오류가 난다. 경계에서 한 번 정규화하는 편이 UI 전체에 `?.`를 뿌리는 것보다 낫다.

---

## 3. 생애주기 (State Transitions)

```
[없음]
   │ 새 페이지 만들기 (FR-018)
   ▼
[빈 페이지 · 편집기 열림]  ── 제목/내용 입력 ──▶ [내용 있는 페이지]
   │                                                  │
   │ 아무것도 입력 없이 이탈                            │ 삭제 + 확인 (FR-015)
   │ (FR-019, 확인 없음)                               │
   ▼                                                  ▼
[삭제됨 — 영구]  ◀───────────────────────────── [삭제됨 — 영구]
```

- 중간 상태(휴지통) 없음. 삭제는 단일 방향, 복원 불가(FR-012).
- 자동 삭제(FR-019)와 사용자 삭제(FR-005)는 같은 최종 상태에 도달하지만 **확인 절차가 다르다** — 자동 삭제는 확인을 묻지 않는다.
- "빈 페이지"의 정의: `title === '' && content === ''`. 둘 중 하나라도 있으면 정상 페이지다(스펙 엣지 케이스).

---

## 4. 검증 규칙

| 규칙 | 강제 위치 | 근거 |
|---|---|---|
| 소유자 없는 페이지 불가 | DB `user_id` NOT NULL + RLS `with check` | FR-003 |
| 본인 페이지만 조회 | **RLS SELECT 정책** | FR-004, FR-007 |
| 본인 페이지만 수정 | **RLS UPDATE 정책** (`using` + `with check`) | FR-006, FR-007 |
| 본인 페이지만 삭제 | **RLS DELETE 정책** | FR-005, FR-007 |
| 로그인해야 생성 | **RLS INSERT 정책** (`to authenticated`) | FR-002 |
| 제목·내용 빈 값 허용 | 없음 (칼럼 NULL 허용) | 스펙 엣지 케이스 |

**핵심**: 소유권 규칙은 전부 DB에서 강제된다. 클라이언트 필터는 UX용일 뿐 보안 경계가 아니다(FR-007).

---

## 5. 정렬·필터

- **정렬**: `created_at` 내림차순 (FR-011). 서버에서 `.order('created_at', { ascending: false })`.
- **검색**: 클라이언트에서 `title`/`content` 부분 일치(기존 동작 유지). 서버 검색으로 바꾸지 않는다 — 개인 페이지 수가 적고, 원칙 IV(YAGNI).
- **필터 없음**: `deleted_at`이 없으므로 목록 필터링 자체가 사라진다. 기존 `filterPosts`의 4갈래 switch는 검색 필터만 남는다(research.md R7).

---

## 6. 엔티티 관계

```
auth.users (1) ──────< (N) public.page
     │                        user_id FK
     │
     └──────────────── (1) public.profile
                            user_id FK (unique)
```

`profile`은 이번 기능에서 변경하지 않는다(스펙 Assumptions). `page`와 `profile`은 서로 참조하지 않고 각자 `auth.users`만 가리킨다.
