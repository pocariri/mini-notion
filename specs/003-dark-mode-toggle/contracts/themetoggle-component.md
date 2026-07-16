# UI Contract: `ThemeToggle` 컴포넌트

**Provider**: `components/ThemeToggle.tsx` (신규)
**Consumer**: `components/Rail.tsx`(업무 사이드바), `app/me/page.tsx`(마이 페이지 사이드바)

## Props

없음 — 상태는 전적으로 `useStore()`의 `theme`/`toggleTheme`에서 얻는다. 두 사용처가 항상 같은 상태를 보게 하기 위한 의도적 제약(FR-001, 불변 조건 3).

## 렌더 계약

| 유효 테마 | 아이콘 (lucide, 15px) | 라벨 | `aria-checked` |
|---|---|---|---|
| `light` | `Moon` | `다크 모드` | `false` |
| `dark` | `Sun` | `라이트 모드` | `true` |

- 마크업: `.navitem` 클래스의 `<button type="button" role="switch">` — 기존 내비 항목과 동일한 시각 언어(SC-005).
- 라벨은 클릭 시 전환될 대상을 예고한다(FR-002, US1-AS4).
- 배치: 양쪽 레일 모두 `rail-spacer` 아래, 푸터/돌아가기 링크 위.

## 동작 계약

| 이벤트 | 결과 |
|---|---|
| 클릭 / Enter / Space | `toggleTheme()` 1회 호출 — 새로고침·내비게이션 없음(FR-003), 다른 상태 무영향(FR-004) |
| 테마 변경(어느 경로든) | 아이콘·라벨·`aria-checked`가 즉시 새 유효 테마를 반영 |

- 키보드 동작은 네이티브 `<button>`에 위임한다 — 커스텀 키 핸들러를 달지 않는다(FR-005, SC-006).
- 접근 가능한 이름은 보이는 라벨 텍스트 그대로 사용한다(별도 `aria-label` 불필요).

## 테스트 계약 (TDD 선행 목록)

1. 라이트일 때 "다크 모드" 라벨 + `aria-checked=false`로 렌더된다.
2. 클릭하면 `data-theme`가 `dark`로 바뀌고 라벨이 "라이트 모드"로 갱신된다.
3. 다시 클릭하면 라이트로 되돌아온다.
4. 두 개를 렌더해도(두 레일 상황) 하나를 클릭하면 둘 다 같은 상태를 표시한다.
5. `role="switch"`로 조회 가능하고 키보드(Enter/Space)로 전환된다.
