# Quickstart: 자기소개 검증 가이드

**Feature**: [spec.md](./spec.md) | 계약: [store-gateway](./contracts/store-gateway.md) · [me-profile-form](./contracts/me-profile-form.md)

구현 완료를 선언하기 전에 이 문서의 시나리오를 실제로 구동해 확인한다(헌법 원칙 V — 타입체크·빌드 통과만으로 완료 선언 금지).

## 사전 조건

- `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 설정, 구글 로그인 가능한 계정.
- 의존성 설치: `npm install`

## 1. 자동 테스트 (필수 게이트)

```bash
npm run test:run
```

**기대**: 전체 통과, 경고 0. 신규 커버리지 — `lib/store.test.tsx`(introduction 조회/저장/초기화, profileStatus 전이, 실패 시 updateUser 거부), `app/me/page.test.tsx`(하이드레이션 게이트, 카운터, 150 캡, dirty/저장 게이트, 실패·재시도). 각 신규 테스트는 구현 전 실패를 먼저 확인했어야 한다(원칙 VI).

## 2. 실제 구동 검증

```bash
npm run dev
```

http://localhost:3000/login 에서 구글 로그인 후 `/me` 이동.

### US1 — 등록·조회 (P1)

1. 프로필 탭에서 별명 아래 "자기소개" 여러 줄 입력란 확인(3줄 안팎, 카운터 `#0/150`).
2. 줄바꿈 포함 2~3줄 입력 → 저장 → "저장되었습니다." 확인.
3. **새로고침** → 같은 내용(줄바꿈 포함)이 입력란에 채워져 있는지 확인. ← 하이드레이션 게이트 검증 포인트: 새로고침 직후 입력란에 구글 이름 기반 기본 상태가 스쳐 보이면 실패다.
4. 로그아웃 → 재로그인 → `/me` → 내용 유지 확인.
5. (선택) Supabase 대시보드에서 `public.profile` 행의 `introduction` 값·줄바꿈 확인.

### US2 — 수정·비우기 (P2)

1. 내용을 다른 문장으로 고쳐 저장 → 새로고침 → 새 내용 확인.
2. 전부 지우고 저장 → 새로고침 → 빈 입력란 + placeholder 확인. DB에서 `introduction`이 **NULL**(빈 문자열 아님)인지 확인.
3. 별명과 자기소개를 동시에 고쳐 저장 1회 → 둘 다 반영 확인.
4. 별명만 고쳐 저장 → 자기소개 값 불변 확인(FR-014).
5. 계정 탭 → 모든 데이터 초기화 → 재로그인 → 자기소개가 비어 있는지 확인(FR-015).

### US3 — 길이 제한·오류 (P3)

1. 150자 근처까지 입력하며 카운터 증가 확인, 150자에서 추가 입력·붙여넣기가 막히는지 확인.
2. **저장 실패**: DevTools → Network → Offline 전환 → 저장 클릭 → 오류 안내 표시 + 입력 내용 유지 확인. Online 복귀 → 저장 성공 확인.
3. **조회 실패**(FR-019~021): DevTools → Network에서 `profile` REST 요청(`/rest/v1/profile*`)을 차단(Block request URL) → `/me` 새로고침 → 폼이 비활성 + 오류 안내 + 재시도 버튼 확인. 저장 버튼이 비활성인지 확인. 차단 해제 → 재시도 클릭 → 폼 복귀 + 저장된 값 하이드레이션 확인.

### 회귀 (FR-018, SC-006)

- 별명 수정·저장, 이미지 변경·제거, 로그아웃, 초기화가 기존과 동일하게 동작하는지 훑는다.
- `/workspace` 글 CRUD 정상 동작 확인(무관 회귀 방지).

## 3. 문서 동기화 확인

- `DESIGN.md` §5.12·§6.4·§8·§11이 자기소개 필드·`MAX_INTRODUCTION`·`.field-multi`·`profileStatus`를 반영하고, §5.8 이후의 어긋난 소스 라인 범위가 교정되었는지 확인(연구 D4·실측 참조).
