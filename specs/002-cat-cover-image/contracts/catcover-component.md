# UI Contract: `CatCover` 컴포넌트

**파일**: `components/CatCover.tsx` (클라이언트 컴포넌트)
**소비자**: `components/Editor.tsx`

## 사용 계약

```tsx
<CatCover key={post.id} />
```

- **Props**: 없음. 랜덤 커버는 글 데이터와 무관하다(FR-009).
- **호출자 의무**: 반드시 `key={post.id}`로 렌더한다 — 글 전환 시 리마운트가 상태 초기화(FR-007)와 경쟁 조건 차단(FR-008)의 메커니즘이다(research.md D3).
- **배치**: `.detail-inner` 내부, `.detail-toolbar`(및 존재 시 `.trash-banner`) 다음, `.title-input` 바로 앞. 휴지통 읽기 전용 글에서도 동일하게 렌더한다.
- **렌더하지 않는 곳**: 빈 상태(글 미선택) — `Editor` 자체가 렌더되지 않으므로 자동 충족.

## DOM / 상태 계약

컨테이너는 상태와 무관하게 동일한 박스(높이 180px, 본문 폭 100%, `--radius-lg`)를 차지한다.

| 상태 | 표시 요소 | data-testid | 접근성 |
|---|---|---|---|
| `loading` | 스켈레톤 블록(pulse 애니메이션, `--gray-100↔--gray-150`) | `cover-skeleton` | `aria-hidden="true"` |
| `loaded` | `<img>` — cataas 이미지, `object-fit: cover` | `cover-image` | `alt=""` (장식) |
| `error` | 중립 폴백 박스 + lucide `Cat` 아이콘(`--text-disabled`) | `cover-fallback` | `aria-hidden="true"` |

- 어떤 상태에서도 회전 스피너를 렌더하지 않는다(FR-003, SC-002).
- `<img>`의 `src`는 `https://cataas.com/cat/cute`로 시작하고 `width=760`·고유 `_={nonce}` 쿼리를 포함하며, 인스턴스 수명 동안 불변이다(FR-002, FR-009, research.md D2).
- `load` 이벤트 → `loaded`, `error` 이벤트 → `error`. 그 외 전이는 없다(상태 머신은 data-model.md 참조).
- 오류 시 팝업·alert·텍스트 메시지를 표시하지 않는다(US3-1).

## 스타일 계약 (`app/globals.css`)

| 클래스 | 역할 | 핵심 값(전부 기존 토큰/스케일) |
|---|---|---|
| `.cover` | 컨테이너 | `width:100%`, `height:180px`, `margin:0 0 18px`, `border-radius:--radius-lg`, `overflow:hidden` |
| `.cover-skeleton` | 로딩 스켈레톤 | `background:--gray-100`, pulse 애니메이션 `--dur-shimmer`(신규 토큰 1400ms), `prefers-reduced-motion`에서 정적 |
| `.cover-img` | 로드된 이미지 | `width/height:100%`, `object-fit:cover`, `display:block` |
| `.cover-fallback` | 실패 폴백 | `background:--gray-100`, `border:1px solid --border-subtle`, 중앙 정렬, `color:--text-disabled` |

**신규 토큰**: `--dur-shimmer: 1400ms` — `:root` 모션 스케일(§3.9)에 추가, DESIGN.md 동기화 필수(헌법 I).

## 테스트 계약 (`components/CatCover.test.tsx`)

research.md D6의 검증 목록을 따른다. jsdom 경계: `fireEvent.load()`/`fireEvent.error()`로 이미지 이벤트를 디스패치하고, 상태별 표시는 위 `data-testid`로 조회한다.
