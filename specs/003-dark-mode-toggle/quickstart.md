# Quickstart: 다크모드 — 검증 가이드

**Spec**: [spec.md](./spec.md) · 계약: [theme-runtime](./contracts/theme-runtime.md) · [ThemeToggle](./contracts/themetoggle-component.md)

## 0. 사전 준비

```bash
npm install          # 워크트리 최초 1회
npm run test:run     # 기존 52개 통과가 베이스라인
```

로그인이 필요한 화면 검증은 Google OAuth 가능한 환경(`.env.local`)이 있어야 한다. 없으면 `/login`·스플래시 범위만 실구동 검증하고 나머지는 자동 테스트로 갈음한다.

## 1. 자동 테스트 (TDD 결과 확인)

```bash
npm run test:run
```

기대: 기존 테스트 전부 + 신규(store 테마 단위, ThemeToggle 컴포넌트, 인라인 스크립트 로직 단위) 통과, 경고 0.

## 2. 실제 구동 검증 (`npm run dev`)

### 시나리오 A — 토글 즉시 전환 (US1, SC-001·007)

1. `/workspace` 진입(라이트) → 사이드바 하단에 Moon + "다크 모드" 확인.
2. 글을 하나 열어 본문에 텍스트를 입력하던 중 토글 클릭.
3. 기대: 새로고침 없이 전 화면이 즉시 다크로 전환(0.2초 이내 체감), 배경·버튼·내비가 **한 번에** 바뀜(어긋난 120ms 지연 없음, FR-003a), 입력 내용·커서·스크롤·선택 내비 유지.
4. 다시 클릭 → 라이트 복귀, 라벨 "다크 모드"로 환원.

### 시나리오 B — 깜빡임 없는 유지 (US2, SC-002)

1. 다크로 전환 후 강새로고침(Cmd+Shift+R) 반복 5회.
2. 기대: 라이트가 스쳐 보이는 프레임 0회(DevTools Performance 녹화로 확인 가능), 항상 다크로 열림.
3. 브라우저 완전 종료 → 재접속 → 다크 유지.
4. `/me` 이동 → 다크 유지 + 마이 페이지 사이드바 토글도 Sun + "라이트 모드" 상태(두 토글 일치).
5. 로그아웃 → `/login`도 다크로 표시(FR-006, US2-AS5).

### 시나리오 C — OS 설정 따름 (US3)

1. DevTools → Rendering → `prefers-color-scheme: dark` 에뮬레이션 + `localStorage.removeItem('mini-notion:theme')` 후 새로고침.
2. 기대: 다크로 열림(FR-013). 에뮬레이션을 light로 바꾸면 즉시 라이트로(FR-016).
3. 토글로 라이트 선택 → 에뮬레이션을 dark로 바꿔도 라이트 유지(FR-015).

### 시나리오 D — 엣지 케이스

- `localStorage.setItem('mini-notion:theme', 'banana')` 후 새로고침 → 오류 없이 OS 규칙으로 동작(FR-017).
- `/me` → "모든 데이터 초기화" 실행 → 로그인 화면이 **기존 테마 그대로** 열림(FR-018).
- 다크에서 4개 화면(로그인·스플래시·업무·마이) 순회 → 밝은 배경 잔재 0곳(SC-004). 특히 커버 스켈레톤, 휴지통 배너, 슬래시 메뉴, ::selection(텍스트 드래그), 전송 비활성 버튼을 눈으로 확인(research.md D3-3의 12곳).
- 키보드만으로: Tab으로 토글 도달 → Enter로 전환(SC-006).

### 시나리오 E — 대비 검증 (FR-009, SC-003)

다크 토큰 확정값에 대해 본문 4.5:1, 큰 텍스트·UI 3:1을 대비 계산기로 수치 확인하고, 결과를 `DESIGN.md` 다크 토큰 표에 기록했는지 확인.

## 3. 문서 동기화 확인

- `DESIGN.md`: §3에 다크 토큰 표(+신설 토큰), §5에 ThemeToggle, §7에 전환 규칙(트랜지션 억제) 반영. 자기검증 체크리스트의 토큰 수 갱신(기존 92 표기 + 713행의 낡은 "91개" 표기도 이번에 정정).
- 헌법 원칙 I 절차: 신설 토큰을 사용자에게 보고했는지.

## 참조

- 상태·전이: [data-model.md](./data-model.md)
- 결정 근거: [research.md](./research.md)
