<!--
SYNC IMPACT REPORT
- Version change: 1.1.0 → 1.2.0 (MINOR: 실제 백엔드 반영 + 보안(RLS) 가이드라인 신설)
- Amendment: 페이지 영속성이 localStorage에서 Supabase public.page로 이전되고(스펙
  003-supabase-page-storage), 인증이 목(mock)에서 실제 Google OAuth(Supabase Auth, PKCE)로
  교체됨에 따라, 코드와 어긋난 기술 제약 서술을 현행화하고 RLS 보안 규칙을 명문화
- Principles:
  - (유지) I. 디자인 시스템 준수 / II. 프레임워크 실제 확인 우선
  - (현행화) III. 단일 저장소 게이트웨이 — 대상을 페이지·프로필로, 경계를 supabase-js 싱글턴으로 재서술.
    "향후 OAuth 교체" 문구 제거(이미 완료)
  - (현행화) IV. 제로코스트·클라이언트 우선 단순성 — "인증은 목으로 둔다" 예시 제거,
    Supabase 무료 티어를 비용 0원 수단으로 명시
  - (유지) V. 스펙 주도 개발 & 동작 검증 / VI. 테스트 주도 개발 (NON-NEGOTIABLE)
- Sections:
  - (재정의) 기술·아키텍처 제약 — 영속성(Supabase public.page/profile), 인증(실제 Google OAuth)
  - (신설) 기술·아키텍처 제약 > 보안 — RLS가 유일한 방어선, 정책 작성 규칙, 실DB 검증 의무
  - (확장) 기술·아키텍처 제약 > 테스트 — Supabase 경계 대역 규칙, "목은 RLS를 검증하지 못한다"
  - (확장) 개발 워크플로우 — DB·보안 작업의 실DB 검증 절차 추가
- Templates alignment:
  - ✅ .specify/templates/plan-template.md — Constitution Check가 헌법을 일반 참조, 수정 불필요
  - ✅ .specify/templates/spec-template.md — 정합성 확인, 수정 불필요
  - ✅ .specify/templates/tasks-template.md — TDD MANDATORY 서술 유지, 수정 불필요
  - ✅ README.md / DESIGN.md — 기능 커밋(a686c36)에서 이미 동기화됨
- Deferred TODOs: 없음
-->

# mini-notion Constitution

## Core Principles

### I. 디자인 시스템 준수 (Design-System Fidelity) — NON-NEGOTIABLE

모든 UI는 `DESIGN.md`와 `app/globals.css`의 `:root`에 정의된 토큰(색상·타이포그래피·간격·radius·shadow)만
사용해야 한다(MUST). 새로운 색상이나 매직 값 도입은 금지한다.

- UI 작업(컴포넌트 생성/수정, 스타일·클래스 변경, 디자인 토큰 사용, 레이아웃·화면 추가) 전에는
  `DESIGN.md`의 관련 섹션(§3 토큰, §5 컴포넌트, §6 화면)을 반드시 먼저 읽는다.
- 필요한 토큰이 없으면 임의 값 대신 기존 스케일과 일관되게 토큰을 추가하고, 추가 사실을 사용자에게 알린다.
- 디자인 변경(토큰/컴포넌트 변형·상태/신규 화면)이 반영되면 같은 작업 안에서 `DESIGN.md`를 동기화한다.

**Rationale**: 웜 뉴트럴 그레이 + 단일 인디고 바이올렛 액센트(`#6a5df0`)의 일관성이 이 제품의 정체성이다.
임의 값은 시스템을 조용히 무너뜨린다.

### II. 프레임워크 실제 확인 우선 (Framework Truth Over Memory)

이 저장소의 Next.js(16.2.x) / React(19.x)는 학습 데이터와 다를 수 있다. 프레임워크 코드를 작성하기 전에
`node_modules/next/dist/docs/`의 해당 가이드를 반드시 확인해야 한다(MUST).

- API·규칙·파일 구조를 기억이나 추측으로 사용하지 않는다. 불확실하면 문서와 실제 코드로 검증한다.
- deprecation 경고를 무시하지 않는다.

**Rationale**: `AGENTS.md`가 명시하듯 이 버전은 breaking change를 포함한다. 추측 기반 코드는 조용히 깨진다.

### III. 단일 저장소 게이트웨이 (Single Storage Gateway)

모든 영속 상태(페이지, 프로필)는 `lib/store.tsx`를 통해서만 읽고 써야 한다(MUST).

- 컴포넌트와 페이지는 Supabase를 직접 호출하지 않는다. supabase-js 접근은 `lib/supabase.ts`
  싱글턴 하나로 한정하며, 그 소비자는 스토어뿐이다.
- 저장 정책(자동 저장 디바운스, 낙관적 갱신과 롤백, 레거시 `localStorage` 키 정리)은 스토어가
  소유한다. 저장 타이밍·실패 처리를 UI 컴포넌트에 흩어 두지 않는다.

**Rationale**: localStorage → Supabase 이전이 실제로 이 이음새 하나로 이뤄졌다. 백엔드가 생긴 지금도
이 단일 경계가 저장소 교체·정책 변경을 국소화하고 테스트 대역의 주입 지점을 하나로 유지한다.

### IV. 제로코스트·클라이언트 우선 단순성 (Zero-Cost, Client-First Simplicity / YAGNI)

운영 비용 0원을 유지한다. 유료 인프라와 자체 서버 코드는 PRD가 실제로 요구할 때만 도입해야 한다(MUST).

- 백엔드는 Supabase 무료 티어(Postgres + Auth)로 한정한다. DB가 곧 백엔드이고 RLS가 곧 인가
  계층이다 — 별도 API 라우트·서버 컴포넌트 페칭·캐시 라이브러리는 필요가 증명되기 전에는 도입하지 않는다.
- PRD를 만족하는 가장 단순한 구현을 택하고, 추측성 일반화·조기 추상화는 지양한다.

**Rationale**: 본 프로젝트는 운영 비용 0원 MVP다. 불필요한 복잡성은 목표에 반한다.

### V. 스펙 주도 개발 & 동작 검증 (Spec-Driven Delivery & Behavior Verification)

기능은 스펙에서 출발해야 한다(MUST). `/speckit-specify → /speckit-plan → /speckit-tasks → /speckit-implement`
흐름을 따른다.

- 새 기능·동작 변경 등 창작 작업 전에 의도·요구·설계를 먼저 정리(brainstorm)한다.
- "완료"를 선언하기 전, 실행 중인 앱에서 해당 흐름을 직접 구동해 동작을 확인한다.
  타입체크·빌드 통과만으로 완료로 간주하지 않는다.
- 변경은 작고 리뷰 가능한 단위로 나눈다.

**Rationale**: 스펙과 실제 동작 검증이 결과 품질의 기준선이다.

### VI. 테스트 주도 개발 (Test-Driven Development) — NON-NEGOTIABLE

모든 프로덕션 코드는 실패하는 테스트를 먼저 작성한 뒤에만 작성해야 한다(MUST).
superpowers `test-driven-development` 스킬의 규칙을 그대로 따른다.

- **Iron Law**: 실패하는 테스트 없이는 프로덕션 코드를 작성하지 않는다.
  테스트보다 먼저 작성된 프로덕션 코드는 삭제하고 테스트부터 다시 시작한다.
- **Red → Green → Refactor**: (1) 하나의 동작에 대한 실패 테스트 작성 → (2) 실패를 눈으로 확인 →
  (3) 통과할 최소 코드 작성 → (4) 통과 확인 → (5) 그린 상태에서 리팩터링.
- **실제 동작 테스트**: 목은 불가피할 때만, 외부 경계(예: 브라우저 API, 네트워크)에서만 사용한다.
  목의 동작을 검증하지 않는다. 프로덕션 클래스에 테스트 전용 메서드를 추가하지 않는다.
  목은 실제 데이터 구조를 완전하게 반영한다. (`test-driven-development/testing-anti-patterns.md` 준수)
- **버그 수정**: 재현하는 실패 테스트를 먼저 작성한 뒤 고친다.
- **완료 기준**: 모든 신규 함수/동작에 테스트가 있고, 각 테스트가 구현 전 올바른 이유로 실패했음을
  확인했으며, 전체 테스트가 경고 없이 통과해야 완료로 선언한다.

**예외(사용자 승인 필요)**: 버리는 프로토타입, 생성 코드, 설정 파일.

**Rationale**: 먼저 실패를 보지 않은 테스트는 올바른 것을 검증하는지 알 수 없다. TDD는 회귀를 막고
리팩터링을 가능하게 하며, 스펙 주도 흐름(원칙 V)의 실행 계층을 이룬다.

## 기술·아키텍처 제약 (Technology & Architecture Constraints)

- **프레임워크**: Next.js 16.2.x (App Router), React 19.2.x, TypeScript 5. 모든 화면은 클라이언트
  컴포넌트(`'use client'`)이며 자체 API 라우트·서버 코드가 없다.
- **UI**: Pretendard Variable(로컬 폰트), Lucide 라인 아이콘, 단일 액센트 `#6a5df0`, 헤어라인 보더, 부드러운 라운드.
- **영속성**: Supabase Postgres. 페이지는 `public.page`(id·created_at·title·content·user_id —
  칼럼 구성 확정, 변경 금지), 프로필은 `public.profile`. 상태 로직은 `lib/store.tsx`에 집중한다(원칙 III).
  `localStorage`에는 Supabase 인증 세션만 남으며, 이전 구조의 레거시 키(`mini-notion:posts`,
  `mini-notion:user` 등)는 초기화 시 제거하고 서버로 이관하지 않는다.
- **인증**: Supabase Auth의 실제 Google OAuth(PKCE, 브라우저 세션 — `lib/supabase.ts` 싱글턴).
  로그인한 사용자만 페이지를 생성·조회·수정·삭제할 수 있다.
- **보안**: 소유자별 접근 제어는 DB의 RLS 정책으로 강제해야 한다(MUST). 클라이언트의 소유자 필터는
  편의와 전송량을 위한 것일 뿐 보안 경계가 아니다. 노출 스키마의 테이블 GRANT가 `anon`에게 열려
  있으므로 **정책이 유일한 방어선**임을 전제로 작성한다 — `to authenticated`를 명시하고
  `(select auth.uid()) = user_id` 술어를 쓰며, UPDATE 정책은 `using`과 `with check`를 모두 둔다.
  `using (true)`와 `auth.role()` 조건은 금지한다.
- **테스트**: Vitest + `@testing-library/react` + jsdom 환경. 실행은 `npm test`(watch) / `npm run test:run`(1회).
  테스트는 대상 소스 옆에 `*.test.ts(x)`로 co-locate 한다. 설정은 `vitest.config.ts`, 공통 셋업은 `vitest.setup.ts`.
  이 jsdom 빌드가 `localStorage`를 구현하지 않으므로, `vitest.setup.ts`에서 완전한 in-memory Storage를
  경계 구현으로 제공한다. Supabase 경계는 `lib/supabase.ts` 모듈을 in-memory 대역으로 모킹하되,
  대역은 실제 칼럼 구조를 그대로 반영하고 실패 주입을 지원한다. **목(대역)은 RLS를 검증하지 못한다** —
  접근 제어 규칙은 반드시 실제 DB에 대해 확인한다. 시간 의존 코드는 `vi.useFakeTimers()`로 결정적으로 테스트한다.
- **화면**: `/login`, `/workspace`(3-pane + `/page` 슬래시 메뉴 + 로딩 스켈레톤·빈 상태·실패 상태 구분), `/me`.
  신규 화면은 `DESIGN.md` §6 화면 규격을 따른다.

## 개발 워크플로우 (Development Workflow)

- **TDD 사이클(모든 코드 변경)**: 실패 테스트 작성 → `npm run test:run`으로 실패 확인 →
  최소 구현 → 통과 확인 → 리팩터링(그린 유지). (원칙 VI)
- **UI 작업**: `DESIGN.md` 관련 섹션 읽기 → (TDD로) 구현 → 디자인 변경 시 `DESIGN.md` 동기화.
- **프레임워크 작업**: `node_modules/next/dist/docs/`의 관련 가이드 확인 → 구현.
- **DB·보안 작업**: RLS 정책 등 접근 규칙의 추가·변경은 자동 테스트로 대체할 수 없다.
  실제 DB에 대해 거부되어야 할 접근(비로그인·타 소유자)이 거부되고 허용되어야 할 접근이
  허용됨을 확인한 뒤 완료로 선언한다. Supabase security advisor 경고를 함께 점검한다.
- **검증**: 테스트 통과에 더해, 런타임 표면이 있는 변경은 `npm run dev`로 실제 구동을 관찰한 뒤 완료로 선언한다.
- **산출물 위치**: 스펙킷 산출물(spec.md / plan.md / tasks.md 등)은 `specs/[###-feature]/`에 둔다.

## Governance

이 헌법은 다른 개발 관행보다 우선한다. 원칙과 충돌하는 결정은 `plan.md`의 Complexity Tracking에 정당화를 기록하거나
폐기해야 한다.

- **개정 절차**: 모든 개정은 문서화하고 Semantic Versioning으로 버전을 올린다 —
  MAJOR(원칙 제거·재정의 등 하위호환 불가), MINOR(원칙/섹션 추가·실질적 확장), PATCH(문구 정리·오타 수정).
- **동기화 대상**: `CLAUDE.md`, `AGENTS.md`, `DESIGN.md`는 런타임 지침 문서이며, 헌법 개정 시 함께 동기화한다.
- **준수 확인**: 모든 리뷰와 구현은 본 헌법 준수를 확인한다. 특히 NON-NEGOTIABLE 게이트인
  원칙 I(디자인 시스템)과 원칙 VI(TDD)는 예외 없이 검증한다. 프로덕션 코드에는 먼저 실패한 테스트가
  반드시 존재해야 하며, 복잡성은 YAGNI(원칙 IV) 대비 정당화되어야 하고, 접근 제어 변경은
  실제 DB 검증 증거를 동반해야 한다.

**Version**: 1.2.0 | **Ratified**: 2026-07-09 | **Last Amended**: 2026-07-16
