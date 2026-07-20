# 프로필 이미지 업로드/변경 구현 디자인 (Supabase Storage)

> 작성: 2026-07-20
> 상태: 사용자 승인 완료 (구현 전)

## 목표

마이페이지(`/me`)의 프로필 이미지를 **Supabase Storage `profile-image` 버킷**에 저장하도록 바꾼다.
현재는 이미지를 data URL 문자열로 변환해 `profile.image` 칼럼에 통째로 넣는 방식이며,
이를 "스토리지에 파일 업로드 + DB에는 경로만 저장" 구조로 교체한다.

## 범위

- **포함**: 이미지 업로드(교체)·제거, 스토리지 URL 조립 규칙, 버킷 공개 전환과 스토리지 RLS 정책,
  이전 파일 정리, `.env.example` 갱신, 기존 테스트 보강.
- **제외**: 이미지 리사이즈/크롭, 페이지 본문 이미지, 서버(API Route) 경유 업로드.

## 요구사항 (사용자 지정)

1. 파일은 `profile-image` 버킷에 **uuidv4 파일명**으로 저장한다 (`{uuidv4}.{확장자}` — 확장자 포함은 승인됨).
2. 다운로드 URL은 두 부분으로 나눈다:
   - **앞부분(스토리지 주소, 버킷명까지)** → 환경변수 `NEXT_PUBLIC_PROFILE_IMAGE_BASE_URL`
   - **뒷부분(버킷명 이후 = 파일명)** → `profile.image_path` 칼럼
   - 표시할 때 `${환경변수}/${image_path}`로 조립한다.
3. 환경변수는 `.env.example`에 작성한다 (실값 이전은 사용자가 `.env.local`에 직접 수행).

## 확정된 사실 (사전 조사)

- `public.profile`에 **`image_path` 칼럼(text, nullable)이 이미 존재**한다. 테이블 변경 불필요.
- **`profile-image` 버킷이 이미 존재하지만 비공개(private)** 이고, `storage.objects`에 정책이 하나도 없다.
  → 현재는 업로드도 공개 읽기도 불가능한 상태. 마이그레이션으로 해결한다.
- 프로젝트 URL: `https://toazanfnikwnvhlkjhmz.supabase.co`
  → 공개 객체 URL 형식: `https://toazanfnikwnvhlkjhmz.supabase.co/storage/v1/object/public/profile-image/{파일명}`
- `/me`는 이미 5MB·`image/*` 클라이언트 검증과 data URL 미리보기를 갖고 있다.
- uuid 생성은 코드베이스가 이미 쓰는 `crypto.randomUUID()`로 충분하다 (추가 패키지 없음).

## 사용자 결정 사항

| 질문 | 결정 |
| --- | --- |
| 비공개 버킷 처리 | **공개(public read)로 전환** + 쓰기는 로그인 사용자만 (정책 추가) |
| 업로드 시점 | **'변경 사항 저장' 클릭 시** (파일 선택 시에는 로컬 미리보기만) |
| 교체·제거 시 이전 파일 | **삭제** (best-effort — 실패해도 저장 자체는 성공 처리) |
| 파일명 | `{uuidv4}.{확장자}` (확장자 포함) |

## 선택한 접근: 업로드 로직을 스토어에 배치

검토한 대안:

1. **스토어(`lib/store.tsx`)가 업로드→upsert→이전 파일 정리를 한 트랜잭션처럼 관리** ← 채택.
   페이지는 `File` 객체만 넘기고, 저장 순서·실패 복구가 한 곳에 모인다.
2. 페이지 컴포넌트에서 직접 업로드 후 경로만 스토어에 전달 — 저장 원자성 관리가 UI에 흩어지고,
   실패 시 고아 파일 정리 책임이 애매해진다.
3. API Route 경유 업로드 — 클라이언트 SDK + RLS로 충분한 상황에 서버 코드만 늘어난다. 과함.

## 아키텍처

### 1. Supabase 마이그레이션 (1건)

- `storage.buckets`의 `profile-image`를 `public = true`로 전환하고,
  `file_size_limit = 5MB`, `allowed_mime_types = image/*`를 설정한다 (UI 검증과 일치하는 서버측 방어).
- `storage.objects` 정책 (모두 `bucket_id = 'profile-image'` 한정):
  - INSERT: `authenticated`만 가능.
  - SELECT / UPDATE / DELETE: `authenticated` 중 **본인이 올린 파일만** (`owner_id = auth.uid()`).
  - 공개 읽기(익명)는 public 버킷의 공개 URL 경로로 제공되므로 별도 SELECT 정책 불필요.

### 2. `lib/storage.ts` (신규)

- `NEXT_PUBLIC_PROFILE_IMAGE_BASE_URL` 읽기 (없으면 `lib/supabase.ts`와 같은 방식으로 명시적 에러).
- `profileImageUrl(path: string | null): string | null` — `null`은 그대로, 값이 있으면 `${base}/${path}` 조립.
  base 끝의 `/`는 정규화한다.
- `uploadProfileImage(file: File): Promise<{ path: string | null; error: string | null }>`
  — `{uuidv4}.{확장자}`로 업로드. 확장자는 파일명에서 추출하되 없으면 MIME 서브타입 사용.
- `removeProfileImage(path: string): Promise<void>` — best-effort 삭제 (실패 무시).

### 3. 스토어 (`lib/store.tsx`)

- `Profile` 타입에 `image_path: string | null` 추가. 프로필 조회 select에 `image_path` 포함.
- 표시값 `user.image` 계산 규칙 (우선순위):
  1. `profile.image_path` 있음 → `profileImageUrl(image_path)`
  2. 없으면 기존 `profile.image` (구글 아바타 URL 또는 레거시 data URL)
  3. 프로필 행 없음 → 세션의 구글 아바타
- `updateUser(patch)`의 이미지 입력을 `imageFile?: File | null`로 교체:
  - `File` → ① 업로드 ② upsert(`image_path = 새 파일명`, `image = null`) ③ 성공 시 이전 `image_path` 파일 삭제(best-effort).
    ①이 실패하면 upsert 없이 에러 반환. ②가 실패하면 방금 올린 파일을 삭제(고아 방지)하고 에러 반환.
  - `null`(제거) → upsert(`image_path = null`, `image = null`) 후 이전 파일 삭제(best-effort).
  - `undefined`(변경 없음) → 기존 값 유지.
  - 기존 `patch.image`(문자열) 입력 경로는 제거한다 — 이미지를 문자열로 저장하는 경로를 남기지 않는다.
- `resetAll()`: 프로필을 구글 기본값으로 되돌릴 때 `image_path: null`을 포함하고, 업로드된 파일이 있으면 삭제.

### 4. 마이페이지 (`app/me/page.tsx`)

- 상태 추가: `pendingFile: File | null` (새로 고른 파일). 미리보기는 지금처럼 data URL(`image` 상태) 사용.
- 파일 선택(`handleFile`): 검증 통과 시 `pendingFile` 보관 + data URL 미리보기 갱신 (즉시 업로드하지 않음).
- '제거' 버튼: `image = null`, `pendingFile = null`.
- dirty 판정: 기존 `image !== user.image` 비교 유지 (`pendingFile`이 있으면 data URL이라 항상 dirty).
- 저장(`handleSave`): `updateUser({ nickname, introduction, imageFile })` 호출.
  `imageFile`은 `pendingFile` 있으면 그것, 없는데 이미지가 제거됐으면(`image === null && user.image !== null`) `null`,
  그 외 `undefined`. 성공 시 `pendingFile` 리셋. 실패 시 기존 `saveError` 문구 표시.
- UI 구조·스타일 변경 없음 (DESIGN.md §6 설정 화면 그대로).

### 5. 환경변수

`.env.example`에 추가:

```
NEXT_PUBLIC_PROFILE_IMAGE_BASE_URL=https://<project-ref>.supabase.co/storage/v1/object/public/profile-image
```

실값(`toazanfnikwnvhlkjhmz`)은 사용자가 `.env.local`에 직접 옮긴다.

## 에러 처리

| 상황 | 동작 |
| --- | --- |
| 스토리지 업로드 실패 | DB 저장 중단, "저장하지 못했어요" 표시. 폼 값 유지 |
| 업로드 성공 후 upsert 실패 | 방금 올린 파일 삭제 시도(고아 방지) 후 에러 표시 |
| 이전 파일 삭제 실패 | 무시 (저장은 성공 처리 — 쓰레기 파일 1개가 저장 실패보다 낫다) |
| 환경변수 누락 | `lib/supabase.ts`와 동일하게 모듈 로드 시점에 명시적 에러 |

## 테스트

- `lib/store.test.tsx`: supabase 모킹에 `storage.from().upload/remove` 추가.
  - `imageFile: File` 저장 → uuid 파일명 업로드 + `image_path` upsert + 이전 파일 삭제 검증
  - 업로드 실패 → upsert 미호출·에러 반환 / upsert 실패 → 방금 파일 삭제 검증
  - `imageFile: null` → `image_path: null` upsert + 이전 파일 삭제 검증
  - `image_path`가 있는 프로필의 `user.image`가 조립된 URL인지 검증
- `app/me/page.test.tsx`: 파일 선택 시 업로드가 **호출되지 않음**(저장 시점 업로드) 검증,
  저장 클릭 시 `imageFile` 전달 검증.
- 테스트의 Supabase는 모킹이므로, 구현 후 브라우저 실기 확인(업로드→새로고침→표시→제거) 필수.
