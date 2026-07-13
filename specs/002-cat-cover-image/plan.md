# Implementation Plan: 랜덤 고양이 커버 이미지 (Random Cat Cover Image)

**Branch**: `002-cat-cover-image` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-cat-cover-image/spec.md`

## Summary

에디터의 제목 입력창 바로 위에 랜덤 고양이 커버 이미지(`https://cataas.com/cat/cute`)를 표시한다. 로딩 중에는 스피너 대신 스켈레톤 UI, 실패 시에는 조용한 대체 상태를 보여주고, 커버는 저장하지 않으며 글에 진입할 때마다 새 랜덤 이미지를 요청한다(FR-009).

**기술 접근**: 새 클라이언트 컴포넌트 `CatCover`를 만들어 `Editor`의 제목 입력창 위에 배치한다. 일반 `<img>` 요소의 `load`/`error` 이벤트로 `loading → loaded | error` 3-상태를 전이하고, `key={post.id}` 리마운트로 글 전환 시 상태 초기화와 경쟁 조건(FR-008)을 동시에 해결한다. cataas 응답에 캐시 헤더가 없어(실측) 마운트 시 생성한 캐시버스터 쿼리로 "매 진입 시 새 랜덤"을 보장한다. 스켈레톤은 기존 디자인 토큰 기반 CSS pulse 애니메이션으로 구현하고, 고정 높이 커버 영역으로 레이아웃 시프트 0을 달성한다(SC-001).

## Technical Context

**Language/Version**: TypeScript 5, React 19.2.x, Next.js 16.2.x (App Router, 클라이언트 컴포넌트)

**Primary Dependencies**: 기존 의존성만 사용 — `lucide-react`(폴백 아이콘), 신규 라이브러리 추가 없음

**Storage**: N/A — 커버는 비저장(FR-009). `lib/store.tsx`·`localStorage` 변경 없음

**Testing**: Vitest + @testing-library/react + jsdom. 이미지 네트워크 로드는 jsdom이 수행하지 않으므로 `load`/`error` 이벤트 디스패치를 경계로 상태 전이를 검증

**Target Platform**: 모던 브라우저(데스크톱 중심, ≤1024px 반응형은 기존 규칙 준수)

**Project Type**: Next.js 단일 웹 앱(프론트엔드 전용, 서버·DB 없음)

**Performance Goals**: 글 진입 즉시 스켈레톤 표시(스피너 0건, SC-002), 커버 로딩이 편집 입력을 차단하지 않음(SC-003), 레이아웃 시프트 0(SC-001)

**Constraints**: 외부 API(cataas) 가용성 비보장 → `error` 이벤트 기반 폴백으로 기존 기능 100% 유지(SC-004). 오프라인에서도 앱 동작 유지

**Scale/Scope**: 열린 글당 이미지 1장, 컴포넌트 1개 + Editor 1곳 수정 + CSS + DESIGN.md 동기화

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 판정 | 근거 |
|---|---|---|
| I. 디자인 시스템 준수 | ✅ PASS | `DESIGN.md` §3(토큰)·§5.8(에디터)·§6.2(워크스페이스) 확인 완료. 커버·스켈레톤은 기존 토큰(`--gray-100/150`, `--radius-lg`, `--border-subtle`, `--text-disabled` 등)만 사용. 스켈레톤 pulse 지속시간 토큰이 없어 `--dur-shimmer`를 기존 모션 스케일과 일관되게 1개 추가하고 DESIGN.md를 같은 작업에서 동기화한다(원칙이 허용하는 절차) |
| II. 프레임워크 실제 확인 우선 | ✅ PASS | `node_modules/next/dist/docs/01-app/01-getting-started/12-images.md` 확인 완료 — 원격 이미지에 `next/image`를 쓰려면 `remotePatterns` 설정 + 수동 width/height가 필요. 랜덤 응답 특성과 상충하여 일반 `<img>` 채택(research.md D1) |
| III. 단일 저장소 게이트웨이 | ✅ PASS | 영속 상태 변경 없음. `lib/store.tsx` 미수정, `localStorage` 직접 접근 없음 |
| IV. 제로코스트·클라이언트 우선(YAGNI) | ✅ PASS | 무료 오픈 API + 클라이언트 `<img>` 요청만 사용. 서버·프록시·신규 의존성 없음. 커버 저장/변경 UI 등 추측성 확장 없음 |
| V. 스펙 주도 & 동작 검증 | ✅ PASS | spec.md(clarify 완료) 기반. quickstart.md에 실제 구동 검증 시나리오 정의(`npm run dev`로 흐름 확인 후 완료 선언) |
| VI. TDD (NON-NEGOTIABLE) | ✅ PASS | `CatCover.test.tsx`의 실패 테스트 선행 → 최소 구현 → 리팩터링. 이미지 로드는 외부 경계이므로 jsdom에서 `load`/`error` 이벤트 디스패치로 실제 동작 검증(목의 동작 검증 아님) |

**Post-Phase 1 재평가**: 설계 산출물(data-model.md, contracts/, quickstart.md) 확정 후에도 위 판정 변동 없음 — 신규 영속 데이터 없음, 신규 의존성 없음, 토큰 추가 1건은 DESIGN.md 동기화로 상쇄. **GATE 통과.**

## Project Structure

### Documentation (this feature)

```text
specs/002-cat-cover-image/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── cataas-api.md
│   └── catcover-component.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
components/
├── CatCover.tsx         # [신규] 커버 컴포넌트: loading/loaded/error 3-상태 + <img>
├── CatCover.test.tsx    # [신규] TDD 테스트(스켈레톤·로드·실패·상태 전이)
├── Editor.tsx           # [수정] 제목 입력창 위에 <CatCover key={post.id}> 삽입
└── Editor.test.tsx      # [수정] 에디터 통합 회귀(커버 존재·기존 기능 무영향) 추가

app/
└── globals.css          # [수정] .cover/.cover-skeleton/.cover-img/.cover-fallback 스타일
                         #        + :root에 --dur-shimmer 토큰 1개 추가

DESIGN.md                # [수정] §3.9 토큰 추가, §5 커버 컴포넌트 신설, §5.8·§6.2 반영
```

**Structure Decision**: 기존 단일 Next.js 앱 구조를 그대로 따른다. UI 컴포넌트는 `components/`에 co-locate 테스트와 함께 두고(기존 `Editor.tsx`/`Editor.test.tsx` 패턴), 스타일은 전역 `app/globals.css`의 토큰·클래스 체계에 추가한다. 별도 서비스/모델 계층은 만들지 않는다(YAGNI).

## Complexity Tracking

> 헌법 위반 없음 — 기재할 항목 없다.
