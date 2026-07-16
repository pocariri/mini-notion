# Contract: Rail 컴포넌트 (`components/Rail.tsx` + `app/globals.css`)

**Date**: 2026-07-16 | **Research**: [../research.md](../research.md) R1–R4, R7

## Props (변경 후)

```ts
type Props = {
  user: User
  nav: NavKey
  counts: Partial<Record<NavKey, number>>
  search: string
  onNav: (key: NavKey) => void
  onSearch: (value: string) => void
  collapsed: boolean                 // [신규] 접힘 여부 — Rail은 이 값을 소유하지 않는다
  onToggleCollapse: () => void       // [신규] 토글 요청 콜백
}
```

Rail은 계속 상태 없는 presentational 컴포넌트다. `useStore()` 호출·localStorage 접근 금지.

## DOM·동작 계약

| # | 계약 | 근거 |
|---|---|---|
| C-1 | 토글은 `<button>`이며 두 상태 모두에서 렌더된다(호버 노출 금지). 레일 안 첫 번째 버튼으로 DOM 상 위치해 탭 도달 ≤5회를 보장 | FR-001a, SC-004 |
| C-2 | 토글은 `aria-expanded={!collapsed}`와 고정 `aria-label`("사이드바 접기/펼치기")을 가진다. 아이콘은 펼침 시 `PanelLeftClose`, 접힘 시 `PanelLeftOpen` (size 15) | FR-010 |
| C-3 | 토글 클릭·키보드 실행(Enter/Space) 시 `onToggleCollapse`가 정확히 1회 호출된다 | FR-001, FR-009 |
| C-4 | `collapsed`에 따라 루트가 `className="rail collapsed"` / `"rail"`로 렌더된다 — 시각 상태는 전부 이 클래스에서 파생 | data-model "파생 표시 상태" |
| C-5 | 접힘 상태에서 내비 버튼 4개는 아이콘으로 남아 `onNav`를 정상 호출하고, `.active` 클래스도 유지된다 | FR-013 |
| C-6 | 내비 라벨·카운트는 각각 `<span className="navitem-label">`·기존 `.count`로 감싸 CSS로 숨긴다. 내비 버튼은 상태와 무관하게 `aria-label={NAV_LABELS[key]}`를 가진다 | FR-014 |
| C-7 | 접힘 상태에서 `.rail-search`(input) 대신 검색 아이콘 `<button>`(`aria-label="검색"`)을 렌더한다. 클릭 시 `onToggleCollapse`를 호출하고, 펼침 완료 후 검색 input에 포커스가 놓인다 | FR-015, FR-015a |
| C-8 | 접힘 상태의 아이콘 조작부(토글·검색·내비 4·푸터 링크)는 `data-tip` 속성을 가진다. 내비의 `data-tip`은 카운트가 있으면 포함(예: `전체 글 (3)`), 푸터는 `마이 페이지` | FR-014 |
| C-9 | 브랜드명·사용자명·섹션 라벨·gear는 접힘 상태에서 시각적으로 사라진다. 푸터 링크(아바타)는 접힘 상태에서도 동작한다 | FR-014 |

## CSS 계약 (`app/globals.css`)

| # | 계약 | 근거 |
|---|---|---|
| V-1 | `:root`에 `--rail-width: 260px`, `--rail-width-collapsed: 56px` 추가. `.rail { width: var(--rail-width) }`, `.rail.collapsed { width: var(--rail-width-collapsed) }`. ≤1024px 미디어쿼리는 `--rail-width: 220px` 재정의로 전환(기존 `width:220px` 리터럴 대체) | R1, FR-011 |
| V-2 | `.rail`에 `transition: width var(--dur-base) var(--ease-standard)` — `--dur-base` 첫 사용 | R2, FR-005, SC-003 |
| V-3 | 기존 `@media (prefers-reduced-motion: reduce)` 블록(globals.css:758)에서 레일 width transition 무효화 | FR-012 |
| V-4 | 툴팁: `.rail.collapsed [data-tip]:hover::after`, `.rail.collapsed [data-tip]:focus-visible::after`에 `content: attr(data-tip)`. 스타일은 기존 토큰만 — `--surface-inverse` 배경, `#fff` 텍스트, `--radius-sm`, `--text-2xs`, `--shadow-md`. 새 색상·매직 값 금지 | R3, 헌법 원칙 I |
| V-5 | 접힘 상태 숨김 처리: `.rail.collapsed`에서 `.brand-name`, `.section-label`, `.navitem-label`, `.count`, `.rail-username`, `.gear`, `.rail-search` 숨김. 내비 아이콘·아바타는 중앙 정렬 | FR-014 |
| V-6 | 본문 확장은 flex 레이아웃 자연 동작으로 처리(별도 규칙 불필요) — 본문 잘림·겹침 없음 | FR-003 |

## 접근성 요약

- 포커스 가시성: 기존 전역 포커스 스타일 상속(신규 작업 없음 — 확인만). FR-009.
- 이름 안정성: 모든 아이콘 조작부의 `aria-label`은 접힘/펼침과 무관하게 동일. 상태는 `aria-expanded`(토글)와 `.active`(내비)로만 표현. FR-010.

## 테스트 앵커 (`components/Rail.test.tsx` 신규)

C-1 ~ C-9 각각 실패-선행 테스트 1개 이상. `Editor.test.tsx` 패턴(프로바이더 없이 noop 콜백 직접 렌더)을 따른다. V-계약 중 jsdom이 검증 못 하는 시각 값은 [quickstart.md](../quickstart.md) 실기동 시나리오로 검증한다.
