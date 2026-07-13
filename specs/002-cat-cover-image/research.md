# Research: 랜덤 고양이 커버 이미지

**Date**: 2026-07-13 | **Plan**: [plan.md](./plan.md)

Technical Context에 NEEDS CLARIFICATION은 없으며, 아래는 구현 방식 결정을 위한 조사 결과다. cataas API는 실측(curl)으로 검증했고, Next.js 동작은 로컬 문서(`node_modules/next/dist/docs/`)로 확인했다.

## D1. 이미지 렌더링: 일반 `<img>` vs `next/image`

- **Decision**: 일반 `<img>` 요소를 사용한다.
- **Rationale**:
  - 로컬 문서(`01-app/01-getting-started/12-images.md`) 확인 결과, 이 Next.js 버전에서 원격 이미지를 `next/image`로 쓰려면 `next.config.ts`에 `images.remotePatterns` 등록 + `width`/`height` 수동 지정이 필요하다.
  - `next/image`의 최적화 프록시는 URL 단위로 캐시한다 — 매 진입마다 고유 캐시버스터 URL(D2)을 쓰는 이 기능과 정면 상충한다. 요청마다 최적화 파이프라인을 다시 타고 캐시만 쌓인다.
  - 커버는 장식용 랜덤 이미지라 최적화·blur placeholder의 이점이 없고, cataas가 자체 리사이즈(`?width=`)를 지원한다(실측: 원본 106KB → `width=760` 시 54KB).
  - 스켈레톤 상태 전이는 `<img>`의 네이티브 `onLoad`/`onError`로 충분히 제어된다.
- **Alternatives considered**:
  - `next/image` — 설정 오버헤드 + 최적화 캐시가 랜덤성과 상충하여 기각.
  - CSS `background-image` — load/error 이벤트를 못 받아 스켈레톤·폴백 상태 전이가 불가하여 기각.

## D2. "매 진입 시 새 랜덤" 보장: 캐시버스터 쿼리

- **Decision**: 요청 URL을 `https://cataas.com/cat/cute?width=760&_={nonce}`로 구성한다. `nonce`는 CatCover 마운트 시 1회 생성(예: `useState` 초기화 함수의 `Date.now()` + 랜덤)해 리렌더 간 안정적으로 유지한다.
- **Rationale**:
  - 실측 결과 cataas GET 응답에 `Cache-Control`/`ETag`/`Expires`가 전혀 없다 → 브라우저가 휴리스틱 캐싱을 할 수 있어, 동일 URL 재요청 시 같은 고양이가 캐시에서 반환될 수 있다. 고유 쿼리로만 FR-009(매 진입 새 랜덤)를 보장할 수 있다.
  - 실측 결과 cataas는 쿼리를 **스키마 검증**한다 — `_` 파라미터는 통과(200)하지만, `r` 등 예약 파라미터에 문자열을 넣으면 400을 반환한다(구현 중 실측으로 확인·수정). `width` 파라미터는 서버 측 리사이즈를 지원한다. `width=760`은 에디터 본문 최대 폭(`.detail-inner max-width:760px`, DESIGN.md §5.8)과 일치한다.
  - nonce를 마운트 시 1회로 고정해야 타이핑 등 리렌더마다 재요청이 발생하지 않는다(FR-006, User Story 1 시나리오 3).
- **Alternatives considered**:
  - `fetch(..., {cache: 'no-store'})` + Blob URL — 상태·해제 관리가 늘어나는 데 비해 이점 없음. 기각.
  - 렌더마다 `Date.now()` 쿼리 — 리렌더마다 이미지 재요청 폭주. 기각.
- **실측 기록 (2026-07-13)**:
  - `GET /cat/cute` → `200 image/jpeg` (~106KB), 매 요청 다른 이미지.
  - `GET /cat/cute?width=760&_=x` → `200 image/jpeg` (~54KB) — 임의 쿼리 허용 + 리사이즈 동작.
  - `GET /cat/cute?width=760&r=abc` → `400 application/json` — `r`은 숫자 전용 예약 파라미터("Expected number, received nan"). 캐시버스터로 `_`를 써야 한다.
  - `HEAD /cat/cute` → `404` (HEAD 미지원 라우트. 브라우저 `<img>`는 GET이므로 영향 없음).
  - 캐시 관련 응답 헤더 없음. CORS `access-control-allow-origin: *`.

## D3. 글 전환·경쟁 조건 처리: `key={post.id}` 리마운트

- **Decision**: `Editor`에서 `<CatCover key={post.id} />`로 렌더해, 글 전환 시 컴포넌트를 리마운트한다.
- **Rationale**:
  - 리마운트로 상태가 자동으로 `loading`으로 초기화되고 새 nonce가 생성된다 → FR-007(전환 시 재로드) 충족.
  - 이전 글의 `<img>` 요소는 DOM에서 제거되므로 늦게 도착한 load 이벤트가 새 글의 커버 상태를 오염시킬 수 없다 → FR-008(경쟁 조건) 충족. 수동 가드 코드가 필요 없는 가장 단순한 정답.
  - 기존 코드도 같은 패턴을 쓴다(`Editor.tsx:90`의 `<input key={post.id}>`) — 코드베이스 관용구와 일치.
- **Alternatives considered**:
  - `useEffect`로 `post.id` 추적 + 요청 세대(generation) 가드 — 동작은 같지만 수동 가드 코드가 늘어난다. 기각(YAGNI).

## D4. 스켈레톤 UI: 토큰 기반 CSS pulse

- **Decision**: 커버 영역 전체를 채우는 단일 블록이 `--gray-100 ↔ --gray-150` 사이를 부드럽게 오가는 pulse(opacity/배경 교차) 애니메이션. 지속시간 토큰 `--dur-shimmer: 1400ms`를 `:root` 모션 스케일에 추가한다. `prefers-reduced-motion: reduce`에서는 애니메이션을 끄고 정적 `--gray-100`으로 표시한다.
- **Rationale**:
  - 스피너 금지·스켈레톤 명시(FR-003). 기존 hover/active 표면 토큰(`--gray-100/150`)을 그대로 써 웜 뉴트럴 팔레트를 벗어나지 않는다(원칙 I).
  - 기존 모션 토큰은 120/180/260ms(전환용)뿐이라 스켈레톤 호흡 주기로 쓸 값이 없다. 매직 값 대신 토큰 1개를 스케일 위에 추가하고 DESIGN.md §3.9에 동기화한다 — 헌법 원칙 I이 정한 절차.
  - reduced-motion 대응은 DESIGN.md §10(접근성) 기조와 일치.
- **Alternatives considered**:
  - 그라디언트 shimmer sweep — 구현·토큰 수요가 더 크고, 이 앱의 절제된 모션 톤(§7)과 어울리지 않음. 기각.
  - 로딩 스피너 — 스펙에서 명시적으로 금지. 기각.

## D5. 커버 시각 규격·배치·폴백

- **Decision**:
  - **배치**: `.detail-inner` 안, 툴바(브레드크럼)와 휴지통 배너 아래·`.title-input` 바로 위. 마크업 순서: `.detail-toolbar` → (`.trash-banner`) → **`.cover`** → `.title-input`.
  - **크기**: `width:100%`(본문 폭 760px 추종), `height:180px` **고정** — 로드 전(스켈레톤)/후(이미지)/실패(폴백) 모두 동일 박스라 레이아웃 시프트 0(FR-004, SC-001). `border-radius: --radius-lg`(12px), `margin: 0 0 18px`, 이미지 `object-fit: cover`.
  - **폴백**: 같은 박스에 정적 `--gray-100` 배경 + `--border-subtle` 헤어라인 + 중앙 lucide `Cat` 아이콘(`--text-disabled`) — 오류 문구·팝업 없는 조용한 대체 상태(FR-005).
  - **접근성**: 장식 이미지이므로 `alt=""`, 스켈레톤·폴백은 `aria-hidden="true"`. 휴지통 읽기 전용 글에서도 동일 표시(스펙 엣지 케이스).
- **Rationale**: 고정 높이가 CLS 0의 가장 단순한 보장 수단. 값들은 전부 기존 토큰·기존 수치 스케일(18px 마진은 §5.9 `.empty-icon`과 동일)에서 가져왔다. `Cat` 아이콘은 이미 쓰는 lucide 라인 아이콘 체계(§9)와 일치.
- **Alternatives considered**:
  - Notion식 풀블리드(패널 전체 폭) 커버 — `.detail-inner` 패딩 구조를 깨고 수정 범위가 커짐. 본문 폭 커버가 기존 레이아웃과 더 자연스러움. 기각.
  - 재시도 버튼 폴백 — 장식 요소에 과한 UI(YAGNI). 글 재진입이 곧 재시도다. 기각.

## D6. 테스트 전략 (TDD, jsdom 경계)

- **Decision**: `CatCover.test.tsx`를 먼저 작성(Red)한 뒤 구현(Green). jsdom은 이미지를 실제 로드하지 않으므로, RTL `fireEvent.load(img)`/`fireEvent.error(img)`를 외부 경계 이벤트로 디스패치해 상태 전이를 검증한다. 스켈레톤·폴백은 텍스트가 없으므로 `data-testid`(`cover-skeleton`, `cover-image`, `cover-fallback`)로 조회한다(장식 이미지 `alt=""`는 role 조회 불가 — testid가 RTL의 정당한 최후 수단).
- **검증할 동작**(스펙 매핑):
  1. 마운트 직후 스켈레톤 표시, 스피너 부재 (FR-003, US2)
  2. `load` 이벤트 → 이미지 표시·스켈레톤 제거 (US1, US2-2)
  3. `error` 이벤트 → 폴백 표시·스켈레톤 제거 (FR-005, US3)
  4. `src`가 cataas 엔드포인트 + 캐시버스터 쿼리 포함 (FR-002, FR-009)
  5. 리렌더 시 `src` 불변(재요청 없음), `key` 변경(글 전환) 시 새 `src` + 스켈레톤 복귀 (FR-006~009)
  6. Editor 통합: 커버가 제목 입력창 앞(DOM 순서)에 렌더되고, 휴지통 글에서도 렌더되며, 기존 카운터·입력 동작 회귀 없음
- **Rationale**: 이미지 로딩은 브라우저 경계라 목이 불가피한 지점이고, 이벤트 디스패치는 목의 동작 검증이 아니라 실제 컴포넌트 로직 검증이다(헌법 VI 예외 규정 부합). 나머지 실제 네트워크 동작은 quickstart.md의 수동 시나리오로 검증한다(원칙 V).
- **Alternatives considered**: 실제 네트워크 호출 테스트 — 외부 서비스 의존으로 비결정적. 기각(수동 검증으로 대체).
