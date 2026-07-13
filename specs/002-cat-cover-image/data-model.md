# Data Model: 랜덤 고양이 커버 이미지

**Date**: 2026-07-13 | **Plan**: [plan.md](./plan.md)

## 영속 데이터: 변경 없음

커버는 저장하지 않는다(FR-009, Clarifications 2026-07-13). 기존 `Post` 엔티티(`lib/store.tsx`)에 필드를 추가하지 않으며, `lib/store.tsx`·`localStorage`는 일절 수정하지 않는다(헌법 III).

| 엔티티 | 변경 |
|---|---|
| `Post` (`id, title, content, favorite, createdAt, updatedAt, deletedAt`) | **없음** |
| `User` | **없음** |

## 일시 상태 (컴포넌트 로컬, 비영속)

### CoverLoadState — `components/CatCover.tsx` 내부 상태

```
CoverLoadState = 'loading' | 'loaded' | 'error'
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `state` | `CoverLoadState` | 커버 영역의 표시 상태. 초기값 `'loading'` |
| `src` | `string` (파생, 마운트 시 고정) | `https://cataas.com/cat/cute?width=760&_={nonce}`. nonce는 마운트 시 1회 생성되어 리렌더 간 불변 (research.md D2) |

### 상태 전이

```
            ┌─────────────────────────────┐
 (mount)    │                             │
──────────▶ loading ──(img load 이벤트)──▶ loaded
            │
            └──(img error 이벤트)────────▶ error

 글 전환(post.id 변경) = key 리마운트 ──▶ 어떤 상태에서든 새 인스턴스의 loading으로
```

| 전이 | 트리거 | 화면 결과 | 요구사항 |
|---|---|---|---|
| → `loading` | 마운트(글 진입/전환) | 스켈레톤 표시, 스피너 없음 | FR-003, FR-007 |
| `loading` → `loaded` | `<img>` `load` 이벤트 | 같은 박스에 이미지 표시 | FR-001, FR-004 |
| `loading` → `error` | `<img>` `error` 이벤트 | 조용한 폴백(중립 박스 + Cat 아이콘) | FR-005 |
| `loaded`/`error` → (소멸) | `post.id` 변경으로 리마운트 | 이전 인스턴스 폐기 → 늦은 이벤트 무효 | FR-008 |

### 불변 조건 (Invariants)

- 세 상태 모두 동일한 고정 크기 박스(높이 180px)를 차지한다 → 레이아웃 시프트 0 (FR-004, SC-001).
- `src`는 인스턴스 수명 동안 불변이다 → 타이핑 등 리렌더로 재요청이 발생하지 않는다 (FR-006, US1-3).
- 상태는 컴포넌트 밖으로 나가지 않는다(전역 store·localStorage 미사용) (FR-009, 헌법 III).
