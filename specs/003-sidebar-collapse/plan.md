# Implementation Plan: 사이드바 접기/펼치기

**Branch**: `worktree-wt3` (스펙 디렉터리: `003-sidebar-collapse`) | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-sidebar-collapse/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

워크스페이스·마이 페이지 좌측 레일(`components/Rail.tsx`, 260px 고정)에 접기/펼치기 토글 버튼을 추가한다. 접힌 상태는 아이콘 전용 좁은 레일(56px)로, 내비게이션은 계속 동작하고 텍스트 요소는 감춰지되 호버·포커스 툴팁으로 확인할 수 있다. 접힘 여부는 기기·브라우저 단위 환경설정으로 `lib/store.tsx` 게이트웨이를 통해 localStorage(`mini-notion:sidebar-collapsed`)에 저장되며, 기존 `ready` 게이트 뒤에서 하이드레이션되므로 로드 시 상태가 튀지 않는다. 폭 전환은 기존 토큰 `--dur-base`(180ms) + `--ease-standard`로 애니메이션하고 `prefers-reduced-motion`에서 생략한다. Rail은 지금처럼 완전 prop 제어 컴포넌트로 유지하고(`collapsed` + `onToggleCollapse` prop 추가), 두 페이지가 store에서 값을 내려준다. 모든 프로덕션 코드는 TDD(Red-Green-Refactor)로 작성한다.

## Technical Context

**Language/Version**: TypeScript 5, React 19.2.x, Next.js 16.2.x (App Router) — 전부 클라이언트 컴포넌트 영역, 신규 프레임워크 API 불필요

**Primary Dependencies**: lucide-react 1.23.0 (기존 의존성 — `PanelLeftClose`/`PanelLeftOpen` 아이콘 제공 확인). 신규 의존성 0개

**Storage**: 브라우저 localStorage, 키 `mini-notion:sidebar-collapsed` (boolean JSON). 반드시 `lib/store.tsx` 단일 게이트웨이 경유 (헌법 원칙 III)

**Testing**: Vitest 4 + @testing-library/react + jsdom. `vitest.setup.ts`의 in-memory `MemoryStorage`로 localStorage 왕복 검증 가능. 테스트는 소스 옆 co-locate (`lib/store.test.tsx` 확장, `components/Rail.test.tsx` 신규)

**Target Platform**: 모던 브라우저(데스크톱 중심), ≤1024px 반응형 분기 포함. 서버 렌더링 표면 없음(레일은 `ready` 게이트 뒤에서만 페인트)

**Project Type**: Next.js 단일 웹앱 — 기존 `app/` + `components/` + `lib/` 구조 유지

**Performance Goals**: 토글 반영 ≤300ms (SC-003) — CSS width transition 180ms로 충족. 접힘 시 1280px 화면 기준 본문 +204px (SC-002의 ≥200px 충족: 260−56)

**Constraints**: 새 색상·매직 값 금지(디자인 토큰만, 헌법 원칙 I), 신규 인프라·의존성 금지(원칙 IV), 실패 테스트 선행 없는 프로덕션 코드 금지(원칙 VI), `DESIGN.md` 동기화 필수

**Scale/Scope**: 화면 2곳(워크스페이스·마이 페이지), 수정 파일 5개 + 신규 테스트 1개 + 문서 1개. 상태 1비트

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | 원칙 | 판정 | 근거 |
|---|---|---|---|
| I | 디자인 시스템 준수 | ✅ PASS (의무 있음) | DESIGN.md §3.9·§5.4·§5.5·§6.2 확인 완료. 접힌 폭 토큰이 없어 `--rail-width`/`--rail-width-collapsed`를 기존 스케일과 일관되게 **추가**하고, 같은 작업에서 DESIGN.md를 동기화한다(§3 토큰, §5.4 collapsed 상태·토글·툴팁, §6.2, §7 모션 사용 규칙). 신규 색상 없음 — 툴팁은 기존 `--surface-inverse` 등 재사용 |
| II | 프레임워크 실제 확인 우선 | ✅ PASS | 신규 Next.js API 사용 없음. `Rail.tsx`는 이미 `'use client'`이고 변경은 React state/props/CSS 범위. lucide 아이콘 존재는 `node_modules`에서 실물 확인 완료 |
| III | 단일 저장소 게이트웨이 | ✅ PASS | `sidebarCollapsed`/`toggleSidebar`를 `lib/store.tsx` Store 컨텍스트에 추가. 컴포넌트·페이지는 localStorage 직접 접근 금지 — Rail은 prop만 받는다 |
| IV | 제로코스트·YAGNI | ✅ PASS | 서버·DB·의존성 추가 없음. 범용 "UI 설정 객체" 추상화 대신 boolean 키 하나(FR이 요구하는 최소). 탭 간 동기화 등 범위 밖 기능 미구현 |
| V | 스펙 주도 & 동작 검증 | ✅ PASS | spec → clarify(4문항) → plan 순서 준수. 완료 선언 전 `npm run dev` 실기동 검증을 quickstart.md 시나리오로 명문화 |
| VI | TDD (NON-NEGOTIABLE) | ✅ PASS (의무 있음) | store 확장·Rail 변경 전부 실패 테스트 선행. jsdom이 검증 못 하는 CSS 선언값(폭 수치·transition·툴팁 시각)은 클래스·속성 단언으로 행동을 테스트하고, 시각 결과는 quickstart 실기동으로 검증(원칙 V와 결합). CSS 선언 자체는 설정 파일 성격으로 TDD 예외 범주 |

**위반 없음 → Complexity Tracking 불필요.**

*Post-design re-check (Phase 1 완료 후)*: 설계 산출물(research/data-model/contracts)이 위 판정을 바꾸지 않음을 확인 — 신규 토큰 2개·미사용 토큰 `--dur-base`의 첫 사용은 원칙 I의 "일관된 추가" 조항으로 허용되며 DESIGN.md 동기화 의무에 반영됨. ✅

## Project Structure

### Documentation (this feature)

```text
specs/003-sidebar-collapse/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── store-api.md     # lib/store.tsx 확장 계약
│   └── rail-component.md# Rail props·DOM·CSS·a11y 계약
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
app/
├── globals.css          # [수정] 토큰 2개 추가, .rail.collapsed 상태, 툴팁, ≤1024px·reduced-motion 분기
├── workspace/page.tsx   # [수정] store에서 collapsed/onToggleCollapse를 Rail로 배선
└── me/page.tsx          # [수정] 동일 배선 (FR-008: 두 화면 일관)

components/
├── Rail.tsx             # [수정] 토글 버튼, collapsed 렌더 분기, 라벨 span 래핑, 접힌 검색 버튼, aria
└── Rail.test.tsx        # [신규] Rail 컴포넌트 행동 테스트 (Editor.test.tsx 패턴)

lib/
├── store.tsx            # [수정] sidebarCollapsed 상태 + toggleSidebar + 키 상수 + 하이드레이션/write-through
└── store.test.tsx       # [수정] 기본값·토글·영속·손상값 복구 테스트 추가

DESIGN.md                # [수정] §3 토큰, §5.4 collapsed 상태·토글 버튼·툴팁, §6.2, §7 모션 규칙 동기화
```

**Structure Decision**: 기존 단일 Next.js 앱 구조를 그대로 사용한다. 신규 디렉터리 없음. 신규 파일은 `components/Rail.test.tsx` 하나뿐이며 co-locate 규칙을 따른다. 상태는 `lib/store.tsx`(원칙 III), 표현은 `components/Rail.tsx` + `app/globals.css`(원칙 I), 배선은 두 페이지 — 각 관심사가 기존 파일 경계와 정확히 일치하므로 구조 변경이 불필요하다.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

위반 없음 — 해당 없음.
