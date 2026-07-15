# 실제 Google 로그인 구현 디자인 (Supabase Auth)

> 작성: 2026-07-15
> 상태: 사용자 승인 완료 (구현 전)

## 목표

로그인 페이지(`app/login/page.tsx`)의 가짜 Google 로그인(`setTimeout` + 하드코딩 사용자)을
Supabase Auth 기반의 **실제 Google OAuth 로그인**으로 교체한다.

## 범위

- **포함**: Google OAuth 로그인/로그아웃, 세션 유지, Google 계정 정보(이름·이메일·사진)를 사용자 초기값으로 사용.
- **제외**: 글(posts) 데이터의 DB 이전, `public.profile`/`public.page` 테이블 연동. 글은 지금처럼 localStorage에 유지한다.

## 확정된 사실 (사전 조사)

- Supabase 프로젝트(`https://toazanfnikwnvhlkjhmz.supabase.co`)에 **Google provider가 이미 활성화**되어 있다
  (`/auth/v1/authorize?provider=google`이 실제 Google OAuth로 302 리다이렉트됨을 확인).
- publishable key: `sb_publishable_57ayVV4xcokJuKAlWZvfBA_uKzliJFv` (공개 가능 키).
- 이 프로젝트의 Next.js 16.2.10은 `middleware.ts`가 `proxy.ts`로 개명되었고, 공식 문서가
  proxy를 세션 관리 용도로 쓰지 말라고 권고한다 (`node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`).
- 앱은 100% 클라이언트 컴포넌트 + localStorage 스토어 구조로, 서버에서 사용자 데이터를 렌더링하는 곳이 없다.

## 선택한 접근: 클라이언트 전용 supabase-js

검토한 대안:

1. **클라이언트 전용 supabase-js** ← 채택. 변경 범위 최소, 현재 앱 구조에 부합. 서버 코드·쿠키·콜백 라우트 불필요.
   향후 DB 연동 시에도 같은 브라우저 클라이언트로 RLS 쿼리 가능.
2. @supabase/ssr 쿠키 기반 — 정석 패턴이지만 서버 컴포넌트가 0개인 현재 구조에서는 쓰이지 않는 인프라. 과함.
3. Google One Tap(`signInWithIdToken`) — 기존 버튼 UX를 대체하고 Google 측 추가 설정 필요. 부적합.

## 아키텍처

### 1. 인프라

- 의존성 추가: `@supabase/supabase-js` (버전 고정, lockfile 커밋).
- `lib/supabase.ts` 신규: 브라우저용 클라이언트 싱글턴.
- `.env.local`(git 제외)에 설정:
  - `NEXT_PUBLIC_SUPABASE_URL=https://toazanfnikwnvhlkjhmz.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_57ayVV4xcokJuKAlWZvfBA_uKzliJFv`

### 2. 스토어 (`lib/store.tsx`)

- `user`는 **Supabase 세션에서 파생**한다. 초기 로드 시 `supabase.auth.getSession()`,
  이후 `supabase.auth.onAuthStateChange()` 구독으로 로그인/로그아웃/토큰 갱신을 실시간 반영.
- User 표시값 병합 규칙:
  - 기본값: Google 계정의 `user_metadata.full_name`(없으면 이메일 로컬 파트), `email`, `user_metadata.avatar_url`.
  - 그 위에 **로컬 수정 오버레이**를 병합. 오버레이는 localStorage에 Supabase uid별 키
    (`mini-notion:user-overlay:<uid>`)로 저장하며 `/me`의 별명·이미지 수정이 여기에 기록된다.
- `login()` → `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin } })`.
  PKCE 흐름: 복귀 시 supabase-js가 URL의 인증 코드를 자동 교환(`detectSessionInUrl` 기본값)해 세션 복원.
- `logout()` → `supabase.auth.signOut()`.
- `resetAll()` → 로컬 데이터(글·오버레이) 삭제 + `signOut()`. Supabase 계정 자체는 삭제하지 않는다.
- 시드 글: 로컬에 저장된 글이 없는 첫 로그인 시 기존 시드 로직 유지. 글 저장 키(`mini-notion:posts`)는 기존 그대로.
- 레거시 정리: 가짜 로그인이 쓰던 `mini-notion:user` 키는 더 이상 사용하지 않는다. 스토어 초기화 시 남아 있으면 제거한다
  (가짜 사용자 값이 실제 세션과 섞이지 않도록).

### 3. 로그인 페이지 (`app/login/page.tsx`)

- `setTimeout` 가짜 로그인 제거 → `login()` 호출. 성공 시 브라우저가 Google로 떠나므로 busy 유지.
- `signInWithOAuth`가 에러를 반환하면 busy 해제 + 에러 문구 표시.
- OAuth 취소/실패로 쿼리에 `error`가 붙어 돌아오면 로그인 페이지에서 안내 문구 표시.
- UI 구조·디자인 토큰 변경 없음 (DESIGN.md 변경 불필요. 에러 문구는 기존 `.login-note` 계열 토큰 재사용).

### 4. 라우팅·세션 흐름

- 로그인 복귀 랜딩은 `/`(origin). 기존 `app/page.tsx`가 user 유무로 `/workspace`·`/login` 분기 — 새 라우팅 코드 없음.
- 라우트 보호는 기존 클라이언트 사이드 가드(useEffect redirect) 유지.
- 토큰 자동 갱신은 supabase-js 기본값(`autoRefreshToken`) 사용.

## 에러 처리

| 상황 | 처리 |
|---|---|
| `signInWithOAuth` 즉시 에러 | busy 해제, 로그인 카드에 에러 문구 |
| 사용자가 Google에서 취소 | `?error=`로 복귀 → 안내 문구 |
| 세션 만료 | supabase-js 자동 갱신, 실패 시 `SIGNED_OUT` 이벤트 → 가드가 `/login`으로 |
| redirectTo가 allowlist에 없음 | Site URL로 폴백됨. 검증 단계에서 대시보드 Redirect URL 확인 |

## 테스트 계획

- `lib/store.test.tsx`: supabase 클라이언트 모킹(`getSession`, `onAuthStateChange`, `signInWithOAuth`, `signOut`)으로 갱신.
  - `login()`이 `signInWithOAuth`를 `provider: 'google'`로 호출한다.
  - `SIGNED_IN` 세션 이벤트 → Google 메타데이터에서 user 파생.
  - 오버레이 병합: `updateUser`로 별명 수정 시 오버레이 저장, Google 초기값 위에 병합.
  - `logout()`/`SIGNED_OUT` → user가 null.
  - TDD 원칙: 테스트 먼저(RED) → 구현(GREEN).
- 실제 앱 검증: dev 서버에서 버튼 클릭 → 실제 Google 동의 화면으로 리다이렉트 확인.
  실계정 로그인 완주는 사용자 브라우저에서 확인.

## 성공 기준

1. "Google 계정으로 계속하기" 클릭 시 실제 Google 동의 화면으로 이동한다.
2. 로그인 완료 후 `/workspace`에 도착하고, `/me`에 실제 Google 이름·이메일·사진이 보인다.
3. 새로고침해도 세션이 유지된다. 로그아웃하면 `/login`으로 돌아가고 세션이 사라진다.
4. `/me`에서 별명·이미지 수정이 기존처럼 동작한다 (로컬 오버레이).
5. 기존 테스트 전부 + 신규 스토어 테스트 통과.
