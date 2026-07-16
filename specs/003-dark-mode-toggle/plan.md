# Implementation Plan: 다크모드 (Dark Mode)

**Branch**: `worktree-wt2` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-dark-mode-toggle/spec.md`

## Summary

두 사이드바(업무·마이 페이지)에 공용 `ThemeToggle`을 두고, 클릭 시 전체 앱을 라이트↔다크로 즉시 전환한다. 선택은 `localStorage`(`mini-notion:theme`, 기기 단위)에 저장하고, 선택이 없으면 OS 설정을 따른다.

**기술 접근**: Next.js 16 공식 문서(`preventing-flash-before-hydration.md` `## Themes`)의 패턴 그대로 — 루트 레이아웃 `<head>` 인라인 스크립트가 첫 페인트 전에 `<html data-theme>`를 설정(깜빡임 0, FR-012)하고, CSS는 `[data-theme='dark']` 블록에서 **시맨틱 토큰 계층만** 재정의한다(원시 팔레트 불변 — 브랜드 정체성 보존). 테마 상태·전환은 헌법 원칙 III대로 `lib/store.tsx`에 `theme`/`toggleTheme`로 추가한다. 전환 순간에는 트랜지션을 일괄 억제해 배경·컨트롤이 한 번에 바뀌게 한다(FR-003a). 사전 정리로 토큰 밖 색 리터럴(`#fff` 3곳)을 토큰화하고 원시 팔레트 직접 참조 12곳을 시맨틱화한다(research.md D3).

## Technical Context

**Language/Version**: TypeScript 5, React 19.2.x, Next.js 16.2.10 (App Router)

**Primary Dependencies**: 기존 의존성만 — lucide-react(Sun/Moon 아이콘). 신규 라이브러리 0개(next-themes 등 기각, research.md D2)

**Storage**: 브라우저 `localStorage` 키 1개(`mini-notion:theme`). Supabase/`public.profile` 변경 없음(기기 단위 저장, FR-011)

**Testing**: Vitest 4 + @testing-library/react + jsdom 29. jsdom에 `matchMedia`가 없어(실측) `vitest.setup.ts`에 제어 가능한 경계 구현 추가(기존 MemoryStorage 패턴)

**Target Platform**: 모던 브라우저. `matchMedia` 미지원 시 라이트 폴백

**Project Type**: Next.js 단일 웹 앱(프론트엔드 전용)

**Performance Goals**: 토글 후 0.2초 이내 전체 전환(SC-001), 첫 페인트부터 올바른 테마 — 잘못된 테마 프레임 0(SC-002)

**Constraints**: 라이트 테마 외관 변화 0(리터럴 토큰화·재포인팅은 값 보존), 대비 본문 4.5:1·UI 3:1(FR-009), 전환 시 작업 상태 보존(FR-004)

**Scale/Scope**: 신규 컴포넌트 1(ThemeToggle) + store 확장 + 레이아웃 인라인 스크립트 + CSS 다크 블록 1 + 사전 정리 ~15곳 + DESIGN.md 동기화. 화면 4개 전부 적용

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 판정 | 근거 |
|---|---|---|
| I. 디자인 시스템 준수 | ✅ PASS | `DESIGN.md` §3(토큰 92개)·§5.4(레일)·§7(모션)·§10(접근성) 확인 완료. 다크는 시맨틱 토큰 재정의로만 구현, 원시 팔레트·액센트 정체성 불변. 신설 토큰(`--text-on-inverse` 등 소수)은 기존 스케일과 일관되게 추가하고 같은 작업에서 DESIGN.md 동기화 + 사용자 보고(원칙이 허용하는 절차). 자기검증 체크리스트의 낡은 "91개" 표기도 함께 정정 |
| II. 프레임워크 실제 확인 우선 | ✅ PASS | `node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md` 원문 직접 확인(2026-07-16) — 인라인 스크립트+`data-theme`+`suppressHydrationWarning`이 공식 예제. `beforeInteractive`가 페인트를 막지 않는다는 명시, `metadata.colorScheme` deprecated(v14)도 확인해 회피(research.md D1) |
| III. 단일 저장소 게이트웨이 | ✅ PASS (예외 1건 정당화) | 테마 상태·쓰기는 전부 `lib/store.tsx` 경유. 유일한 예외 — 첫 페인트 전 인라인 스크립트의 localStorage **읽기** — 는 React 부팅 전이라 store가 존재할 수 없는 시점. Complexity Tracking에 기록 |
| IV. 제로코스트·클라이언트 우선(YAGNI) | ✅ PASS | 신규 의존성 0, 서버 왕복 0. ThemeProvider 신설·3-상태 토글·기기 간 동기화 등 확장 기각(research.md D2·D4) |
| V. 스펙 주도 & 동작 검증 | ✅ PASS | spec.md(clarify 3건 완료) 기반. quickstart.md에 실구동 시나리오 A–E 정의, 깜빡임은 강새로고침·Performance 녹화로 검증 |
| VI. TDD (NON-NEGOTIABLE) | ✅ PASS | 실패 테스트 선행: store 테마 단위 → ThemeToggle 컴포넌트 → 통합(두 레일 일치). `matchMedia`는 경계 구현(목 아님)으로 실제 전이 검증. 인라인 스크립트 로직은 순수 함수로 분리해 단위 테스트(contracts/theme-runtime.md) |

**Post-Phase 1 재평가**: 설계 산출물(data-model.md, contracts/ 2건, quickstart.md) 확정 후 판정 변동 없음 — 신규 영속 키 1개는 store 게이트웨이 계약에 포함, 신설 토큰은 DESIGN.md 동기화로 상쇄, 예외 1건은 아래에 정당화. **GATE 통과.**

## Project Structure

### Documentation (this feature)

```text
specs/003-dark-mode-toggle/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── theme-runtime.md
│   └── themetoggle-component.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
lib/
├── theme.ts             # [신규] 유효 테마 도출 순수 함수 + 인라인 스크립트 소스(직렬화용)
├── theme.test.ts        # [신규] TDD: 도출 규칙·손상값·저장/부재 조합
├── store.tsx            # [수정] Store에 theme/toggleTheme 추가, matchMedia 구독(선택 없음일 때만)
└── store.test.tsx       # [수정] 테마 전이·resetAll 보존(FR-018)·저장 실패 폴백 추가

components/
├── ThemeToggle.tsx      # [신규] role="switch" 토글(contracts/themetoggle-component.md)
├── ThemeToggle.test.tsx # [신규] TDD: 라벨/아이콘/aria/전환/이중 렌더 일치
└── Rail.tsx             # [수정] rail-spacer 아래 <ThemeToggle /> 삽입

app/
├── layout.tsx           # [수정] <html data-theme="light" suppressHydrationWarning> + head 인라인 스크립트
├── me/page.tsx          # [수정] 마이 페이지 레일에 <ThemeToggle /> 삽입
└── globals.css          # [수정] :root 정리(#fff 토큰화, 신설 토큰, 원시 참조 12곳 시맨틱화)
                         #        + [data-theme='dark'] 블록(시맨틱+그림자+color-scheme)
                         #        + .theme-switching 트랜지션 억제

vitest.setup.ts          # [수정] matchMedia in-memory 경계 구현 + 테스트 헬퍼
DESIGN.md                # [수정] §3 다크 토큰 표·신설 토큰, §5 ThemeToggle, §7 전환 규칙, 검증 체크리스트 정정
```

**Structure Decision**: 기존 단일 Next.js 앱 구조 유지. 테마 로직은 원칙 III에 따라 `lib/`(store 확장 + 순수 함수 모듈), UI는 `components/`에 co-locate 테스트와 함께(기존 CatCover 패턴). CSS는 전역 `globals.css`의 토큰 체계 안에서만 확장한다.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 인라인 스크립트가 `localStorage`를 store 밖에서 직접 읽음(원칙 III 예외) | FR-012(깜빡임 0)는 첫 페인트 전 실행을 요구 — React·store가 아직 존재하지 않는 시점이라 게이트웨이 경유가 물리적으로 불가능 | "store 초기화 후 useEffect 적용"은 하이드레이션 후 실행이라 깜빡임 필연(Next.js 문서도 동일 진단). 읽기 1회로 국한하고 쓰기는 전부 store가 수행하며, 키 상수를 공유해 이탈을 방지 |
| `<html>`에 `suppressHydrationWarning` 추가 | 인라인 스크립트가 하이드레이션 전에 `data-theme`를 바꾸므로 React가 SSR 값과의 불일치를 수용해야 함 | 미사용 시 React가 하이드레이션 불일치로 복구 렌더 → 깜빡임 재발. Next.js 문서가 이 패턴의 필수 짝으로 명시. 적용 범위는 `<html>` 요소 1곳의 속성 비교뿐 |
