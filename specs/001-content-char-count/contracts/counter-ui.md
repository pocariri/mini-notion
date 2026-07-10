# Phase 1 Contract: 글자 수 카운터 (함수 + UI)

**Feature**: `001-content-char-count` | **Date**: 2026-07-10

이 앱은 외부 API가 없으므로 계약은 (1) 순수 함수 시그니처와 (2) UI 요소의 관찰 가능한 계약으로 구성한다.

---

## C1. 함수 계약 — `charCount`

**위치**: `lib/format.ts`

```ts
export function charCount(text: string): number
```

- **입력**: 임의의 문자열(`Post.content`).
- **출력**: `text.length` (UTF-16 코드 유닛 수, 0 이상 정수). 공백·줄바꿈 포함.
- **순수성**: 부수효과 없음, 동일 입력 → 동일 출력.

| # | 입력 | 기대 출력 | 근거 |
|---|---|---|---|
| C1-1 | `""` | `0` | FR-004 |
| C1-2 | `"안녕하세요"` | `5` | FR-003, Story1 AS2 |
| C1-3 | `"a b\nc"` | `5` | 공백·줄바꿈 포함(FR-003) |
| C1-4 | `"  "`(공백 2) | `2` | 공백도 계산(Edge Case) |
| C1-5 | `"👍"` | `2` | 이모지 = 코드 유닛 수(문서화된 한계) |

---

## C2. UI 요소 계약 — `.content-counter`

**위치**: `components/Editor.tsx`(`.detail-inner` 내부, `.content-input` 뒤) + `app/globals.css`

### 렌더 계약

| # | 조건 | 관찰 결과 |
|---|---|---|
| C2-1 | `post.content === ""` | 화면에 `0자` 표시 |
| C2-2 | `post.content === "안녕하세요"` | 화면에 `5자` 표시 |
| C2-3 | 사용자가 내용 칸에 타이핑 | 카운터가 즉시 `charCount(content)자`로 갱신(FR-002, 별도 조작 없음) |
| C2-4 | 사용자가 내용 칸에서 글자 삭제 | 카운터가 즉시 감소(Story1 AS3) |
| C2-5 | 제목만 변경 | 카운터 불변(FR-006) |
| C2-6 | 다른 글로 전환 | 카운터가 새 글의 `charCount`로 갱신(FR-005) |
| C2-7 | `post.deletedAt !== null`(휴지통, readOnly) | 카운터가 해당 내용의 글자 수를 표시(Edge Case) |

### 표시 형식 계약

- 텍스트: `` `${charCount(post.content)}자` `` (숫자 + "자", 레이블·구분자 없음). — FR-008

### 배치 계약

- 편집 영역(`.detail`) **우측 하단**에 위치.
- `position: sticky; bottom: 16px` — `.detail` 스크롤 시에도 항상 보임(FR-001).
- `margin-left: auto; width: fit-content` — 콘텐츠 열(760px) 우측 정렬.
- 내용 편집을 가리거나 방해하지 않음(FR-007): 옅은 pill 배경으로 내용 위에 떠도 가독성 유지.

### 스타일 토큰 계약 (신규 토큰 금지 — 원칙 I)

| 속성 | 토큰 |
|---|---|
| `font-family` | `--font-mono` |
| `font-size` | `--text-2xs` (12px) |
| `color` | `--text-tertiary` (#90908a) |
| `background` | `--surface-card` (#ffffff) |
| `border` | `1px solid --border-subtle` (#e9e9e6) |
| `border-radius` | `--radius-pill` (999px) |
| `box-shadow` | `--shadow-xs` |

---

## 계약 → 테스트 매핑

- C1-1 ~ C1-5 → `lib/format.test.ts`(`charCount` 단위 테스트).
- C2-1 ~ C2-7 → `components/Editor.test.tsx`(렌더 + `userEvent` 실시간 갱신 + readOnly).
- 배치·스타일 계약(sticky, 토큰) → `quickstart.md`의 `npm run dev` 육안 검증(SC-001, FR-001, FR-007).
