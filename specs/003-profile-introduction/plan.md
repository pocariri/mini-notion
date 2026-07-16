# Implementation Plan: 자기소개 (Profile Introduction)

**Branch**: `003-profile-introduction` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-profile-introduction/spec.md`

## Summary

마이페이지 프로필 탭에 자기소개(여러 줄, 최대 150자, 선택 항목) 등록·수정·조회를 추가한다. 저장처는 이미 존재하는 `public.profile.introduction` 컬럼이며 **DB 스키마·RLS는 일절 변경하지 않는다**. 프로필 조회 실패 시 폼 전체를 오류 상태로 두고 저장을 막으며 재시도를 제공한다(clarify 확정).

**기술 접근**: (1) `lib/store.tsx` 게이트웨이 확장 — `Profile`/`User`에 `introduction` 추가, 조회 컬럼 확장, 현재 통째로 버려지는 조회 오류를 `profileStatus('loading'|'ready'|'error')` + `retryProfile()`로 노출, `updateUser`에 not-ready 가드, `resetAll`에 `introduction: null`. (2) `/me` 페이지 — 별명 아래 제어형 `<textarea maxLength={150} rows={3}>` + 기존 `.counter`, 폼 하이드레이션을 `profileStatus === 'ready'`에 게이트(스파이크로 재현한 "구글 기본값이 DB 값을 덮어쓰는" 하이드레이션 경쟁의 수정 — 이 수정 없이는 P1이 성립 불가), 실패 시 폼 비활성 + 재시도. (3) CSS — `.field-multi` 변형 + 분리된 `.field textarea` 리셋, **신규 토큰 0개**. (4) DESIGN.md 동기화(§5.12·§6.4·§8·§11 + 기존 라인 범위 드리프트 교정). 상세 근거는 [research.md](./research.md) D1~D8.

## Technical Context

**Language/Version**: TypeScript 5, React 19.2.4, Next.js 16.2.10 (App Router, 클라이언트 컴포넌트 — 버전 고정 실측)

**Primary Dependencies**: 기존 의존성만 — `@supabase/supabase-js` 2.110.5. **신규 라이브러리 0개**. Server Actions/`next/form` 불채택(문서 실측, research D1)

**Storage**: Supabase `public.profile.introduction`(text, nullable — 실재 확인, RLS 본인 행 한정). **스키마·정책 변경 금지**(FR-017). 글(localStorage) 경로는 무접촉

**Testing**: Vitest + @testing-library/react + jsdom. Supabase 경계만 목. `lib/store.test.tsx` 확장 + `app/me/page.test.tsx` 신설(현재 커버리지 0)

**Target Platform**: 모던 브라우저(데스크톱 중심, 기존 반응형 규칙 준수)

**Project Type**: Next.js 단일 웹 앱(서버 코드 없음, 브라우저 → Supabase 직접)

**Performance Goals**: 카운터 즉시 갱신(키 입력당), 저장 흐름은 기존 별명과 동일한 단일 upsert — 추가 왕복 0회

**Constraints**: DB 변경 0건(SC-007) · 조회 실패 시 저장 차단(FR-019·020, 덮어쓰기 0건 — SC-008) · 신규 토큰 0개(디자인 시스템) · 제로코스트 유지

**Scale/Scope**: 필드 1개. 소스 2파일 수정(store.tsx, me/page.tsx) + CSS 1곳 + 테스트 2파일 + DESIGN.md 동기화

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 판정 | 근거 |
|---|---|---|
| I. 디자인 시스템 준수 | ✅ PASS | DESIGN.md §3(토큰)·§5.8(유일한 여러 줄 입력 선례)·§5.12(설정)·§6.4(/me)·§7·§10 확인 완료. 필요한 토큰 전부 `:root`에 실재 — **신규 토큰 0개**. `.field-multi` 변형은 `.field`의 `:focus-within` 접근성 계약(§10 명시)을 재선언 없이 상속. DESIGN.md는 같은 작업에서 동기화하며, 발견된 기존 라인 범위 드리프트(~73줄)도 함께 교정 |
| II. 프레임워크 실제 확인 우선 | ✅ PASS | `node_modules/next/dist/docs/` 실측(16.2.10): `forms.md`는 Server Action 전제라 해당 없음, `single-page-applications.md`가 이 구성을 명시 지원, 제어형 textarea 선례는 `preserving-ui-state.md:277`. v16 breaking changes 중 클라이언트 폼 영향 0건(research D1) |
| III. 단일 저장소 게이트웨이 | ✅ PASS | introduction의 읽기·쓰기·오류 상태 전부 `lib/store.tsx` 소유. 페이지는 Store API만 소비. `profileStatus`/`retryProfile`도 게이트웨이에 둠(contracts/store-gateway.md) |
| IV. 제로코스트·클라이언트 우선(YAGNI) | ✅ PASS | 신규 의존성·서버 코드·DB 변경 0. 오류 처리도 enum 상태 1개 + 재시도 함수 1개의 최소 구성. 자동 성장·리치 텍스트·타인 공개 등 추측성 확장 불채택 |
| V. 스펙 주도 & 동작 검증 | ✅ PASS | spec(clarify 2건 완료) 기반. quickstart.md에 US1~3 실구동 시나리오 + 조회 실패 재현 절차(네트워크 차단) 정의 |
| VI. TDD (NON-NEGOTIABLE) | ✅ PASS | 하이드레이션 경쟁은 이미 스파이크로 "올바른 이유의 실패"를 확인(구글 기본값 표시) — 정식 실패 테스트로 승격 후 구현. 스토어 목의 `selectError` 확장으로 실패 경로도 red→green 가능. 버그 수정(resetAll·하이드레이션)은 재현 실패 테스트 선행(research D8) |

**Post-Phase 1 재평가**: data-model.md·contracts/·quickstart.md 확정 후 판정 변동 없음. 설계가 추가한 것은 상태 enum 1개, CSS 셀렉터 3개, 상수 1개뿐이고 전부 기존 패턴의 확장이다. 신규 영속 데이터 없음(기존 컬럼 사용 개시), 신규 의존성 없음, 신규 토큰 없음. **GATE 통과.**

## Project Structure

### Documentation (this feature)

```text
specs/003-profile-introduction/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output — D1~D8 결정 + 실측 기록
├── data-model.md        # Phase 1 output — profile 스키마(불변)·앱 타입·profileStatus 상태 기계
├── quickstart.md        # Phase 1 output — 자동 테스트 게이트 + US1~3 실구동 검증
├── contracts/           # Phase 1 output
│   ├── store-gateway.md    # Store API(R1~R7, W1~W7, X1)
│   └── me-profile-form.md  # 폼 anatomy·CSS·상태·로직(F1~F7)
└── tasks.md             # Phase 2 output (/speckit-tasks — 이 명령이 만들지 않음)
```

### Source Code (repository root)

```text
lib/
├── store.tsx            # [수정] Profile/User에 introduction, 조회 컬럼 확장,
│                        #        profileStatus + retryProfile, updateUser 가드, resetAll 초기화
└── store.test.tsx       # [수정] dbMock에 introduction·selectError 확장 + 신규 동작 테스트

app/
├── me/
│   ├── page.tsx         # [수정] 자기소개 field-block, MAX_INTRODUCTION=150,
│   │                    #        하이드레이션 게이트(profileStatus), 오류 상태 + 재시도, dirty/저장 확장
│   └── page.test.tsx    # [신규] /me 페이지 테스트(US1~3 — 하이드레이션·카운터·캡·실패·재시도)
└── globals.css          # [수정] .field-multi 변형, .field textarea 리셋(+::placeholder) — 토큰 추가 없음

DESIGN.md                # [수정] §5.12(anatomy·표·상태·React 노트), §6.4, §8(introduction 행·derivation),
                         #        §11 소스 맵 + §5.8 이후 라인 범위 드리프트 교정
```

**Structure Decision**: 기존 단일 Next.js 앱 구조 그대로. 신규 파일은 페이지 테스트 1개뿐이며 co-locate 관례(`app/login/page.test.tsx`)를 따른다. 별도 서비스/훅/컴포넌트 계층은 만들지 않는다(YAGNI) — 자기소개는 별명과 같은 폼의 필드 1개다.

## Complexity Tracking

> 헌법 위반 없음 — 기재할 항목 없다.

유일하게 스펙 범위를 넘는 듯 보일 수 있는 작업은 하이드레이션 경쟁 수정이지만, 이는 FR-008("저장된 자기소개를 채워 보여줘야 한다")·SC-008(덮어쓰기 0건)의 직접 전제 조건이며 스파이크로 실재가 검증된 결함이다(research D2). 별명 aria-label 추가(D7)는 시각·동작 변화가 없는 2줄 정합성 작업으로 FR-018에 저촉되지 않는다.
