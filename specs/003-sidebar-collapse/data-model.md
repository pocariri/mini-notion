# Data Model: 사이드바 접기/펼치기

**Date**: 2026-07-16 | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

이 기능의 영속 데이터는 엔티티 1개, 필드 1개다. 기존 데이터 모델(Post, User/profile)은 변경하지 않는다.

## Entity: SidebarPreference (사이드바 표시 상태)

| 항목 | 값 |
|---|---|
| 표현 | `boolean` — `true` = 접힘, `false` = 펼침 |
| 저장 위치 | 브라우저 localStorage |
| 저장 키 | `mini-notion:sidebar-collapsed` (모듈 상수 `SIDEBAR_KEY`, `lib/store.tsx`) |
| 직렬화 | `JSON.stringify(boolean)` → 문자열 `"true"` / `"false"` |
| 기본값 | `false` (펼침) — 키 부재·파싱 실패·비 boolean 값 전부 이 값으로 정규화 (FR-007) |
| 스코프 | 기기·브라우저 단위. **uid 네임스페이스 없음** — 로그인 계정과 무관 (FR-017, Clarification Q1) |
| 소유자 | `lib/store.tsx` 단독. 컴포넌트·페이지의 localStorage 직접 접근 금지 (헌법 원칙 III) |

### 유효성·정규화 규칙

```
읽기: loadJSON<unknown>(SIDEBAR_KEY) 결과 v에 대해 → v === true ? true : false
```

- `null`(키 없음), 파싱 실패, `"yes"`, `1`, `{}` 등 모든 비정상 값 → `false`. 오류를 던지지 않는다 (FR-007, Edge case "손상된 저장값").
- 쓰기는 항상 boolean이므로 별도 검증 불필요.

### 상태 전이

```
                    toggleSidebar()
   ┌──────────┐ ──────────────────────▶ ┌──────────┐
   │ expanded │                          │collapsed │
   │  (false) │ ◀────────────────────── │  (true)  │
   └──────────┘     toggleSidebar()     └──────────┘
        ▲
        │ 초기 상태 (키 부재·손상 포함)
```

- 전이 트리거는 `toggleSidebar()` 단 하나 (FR-001). 접힘 상태에서의 검색 시도(FR-015)도 내부적으로 동일 전이를 사용한다 — 별도의 "일시 펼침" 상태는 존재하지 않는다 (FR-015a, Clarification Q2).
- 로그인·로그아웃·계정 전환은 전이를 일으키지 않는다 (FR-017). `resetAll()`도 이 키를 삭제하지 않는다 (research.md R5).

### 생명주기 (기존 posts 패턴 복제 — `lib/store.tsx` 4단계)

1. **하이드레이션**: 마운트 이펙트(기존 `useEffect [], lib/store.tsx:142-166`) 안에서 `setSidebarCollapsed(loadJSON(SIDEBAR_KEY) === true)`. splash 게이트(`ready`) 뒤에서만 레일이 페인트되므로 플래시 없음 (FR-016, research.md R6).
2. **런타임**: React state가 단일 진실. 파생 상태 없음.
3. **write-through**: `useEffect(() => { if (!ready) return; localStorage.setItem(SIDEBAR_KEY, JSON.stringify(sidebarCollapsed)) }, [sidebarCollapsed, ready])` — `ready` 게이트가 하이드레이션 전 초기값의 덮어쓰기를 방지 (기존 `lib/store.tsx:195-198`과 동일 형태).
4. **삭제**: 없음. 이 기능은 키를 삭제하는 경로를 만들지 않는다.

## 파생 표시 상태 (비영속)

| 이름 | 위치 | 정의 |
|---|---|---|
| 레일 폭 | CSS | `collapsed ? var(--rail-width-collapsed) : var(--rail-width)` |
| 텍스트 요소 표시 | CSS | `.rail.collapsed`에서 브랜드명·섹션 라벨·내비 라벨·카운트·사용자명 숨김 (FR-014) |
| 토글 버튼 aria | React | `aria-expanded={!collapsed}`, 이름 고정 (FR-010) |

전부 `sidebarCollapsed` 하나에서 파생되며 독립 상태를 갖지 않는다.
