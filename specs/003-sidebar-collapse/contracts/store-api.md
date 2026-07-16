# Contract: Store API 확장 (`lib/store.tsx`)

**Date**: 2026-07-16 | **Data model**: [../data-model.md](../data-model.md)

`useStore()`가 노출하는 `Store` 타입에 두 멤버를 추가한다. 기존 멤버는 변경·삭제하지 않는다(하위호환).

## 추가 멤버

```ts
type Store = {
  // ...기존 멤버 불변...
  sidebarCollapsed: boolean          // 현재 접힘 여부. 하이드레이션 전 기본값 false
  toggleSidebar: () => void          // 접힘 ↔ 펼침 반전. 유일한 전이 트리거
}
```

## 행동 계약

| # | 계약 | 근거 |
|---|---|---|
| S-1 | 최초 마운트(저장값 없음) 시 `sidebarCollapsed === false` | FR-007 |
| S-2 | `toggleSidebar()` 호출마다 값이 반전된다 (false→true→false…) | FR-001 |
| S-3 | 토글 후 `localStorage['mini-notion:sidebar-collapsed']`에 JSON boolean이 저장된다 (`ready` 이후) | FR-006 |
| S-4 | 저장값이 `"true"`면 하이드레이션 후 `sidebarCollapsed === true` | FR-006, US2 |
| S-5 | 저장값이 손상(비 JSON, 비 boolean)이어도 예외 없이 `false` | FR-007 |
| S-6 | 키는 uid를 포함하지 않는 고정 문자열이며, auth 세션 변화(로그인/로그아웃)가 값을 바꾸지 않는다 | FR-017 |
| S-7 | `ready === false`인 동안 write-through가 실행되지 않는다 (하이드레이션 전 덮어쓰기 금지) | FR-016 |
| S-8 | `resetAll()`은 이 키를 삭제하지 않는다 | research.md R5 |

## 소비자

- `app/workspace/page.tsx`, `app/me/page.tsx`: `const { sidebarCollapsed, toggleSidebar } = useStore()` → `<Rail collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar} ... />`
- 다른 소비자 없음. 컴포넌트가 localStorage를 직접 읽거나 쓰면 계약 위반 (헌법 원칙 III).

## 테스트 앵커 (`lib/store.test.tsx`)

S-1 ~ S-8 각각이 최소 1개의 실패-선행 테스트를 가진다. localStorage는 `vitest.setup.ts`의 in-memory `MemoryStorage` 실물로 검증한다(목 금지 — 헌법 원칙 VI).
