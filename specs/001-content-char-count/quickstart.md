# Quickstart / Validation: 내용 글자 수 카운터

**Feature**: `001-content-char-count` | **Date**: 2026-07-10

이 기능이 엔드투엔드로 동작함을 증명하는 실행·검증 가이드. 구현 세부는 `tasks.md`/구현 단계, 계약은 [contracts/counter-ui.md](./contracts/counter-ui.md) 참조.

## 사전 조건

- 의존성 설치 완료(`node_modules` 존재). 없으면 `npm install`.
- 저장소 루트: `03-notion/10-notion-harness`.

## 1. 자동 테스트 검증 (TDD 게이트)

```bash
npm run test:run
```

**기대 결과**:
- `lib/format.test.ts`의 `charCount` 케이스(C1-1~C1-5) 전부 통과.
- `components/Editor.test.tsx`의 카운터 케이스(C2-1~C2-7 관련) 전부 통과.
- 기존 테스트(`format`, `store`) 회귀 없이 통과.

> TDD 순서(원칙 VI): 위 테스트를 **먼저 작성해 실패**를 확인한 뒤 구현한다. 각 테스트가 구현 전 올바른 이유로 실패했는지 확인해야 완료로 인정.

## 2. 실제 앱 육안 검증 (동작 검증 — 원칙 V)

```bash
npm run dev
# http://localhost:3000 접속 → Google(목) 로그인 → /workspace
```

검증 시나리오:

| 단계 | 조작 | 기대 (근거) |
|---|---|---|
| A | 좌측 목록에서 글 하나 선택 | 편집 영역 우측 하단에 `N자` 카운터 표시(FR-001, C2-2) |
| B | 내용 칸에 한 글자 입력 | 카운터가 즉시 +1(FR-002, SC-001) |
| C | 내용 칸에서 한 글자 삭제 | 카운터가 즉시 −1(Story1 AS3) |
| D | 내용을 모두 지움 | 카운터가 `0자`(FR-004, C2-1) |
| E | 내용을 길게 입력해 화면 스크롤 | 스크롤해도 카운터가 우측 하단에 계속 고정되어 보임(FR-001, C2-3) |
| F | 제목만 수정 | 카운터 변화 없음(FR-006, C2-5) |
| G | 다른 글로 전환 | 카운터가 새 글의 글자 수로 갱신(FR-005, C2-6) |
| H | 휴지통 글 열기 | 편집 불가여도 카운터가 글자 수 표시(Edge Case, C2-7) |
| I | 공백·줄바꿈만 입력 | 그 개수만큼 표시(Edge Case) |

## 3. 디자인 시스템 확인 (원칙 I)

- 카운터가 `--font-mono` 숫자, `--text-tertiary` 색, 옅은 pill(`--surface-card`/`--border-subtle`/`--radius-pill`/`--shadow-xs`)로 렌더되는지 확인. 신규 색·매직값이 없어야 함.
- `DESIGN.md` §5.8(Detail/editor)에 `.content-counter`가 동기화되었는지 확인.

## 완료 정의 (Definition of Done)

- [X] `npm run test:run` 전부 통과(신규 + 회귀).
- [X] 위 A~I 시나리오가 실제 앱에서 관찰됨.
- [X] 신규 디자인 토큰 0개, `DESIGN.md` 동기화 완료.
