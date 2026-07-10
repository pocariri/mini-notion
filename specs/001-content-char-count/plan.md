# Implementation Plan: 내용 글자 수 카운터 (Content Character Counter)

**Branch**: `001-content-char-count` | **Date**: 2026-07-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-content-char-count/spec.md`

## Summary

내용 입력 칸(`components/Editor.tsx`의 `.content-input` textarea)의 현재 텍스트 글자 수를, 편집 영역(`.detail`) 우측 하단에 스크롤과 무관하게 **고정(sticky)** 표시한다. 값은 `<숫자>자` 형식(예: `128자`)이며 입력·삭제 시 실시간 갱신된다.

기술 접근: 순수 함수 `charCount(text) = text.length`를 `lib/format.ts`에 추가(단위 테스트)하고, `Editor.tsx`의 `.detail-inner` 안 `.content-input` 뒤에 `.content-counter` 요소를 추가한다. 위치는 `position: sticky; bottom: 16px`로 편집 영역 스크롤포트 하단에 붙이고, `margin-left: auto`로 콘텐츠 열(760px) 우측에 정렬한다. 스타일은 기존 토큰(`--font-mono`, `--text-2xs`, `--text-tertiary`, `--surface-card`, `--border-subtle`, `--radius-pill`, `--shadow-xs`)만 사용한다 — 신규 토큰 0개.

## Technical Context

**Language/Version**: TypeScript 5, React 19.2.4

**Primary Dependencies**: Next.js 16.2.10 (App Router), React 19 — 신규 의존성 없음

**Storage**: 브라우저 `localStorage` via `lib/store.tsx`. 이 기능은 파생 표시값만 다루며 **저장소 변경 없음**(읽기만). 컴포넌트는 `store`를 거쳐 전달된 `post.content`를 사용한다(원칙 III 준수).

**Testing**: Vitest + `@testing-library/react` + `@testing-library/user-event` + jsdom. 대상 소스 옆 `*.test.ts(x)` co-locate.

**Target Platform**: 모던 브라우저(클라이언트 전용).

**Project Type**: 단일 Next.js 웹 애플리케이션.

**Performance Goals**: 키 입력마다 O(n) 문자열 길이 계산 — 지연 인지 없음(SC-001). 파생 렌더링만 발생.

**Constraints**: `DESIGN.md` 토큰만 사용(신규 색·매직값 금지, 원칙 I). 편집 흐름을 가리지 않는 sticky 배치(FR-007).

**Scale/Scope**: 1인용, 글 내용 수천~수만 자. `String.length`는 이 규모에서 무시 가능한 비용.

미해결 NEEDS CLARIFICATION 없음 — `/speckit-clarify`에서 배치(편집 영역 우측 하단 sticky)와 표시 형식(`N자`)을 확정함.

## Constitution Check

*GATE: Phase 0 이전 통과 필수. Phase 1 설계 후 재검토.*

| 원칙 | 판정 | 근거 |
|---|---|---|
| I. 디자인 시스템 준수 (NON-NEGOTIABLE) | ✅ Pass | `DESIGN.md` §3 토큰, §5.8(Detail/editor), §5.12(`.counter`) 선례를 읽음. 신규 토큰 0개, 기존 토큰만 사용. 컴포넌트 추가 시 `DESIGN.md` §5.8 동기화(작업에 포함). |
| II. 프레임워크 실제 확인 우선 | ✅ Pass | 신규 Next.js/React API 미사용(클라이언트 컴포넌트 JSX + CSS만 변경). 새 라우트·서버 기능 없음 → 추가 문서 확인 불필요. |
| III. 단일 저장소 게이트웨이 | ✅ Pass | `localStorage` 직접 접근 없음. `post.content`는 이미 `lib/store.tsx`를 통해 전달됨. 저장소 로직 무변경. |
| IV. 제로코스트·클라이언트 우선 (YAGNI) | ✅ Pass | 신규 의존성·인프라 0. `text.length`로 최단순 구현. grapheme 정밀 계산 등 조기 일반화 배제(research 참조). |
| V. 스펙 주도 & 동작 검증 | ✅ Pass | specify→clarify→plan 흐름 준수. 완료 전 `npm run dev`로 실제 구동 관찰(quickstart). |
| VI. 테스트 주도 개발 (NON-NEGOTIABLE) | ✅ Pass | `charCount` 단위 테스트 + `Editor` 컴포넌트 테스트를 **먼저 실패시키고** 구현. 실제 동작 테스트(목 미사용). |

**결과**: 위반 없음 → Complexity Tracking 불필요. Phase 0 진행.

## Project Structure

### Documentation (this feature)

```text
specs/001-content-char-count/
├── plan.md              # This file (/speckit-plan)
├── spec.md              # Feature spec (/speckit-specify, /speckit-clarify)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── counter-ui.md    # Phase 1 output (함수 + UI 계약)
├── checklists/
│   └── requirements.md  # 스펙 품질 체크리스트
└── tasks.md             # Phase 2 output (/speckit-tasks — 이 명령이 만들지 않음)
```

### Source Code (repository root)

```text
lib/
├── format.ts            # [수정] charCount(text: string): number 추가
└── format.test.ts       # [수정] charCount 단위 테스트 추가

components/
├── Editor.tsx           # [수정] .detail-inner 안에 .content-counter 요소 추가
└── Editor.test.tsx      # [신규] 카운터 렌더/실시간 갱신/읽기전용 표시 테스트

app/
└── globals.css          # [수정] .content-counter 클래스 추가(기존 토큰만)

DESIGN.md                # [수정] §5.8 Detail/editor에 카운터 컴포넌트 동기화
```

**Structure Decision**: 기존 단일 Next.js 앱 구조를 그대로 사용한다. 신규 디렉터리·모듈 없음. 로직의 테스트 가능한 핵심은 `lib/format.ts`의 순수 함수로 분리하고, 표시·배치는 `components/Editor.tsx` + `app/globals.css`에서 처리한다. 별도 상태·저장소 계층은 추가하지 않는다(파생값).

## Complexity Tracking

> Constitution Check 위반 없음 — 해당 없음.
