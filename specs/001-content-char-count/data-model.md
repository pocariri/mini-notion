# Phase 1 Data Model: 내용 글자 수 카운터

**Feature**: `001-content-char-count` | **Date**: 2026-07-10

## 개요

이 기능은 **새로운 영속 엔티티를 도입하지 않는다.** 글자 수는 기존 `Post.content`에서 즉석 계산되는 **파생 표시값**이며 저장되지 않는다(`lib/store.tsx` 무변경).

## 기존 엔티티 (참조, 변경 없음)

### Post (`lib/store.tsx`)

| 필드 | 타입 | 이 기능과의 관계 |
|---|---|---|
| `content` | `string` | **계산 입력**. 카운터는 이 문자열의 길이를 표시한다. |
| `title` | `string` | 무관 — 카운트에 포함하지 않음(FR-006). |
| `deletedAt` | `number \| null` | `!== null`이면 읽기 전용(휴지통). 카운터는 이 상태에서도 표시(spec Edge Cases). |
| 그 외(`id`, `favorite`, `createdAt`, `updatedAt`) | — | 무관. |

## 파생값 (신규, 비영속)

### CharacterCount

- **정의**: `charCount(content) = content.length` (UTF-16 코드 유닛 수, 공백·줄바꿈 포함).
- **출처**: 현재 편집 중인 `Post.content`.
- **수명**: 렌더 시점에 계산되어 화면에만 존재. 저장·직렬화·`localStorage` 반영 없음.
- **표시**: `<CharacterCount>자` 형식 문자열(예: `128자`).
- **검증 규칙**:
  - 입력이 빈 문자열이면 결과는 `0` → `0자`.
  - 항상 0 이상의 정수.
  - `content`가 바뀔 때마다 재계산(파생, 캐시 불필요).

## 상태 전이

해당 없음 — 파생값에는 상태 머신이 없다. `Post.content`가 바뀌면 카운트가 그 값을 그대로 따른다.
