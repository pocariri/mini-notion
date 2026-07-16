# Runtime Contract: 테마 저장·적용 파이프라인

**Provider**: 루트 레이아웃 인라인 스크립트(`app/layout.tsx`) + `lib/store.tsx`
**Consumer**: 전역 CSS(`app/globals.css`)의 `[data-theme]` 셀렉터, `ThemeToggle` 컴포넌트

## 저장 계약 — `localStorage`

| 항목 | 값 |
|---|---|
| 키 | `mini-notion:theme` |
| 유효 값 | 문자열 `"light"` 또는 `"dark"` — 그 외 값·부재는 "선택 없음"으로 해석 |
| 쓰기 주체 | `lib/store.tsx`의 `toggleTheme()`만 (원칙 III) |
| 읽기 주체 | 인라인 스크립트(부팅 시 1회) + store(초기화 시) |
| 삭제 | 없음 — `resetAll()`은 이 키를 보존해야 한다(FR-018) |

## DOM 계약 — `<html data-theme>`

| 항목 | 값 |
|---|---|
| 속성 | `data-theme="light"` \| `data-theme="dark"` — 유효 테마와 항상 일치 |
| SSR 초기값 | `"light"` (서버는 저장소를 모름) + `suppressHydrationWarning` |
| 첫 설정 | `<head>` 인라인 스크립트가 첫 페인트 전에 실제 값으로 교정(FR-012) |
| 이후 갱신 | `toggleTheme()`과 OS 변경 반영(선택 없음일 때만, FR-016)이 즉시 갱신 |
| 전환 순간 | `theme-switching` 클래스를 얹고 리플로우 후 제거 — 트랜지션 일괄 억제(FR-003a) |

## 인라인 스크립트 계약

```
입력:  localStorage['mini-notion:theme'] (실패 허용), matchMedia('(prefers-color-scheme: dark)') (미지원 허용)
출력:  document.documentElement.dataset.theme = 유효 테마
규칙:  저장값이 "light"/"dark"면 그 값, 아니면 OS 다크 여부(판별 불가 시 light)
오류:  try/catch로 감싸 어떤 실패에도 예외를 전파하지 않는다(FR-017) — 실패 시 SSR 기본값(light) 유지
금지:  localStorage에 쓰지 않는다(불변 조건 2)
```

로직은 순수 함수로 export해 단위 테스트하고, 레이아웃에는 직렬화된 IIFE로 삽입한다.

## store 계약 — `Store` 타입 추가분

| 멤버 | 시그니처 | 동작 |
|---|---|---|
| `theme` | `'light' \| 'dark'` | 유효 테마. 초기값은 부팅 시 `<html data-theme>`에서 읽음(이중 판정 금지) |
| `toggleTheme` | `() => void` | 현재 유효 테마의 반대를 상태·`data-theme`·localStorage에 반영. 저장 실패는 무시(FR-017) |

- OS `change` 이벤트: 저장된 선택이 없는 동안만 `theme`에 반영(FR-015·016).
- `theme` 변경은 `posts`·`user`에 영향을 주지 않는다(FR-004).

## CSS 계약 — `[data-theme='dark']`

- 재정의 대상: 시맨틱 토큰(Surfaces·Text·Borders·Accent roles·신설 토큰) + `--shadow-xs/sm/md/lg` + `color-scheme: dark`.
- 원시 팔레트 토큰은 재정의하지 않는다(research.md D3).
- 모든 조합은 대비 기준(본문 4.5:1, 큰 텍스트·UI 3:1)을 충족한다(FR-009).
