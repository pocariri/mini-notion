# Implementation Plan: 페이지 서버 저장 및 소유자별 접근 제어

**Branch**: `worktree-wt1` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-supabase-page-storage/spec.md`

## Summary

페이지 영속성을 브라우저 `localStorage`에서 Supabase `public.page` 테이블로 옮기고, 소유자별 접근 제어를 **DB의 RLS 정책으로** 강제한다. 칼럼 구성은 변경하지 않는다.

접근 방식은 세 갈래다.

1. **DB**: `public.page`에 RLS 정책 4개를 추가한다. 현재 RLS 활성 + 정책 0개라 앱이 아예 동작하지 않는 상태이며, `anon` 역할에 전체 GRANT가 열려 있어 **정책이 유일한 방어선**이다.
2. **스토어**: `lib/store.tsx`가 계속 유일한 영속성 게이트웨이로 남는다(원칙 III). `profile`이 이미 쓰는 `useEffect` + supabase-js 패턴을 `page`에 확장하고, 낙관적 갱신 + 롤백, 800ms 디바운스 자동 저장을 추가한다.
3. **기능 축소**: 확정된 저장 구조에 자리가 없는 즐겨찾기·휴지통·수정 시각을 제거한다. 그 결과 Rail 내비가 4개 → 1개로 줄고, `Post` → `Page` 용어 통일이 함께 이뤄진다.

## Technical Context

**Language/Version**: TypeScript 5, React 19.2.4, Next.js 16.2.10 (App Router)

**Primary Dependencies**: `@supabase/supabase-js` 2.110.5 (고정), `lucide-react`. **신규 의존성 없음** — 데이터 페칭 라이브러리(SWR/React Query)를 도입하지 않는다(research.md R1)

**Storage**: Supabase Postgres `public.page` (기존, 구조 변경 금지). 클라이언트 `localStorage`는 페이지 저장 용도에서 완전히 제거되며, Supabase 인증 세션 보관에만 계속 쓰인다

**Testing**: Vitest 4 + `@testing-library/react` + jsdom. `lib/supabase.ts` 모듈 경계를 in-memory 대역으로 모킹(기존 방식 확장). 시간 의존 코드는 `vi.useFakeTimers()`. **RLS는 실제 DB로만 검증 가능**(research.md R6)

**Target Platform**: 브라우저 (클라이언트 전용 SPA. 모든 화면이 `'use client'`)

**Project Type**: 단일 Next.js 웹 앱 (백엔드 코드 없음. DB가 곧 백엔드)

**Performance Goals**: 로그인 후 목록 2초 이내 표시(SC-006). 연속 타이핑 중 저장 요청 미발생, 멈춘 뒤 1초 이내 저장(SC-010)

**Constraints**: `public.page` 칼럼 구성 변경 금지(사용자 제약, FR-009). 인증 방식 변경 금지(스펙 Assumptions). 운영 비용 0원(원칙 IV)

**Scale/Scope**: 개인용 노트. 사용자당 페이지 수십~수백 건. 화면 3개(`/login`, `/workspace`, `/me`) 중 `/workspace`만 실질 변경

**Unresolved**: 없음. NEEDS CLARIFICATION 항목 0건(research.md R12)

## Constitution Check

*GATE: Phase 0 이전 통과 필수. Phase 1 설계 후 재확인.*

| 원칙 | 상태 | 근거 |
|---|---|---|
| **I. 디자인 시스템 준수** (NON-NEGOTIABLE) | ✅ PASS | `DESIGN.md` §3·§5.4·§5.7·§5.8·§5.9·§5.14·§6.2를 읽고 착수. 신규 토큰 0개 — 스켈레톤은 기존 `.cover-skeleton`의 `cover-pulse` 키프레임과 `--dur-shimmer`·`--gray-100/150`을 재사용(research.md R8). 변경분은 같은 작업에서 `DESIGN.md`에 동기화 |
| **II. 프레임워크 실제 확인 우선** | ✅ PASS | `node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md:231-272`와 `02-guides/single-page-applications.md`를 실제로 읽음. 문서가 권하는 `use` API·SWR을 채택하지 않는 근거를 research.md R1에 기록 |
| **III. 단일 저장소 게이트웨이** | ✅ PASS | 모든 페이지 접근이 `lib/store.tsx`를 통과. 컴포넌트는 supabase-js를 부르지 않는다. 디바운스 저장 타이밍도 스토어가 소유(R5) |
| **IV. 제로코스트·클라이언트 우선 단순성** | ✅ PASS | 신규 의존성·서버 코드·API 라우트 0개. Supabase 무료 티어. 토스트 시스템 대신 기존 `.save-state` 확장(R9) |
| **V. 스펙 주도 개발 & 동작 검증** | ✅ PASS | `/speckit-specify` → `/speckit-clarify`(5문답) → 본 플랜. `quickstart.md`가 실제 앱 구동 검증(C1~C8)을 완료 조건으로 명시 |
| **VI. 테스트 주도 개발** (NON-NEGOTIABLE) | ✅ PASS | 모든 동작 변경에 실패 테스트 선행. 대역은 외부 경계(`lib/supabase.ts`)에만 두고 실제 칼럼 구조를 그대로 반영(R6). 목의 동작을 검증하지 않기 위해 소유자 격리는 실제 DB로 판정(quickstart B) |

**게이트 통과.** 정당화가 필요한 위반 없음 → Complexity Tracking 비움.

### 원칙 II·IV에 대한 부연

Next.js 16 문서는 클라이언트 페칭에 `use` API 또는 SWR/React Query를 제시하지만 둘 다 채택하지 않았다. `use`는 서버 컴포넌트가 promise를 내려주는 구조를 전제하는데 이 앱의 인증은 브라우저 세션 기반이라 서버가 사용자를 모른다 — 채택하려면 `@supabase/ssr` 도입이 필요하고 이는 "인증 방식 변경 금지"에 걸린다. SWR은 신규 의존성이라 원칙 IV에 걸린다. 결정적으로 **이 저장소는 이미 `profile`을 `useEffect` + supabase-js로 읽고 있어**(`lib/store.tsx:171-186`), 같은 파일 안에 두 패턴을 섞는 것보다 기존 패턴을 따르는 편이 낫다. 원칙 II는 "문서를 확인하라"이지 "문서의 모든 권고를 따르라"가 아니며, 확인 결과와 미채택 근거를 남기는 것으로 충족한다.

### 헌법 본문과의 불일치 (개정 필요)

헌법 기술 제약 절이 아직 이렇게 적혀 있다.

> **영속성**: 브라우저 `localStorage`(서버·DB 없음).
> **인증**: 목 인증. 실배포 시 `login()`을 NextAuth(Auth.js) 등 Google OAuth로 교체한다.

두 문장 모두 현재 코드와 어긋난다. 인증은 이미 실제 Google OAuth로 교체됐고(커밋 `8f673a3`), 프로필은 이미 `public.profile`에 저장된다(커밋 `f221d08`). 이번 작업으로 페이지까지 옮겨가면 `localStorage`는 페이지 저장에서 완전히 빠진다. 원칙 III·IV 자체는 유효하지만 **기술 제약 절의 서술이 낡았다.** 구현 완료 시 `/speckit-constitution`으로 개정을 제안한다(MINOR). 이번 플랜의 게이트 판정에는 영향이 없다 — 원칙 III(게이트웨이 단일화)과 IV(YAGNI)는 그대로 지켜지기 때문이다.

## Project Structure

### Documentation (this feature)

```text
specs/003-supabase-page-storage/
├── plan.md              # 이 파일
├── spec.md              # FR-001~024, SC-001~010
├── research.md          # Phase 0 — R1~R12
├── data-model.md        # Phase 1 — 저장 구조·클라이언트 모델·생애주기
├── quickstart.md        # Phase 1 — A(테스트)/B(RLS 실검증)/C(앱 구동)
├── contracts/
│   ├── rls-policies.sql # RLS 정책 4개 + 검증 계약 V1~V6
│   └── store-api.md     # 스토어 공개 API 계약
├── checklists/
│   └── requirements.md  # 16/16 통과
└── tasks.md             # /speckit-tasks 산출물 (아직 없음)
```

### Source Code (repository root)

```text
lib/
├── store.tsx          # [대폭 수정] Post→Page, localStorage→Supabase,
│                      #   낙관적 갱신+롤백, 800ms 디바운스, pagesStatus/saveStatus/notice
├── store.test.tsx     # [대폭 수정] page 테이블 in-memory 대역 추가, 실패 주입
├── supabase.ts        # [변경 없음] 브라우저 싱글턴
├── format.ts          # [변경 없음] formatDate/charCount 그대로 사용
└── format.test.ts     # [변경 없음]

components/
├── Rail.tsx           # [수정] NavKey 4개→1개, favorites/recent/trash 제거
├── Editor.tsx         # [수정] 즐겨찾기 칩·휴지통 배너·"수정 {시각}" 제거,
│                      #   .save-state를 저장 상태 표시로 확장
├── Editor.test.tsx    # [수정] 제거된 UI 테스트 삭제, 저장 상태 테스트 추가
├── PromptBox.tsx      # [변경 없음]
├── Avatar.tsx         # [변경 없음]
├── CatCover.tsx       # [변경 없음] — 스켈레톤 패턴의 원본
└── CatCover.test.tsx  # [변경 없음]

app/
├── workspace/page.tsx # [대폭 수정] filterPosts switch 제거, 스켈레톤/실패/알림 표시,
│                      #   삭제 확인, flush+discardIfEmpty 연결
├── globals.css        # [수정] .listrow-skeleton/.list-error/.list-notice 추가,
│                      #   즐겨찾기 별·trash-row-actions·trash-banner 제거
├── login/page.tsx     # [변경 없음]
└── me/page.tsx        # [변경 없음]

DESIGN.md              # [수정] §5.4 내비 축소, §5.7 스켈레톤·실패, §5.8 save-state 확장,
                       #   §8 데이터 모델 갱신 — CLAUDE.md 규칙상 같은 작업에서

(DB)                   # RLS 정책 4개 — contracts/rls-policies.sql
```

**Structure Decision**: 기존 단일 Next.js 앱 구조를 그대로 유지한다. 백엔드·API 라우트·서버 컴포넌트를 새로 만들지 않는다 — DB가 곧 백엔드이고 RLS가 곧 인가 계층이다. 새 디렉터리 없음. 변경은 `lib/store.tsx`에 집중되며(원칙 III), 나머지는 그 결과를 반영하는 표면 수정이다.

## 구현 순서 (권장)

TDD(원칙 VI)를 전제로, 의존 관계상 아래 순서를 권한다. 세부 작업 분해는 `/speckit-tasks`가 만든다.

1. **RLS 정책 먼저.** 정책 없이는 실제 DB에 대해 아무것도 확인할 수 없다. `contracts/rls-policies.sql` 적용 → `quickstart.md` B1·B2 검증.
2. **스토어 재작성** (실패 테스트 선행). 읽기 → 생성 → 수정(디바운스) → 삭제 순으로 슬라이스. 각 단계마다 롤백 경로 테스트 포함.
3. **UI 반영.** Rail 축소 → workspace(스켈레톤·실패·알림·확인) → Editor(저장 상태).
4. **제거 정리.** 즐겨찾기·휴지통·수정시각 잔재와 죽은 CSS·테스트 삭제.
5. **DESIGN.md 동기화.**
6. **전체 검증.** `quickstart.md` A·B·C 완주.

**우선순위 매핑**: 1~2가 스토리 1·2·3(P1)을 덮고, 3~4가 스토리 4(P2)와 축소 요구를 덮는다. 1~2까지만 해도 "페이지가 계정에 안전하게 저장된다"는 핵심 가치가 성립한다.

## 위험 요소

| 위험 | 영향 | 완화 |
|---|---|---|
| **RLS 정책 오작성 시 `anon`에 전체 노출** | 치명적 — 모든 사용자의 페이지가 비로그인자에게 열림 | `to authenticated` 명시. `using (true)` 금지. quickstart B3를 **반드시** 실행 |
| 목 대역이 RLS를 검증한다고 착각 | 보안 요구가 미검증인 채 완료 선언 | quickstart B를 완료 조건에 못박음. research.md R6에 한계 명시 |
| 디바운스 응답 역전으로 옛 값이 최종본 | 사용자 입력 유실 | 페이지별 "마지막 요청만 반영" 규칙(R5). 테스트로 고정 |
| 낙관적 롤백을 편집 저장에도 적용 | 사용자가 방금 친 내용이 지워짐 | FR-023(생성·삭제)과 FR-024(수정)를 분리. 계약에 명시 |
| 로딩 중 빈 상태 번쩍임 | SC-009 위반, 사용자가 데이터 유실로 오인 | `pagesStatus` 3상태로 로딩·빈·실패 구분(FR-020, FR-021) |
| 기능 축소 범위 과소평가 | `recent` 내비 등 예상 밖 연쇄 삭제 | research.md R7에 연쇄 결과 기록. 사용자에게 보고 |

## Complexity Tracking

> Constitution Check에 위반이 없으므로 비워 둔다.

해당 없음.
