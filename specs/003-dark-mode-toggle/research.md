# Research: 다크모드 (Dark Mode)

**Spec**: [spec.md](./spec.md) · **Date**: 2026-07-16
**조사 방법**: Next.js 번들 문서 직접 확인(원칙 II), jsdom 능력 실측, `app/globals.css`·전체 `.tsx` 색상 전수 감사.

## D1. 첫 페인트 전 테마 적용 (FR-012, 깜빡임 0)

**Decision**: 루트 레이아웃 `<head>`에 인라인 `<script dangerouslySetInnerHTML>`를 넣어 `localStorage`(없으면 `matchMedia('(prefers-color-scheme: dark)')`)를 읽고 `<html data-theme="light|dark">`를 첫 페인트 전에 설정한다. `<html>`에는 `suppressHydrationWarning`을 붙인다.

**Rationale**: Next.js 16.2.10 번들 문서에 이 문제 전용 가이드가 존재한다 — `node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md`의 `## Themes` 절이 정확히 "localStorage 테마 + 첫 페인트 전 `data-theme` 설정" 패턴을 공식 예제로 제공한다(2026-07-16 원문 직접 확인). 인라인 스크립트는 HTML 파싱 중 동기 실행되므로 어떤 프레임도 잘못된 테마로 그려지지 않는다. `suppressHydrationWarning`은 스크립트가 하이드레이션 전에 바꾼 속성을 React가 수용하게 하는 문서화된 필수 짝이다.

**Alternatives considered**:
- `next/script strategy="beforeInteractive"` — 문서가 "실행이 하이드레이션을 막지 않는다"고 명시. 첫 페인트 전 보장이 없어 기각.
- `viewport.colorScheme` export — 브라우저 기본 UI 힌트일 뿐 앱 CSS를 제어하지 못하고 `localStorage`를 읽을 수 없음. 단, CSS `color-scheme` 속성은 D3에서 네이티브 컨트롤 일치용으로 병행 사용.
- React `useEffect`에서 적용 — 하이드레이션 후 실행이라 깜빡임 필연. 기각.
- (참고) `metadata.themeColor`/`metadata.colorScheme`은 Next.js 14부터 deprecated — 사용하지 않는다.

## D2. 테마 상태의 소유: `lib/store.tsx` 게이트웨이 (원칙 III)

**Decision**: 테마 상태(`theme`)와 전환(`toggleTheme`)을 `lib/store.tsx`의 `Store`에 추가한다. `localStorage` 키는 `mini-notion:theme`(값 `"light"|"dark"`, 부재 = 선택 없음). **쓰기는 store만** 수행한다. 예외 하나 — D1의 인라인 스크립트는 React 밖(하이드레이션 전)에서 실행되므로 `localStorage`를 직접 **읽는다**(쓰지 않음). 이 예외는 plan.md Complexity Tracking에 정당화를 기록한다.

**Rationale**: 헌법 원칙 III은 모든 영속 상태를 store 경유로 규정한다. 테마도 영속 상태다. 두 사이드바의 토글(FR-001)이 같은 상태를 구독해야 하므로 컨텍스트 스토어가 자연스러운 자리다. store 부팅 시 초기값은 인라인 스크립트가 이미 설정한 `document.documentElement.dataset.theme`에서 읽어 스크립트-스토어 간 이중 판정을 없앤다.

**Alternatives considered**:
- 별도 ThemeProvider 신설 — 스토어가 이미 전역 Provider로 존재하는데 Provider를 하나 더 쌓는 것은 YAGNI(원칙 IV) 위반. 기각.
- 컴포넌트에서 `localStorage` 직접 접근 — 원칙 III 위반. 기각.
- `next-themes` 라이브러리 — 신규 의존성(원칙 IV 위반)이며 D1+D2로 충분. 기각.

## D3. 다크 팔레트 전략 (FR-007·008·009, 원칙 I)

**Decision**: `[data-theme='dark']` 블록에서 **시맨틱 계층만** 재정의한다 — Surfaces 7 + Text 6 + Borders 3 + Accent roles 5 + `--shadow-xs/sm/md/lg` 4 + CSS `color-scheme: dark`. 원시 팔레트(gray/violet/hue 스케일)는 손대지 않는다. 이를 성립시키기 위한 사전 정리(라이트 외관 변화 0):

1. **`#fff` 리터럴 3곳 토큰화** — `.brand-tile`(:307)·`.login-logo`(:936)는 신규 토큰 `--text-on-inverse`(라이트: `var(--white)`)로, `.send`(:499)는 기존 `--text-on-accent`로 교체.
2. **`--text-primary`(#2f2f2b) 명시 오버라이드** — 유일하게 별칭 없는 시맨틱 토큰이라 자동으로 안 뒤집힘. 다크 블록에서 직접 재정의.
3. **원시 팔레트 직접 참조 12곳 처리** — 시맨틱 재정의로 안 따라오는 밝은 색 참조: `::selection`(:157, violet-100), `.avatar`(:268-269, violet-100/700), `.btn-danger:hover` 배경(:213, red-50), `.trash-banner` 배경(:849, red-50), 전송 비활성(:508-509, gray-200/400), 선택 로우 보더(:606, violet-300), 커버 스켈레톤·폴백(:744·751·754·772, gray-100/150). 의미가 기존 시맨틱 토큰과 일치하는 곳은 시맨틱 토큰으로 재포인팅(예: 스켈레톤 → `--surface-hover`/`--surface-active`)하고, 고유 역할인 곳(selection, avatar, danger-soft 등)은 기존 스케일과 일관된 시맨틱 토큰을 신설해 라이트 값=현재 값으로 두고 다크 블록에서 재정의한다. 신설 토큰은 `DESIGN.md`에 같은 작업에서 동기화한다(원칙 I 절차).
4. **그대로 두는 것** — `--amber-500`(별)·`--green-500`(저장 노트)·`--red-500`(위험)은 중간 명도라 다크 배경에서도 역할 대비가 성립(FR-008), 인라인 `color-mix(red-500)` 보더 2곳(:208·:847)은 토큰을 참조하므로 자동 추종. `GoogleLogo.tsx`의 브랜드색 4개는 구글 브랜드 마크라 테마와 무관하게 원본 유지(스펙 Assumptions의 외부 이미지와 같은 취급). `transparent` 리터럴들은 색이 없어 무영향.
5. **대비 검증(FR-009·SC-003)** — 다크 값 확정 시 본문 4.5:1, 큰 텍스트·UI 3:1을 수치로 검증하고 결과를 `DESIGN.md` 다크 토큰 표에 병기한다.

**Rationale**: 컴포넌트 CSS ~1,000줄은 이미 토큰만 참조하므로(감사로 확인) 시맨틱 계층 재정의만으로 화면 전체가 뒤집힌다 — 셀렉터별 다크 규칙 수백 개를 만들 필요가 없다. 원시 팔레트를 안 건드리므로 "웜 뉴트럴 + 인디고 바이올렛" 정체성(원칙 I Rationale)이 보존된다. 그림자는 잉크가 하드코딩돼 있지만 토큰 자체를 다크 블록에서 통째로 재정의하면 되므로 잉크 분리 토큰은 불필요(YAGNI).

**Alternatives considered**:
- 원시 팔레트를 다크에서 재정의(gray-50↔gray-900 뒤집기) — `--gray-50`이라는 이름이 다크에서 거짓말이 되고, 별/저장 노트처럼 뒤집으면 안 되는 참조까지 뒤집힘. 기각.
- 셀렉터별 `[data-theme='dark'] .foo` 오버라이드 전면 작성 — 유지보수 불가, 원칙 I의 토큰 체계 붕괴. 기각(고유 역할 소수에만 제한 사용).
- `prefers-color-scheme` 미디어 쿼리만으로 구현 — 사용자 명시 선택(FR-015)을 표현할 수 없음. 기각.

## D4. 운영체제 설정 추적 (FR-013·016)

**Decision**: 유효 테마는 `savedTheme ?? (systemDark ? 'dark' : 'light')` 한 줄 규칙으로만 도출한다(data-model.md). store가 `matchMedia('(prefers-color-scheme: dark)')`의 `change` 이벤트를 구독하되, **저장된 선택이 없는 동안만** 유효 테마에 반영한다(FR-016). 토글 조작 시 현재 유효 테마의 반대를 저장하며(FR-015), 첫 방문 렌더가 OS 값을 저장해 버리지 않는다(불변 조건 2). `matchMedia` 미지원 환경은 라이트로 폴백(Edge Case).

**Rationale**: "선택 없음"을 별도 저장값으로 두지 않고 키 부재로 표현하면 FR-014(2단계 토글)와 FR-016(선택 전 OS 추적)이 상태 기계 하나로 동시에 만족된다.

**Alternatives considered**: `"system"` 값을 저장 — 3-상태가 되어 FR-014와 충돌. 기각.

## D5. 전환 순간의 트랜지션 억제 (FR-003a, Clarification 3)

**Decision**: 토글 시 `<html>`에 억제 클래스(`theme-switching`)를 얹어 `.theme-switching *`에 `transition: none !important`를 적용하고, 강제 리플로우 후 같은 틱에서 제거한다. hover 등 평소 트랜지션(120ms)은 전환이 끝난 뒤 원래대로 동작한다.

**Rationale**: 감사 결과 큰 표면(body·rail·workspace)에는 트랜지션이 없고 소형 컨트롤 9곳에만 `--dur-fast` 색 전환이 걸려 있다. 그대로 두면 배경은 즉시, 컨트롤은 120ms 뒤처져 바뀌는 어긋남이 생긴다(클래리파이에서 "즉시 전환" 확정). 억제는 전환 프레임에만 국한되므로 모션 최소화 사용자와 일반 사용자가 같은 동작을 본다(Edge Case).

**Alternatives considered**: 큰 표면에도 트랜지션 추가(크로스페이드) — 클래리파이에서 기각됨. / 아무것도 안 함 — 어긋남 잔존, 기각.

## D6. 토글 컨트롤 UI (FR-001·002·005, SC-005·006)

**Decision**: 두 사이드바 모두, 기존 `.navitem` 관용구(아이콘 15px + 라벨)를 따르는 `<button>`을 하단 영역(`rail-spacer` 아래)에 둔다. 라이트일 때 Moon 아이콘 + "다크 모드", 다크일 때 Sun 아이콘 + "라이트 모드"(클릭 시 결과를 라벨로 예고 — FR-002·AS1-4). 접근성은 `role="switch"` + `aria-checked`(다크=on)로 상태를 보조 기술에 전달하고, `<button>`이므로 키보드 포커스·Enter/Space가 기본 제공된다(FR-005). 공용 컴포넌트 `ThemeToggle`로 한 번 만들어 양쪽 레일에서 사용한다(FR-001의 동일 동작 보장).

**Rationale**: `.navitem`은 두 레일이 이미 공유하는 시각 언어라 신규 스타일 없이 5초 발견성(SC-005)을 만족한다. Sun/Moon은 이미 쓰는 lucide-react 라인 아이콘 세트에 있다.

**Alternatives considered**: iOS식 스위치 위젯 신설 — 신규 컴포넌트 스타일+토큰 추가 비용 대비 이득 없음(YAGNI). 기각. / rail-footer 안에 아이콘만 — 라벨 없는 아이콘은 SC-005 위험. 기각.

## D7. 테스트 전략 (원칙 VI, TDD)

**Decision**: `vitest.setup.ts`에 `matchMedia`의 제어 가능한 in-memory 경계 구현을 추가한다(기존 `MemoryStorage`와 같은 접근 — 목이 아니라 외부 경계를 실제 동작 구현으로 채움). 테스트 헬퍼로 OS 다크 여부 설정과 `change` 이벤트 디스패치를 제공한다. 실측(2026-07-16): 이 jsdom(29.1.1)에서 `window.matchMedia`는 `undefined` — 경계 구현 없이는 store가 예외를 던진다. 테스트 대상: (a) store 단위 — 도출 규칙·전이·저장·`resetAll` 보존(FR-018)·저장소 실패 폴백, (b) `ThemeToggle` 컴포넌트 — 표시·전환·aria, (c) 통합 — 두 레일 토글 일치, `data-theme` 반영. 인라인 스크립트는 React 밖 원시 JS라 jsdom 컴포넌트 테스트 대상이 아니며, 함수를 export해 단위 검증 + quickstart 실구동(강새로고침)으로 확인한다.

**Rationale**: 헌법이 명시한 기존 패턴(localStorage in-memory 경계)을 그대로 확장한다. 시간 의존이 없어 fake timer는 불필요.

**Alternatives considered**: `vi.stubGlobal`로 테스트마다 개별 목 — 목 동작 검증 함정(testing-anti-patterns) + 반복 코드. 기각.

## 실측 기록

| 항목 | 결과 | 방법 |
|---|---|---|
| Next.js 문서의 공식 패턴 | `preventing-flash-before-hydration.md` `## Themes` 절 존재, 인라인 스크립트+`data-theme`+`suppressHydrationWarning` 예제 확인 | 2026-07-16 원문 열람 |
| jsdom `matchMedia` | `typeof === 'undefined'`, 호출 시 `not a function` | 프로브 테스트 실행 후 삭제 |
| `:root` 토큰 수 | 92개 (색 51 + 그림자 5 + 비색상 36) | `awk`/`grep` 실측 |
| 토큰 밖 색 리터럴 | `#fff` 3곳 + 그림자 잉크 rgba 6회 + `color-mix` 2곳 + GoogleLogo hex 4개, 그 외 `.tsx` 전체 클린 | 전수 감사 |
| 원시 팔레트 직접 참조(밝은 값) | 12곳 (본문 D3-3 목록) | `awk`/`grep` 실측 |
