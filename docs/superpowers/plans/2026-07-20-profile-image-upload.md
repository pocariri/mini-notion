# 프로필 이미지 업로드 (Supabase Storage) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 마이페이지(`/me`)의 프로필 이미지를 Supabase Storage `profile-image` 버킷에 `{uuidv4}.{확장자}` 파일명으로 업로드하고, DB(`profile.image_path`)에는 파일명만, URL 앞부분은 환경변수(`NEXT_PUBLIC_PROFILE_IMAGE_BASE_URL`)에 저장한다.

**Architecture:** 업로드→upsert→이전 파일 정리를 스토어(`lib/store.tsx`)의 `updateUser`가 한 흐름으로 관리한다. 페이지는 `File` 객체만 넘긴다. URL 조립·업로드·삭제는 신규 `lib/storage.ts` 헬퍼가 담당한다. 스펙: `docs/superpowers/specs/2026-07-20-profile-image-upload-design.md`.

**Tech Stack:** Next.js 16.2.10 (클라이언트 컴포넌트만), @supabase/supabase-js 2.110.5 (Storage API), vitest + @testing-library/react (jsdom), Supabase MCP(마이그레이션).

## Global Constraints

- Supabase 접점은 `lib/supabase.ts` 싱글턴뿐이다. 새 코드도 이 경계를 지킨다 (`lib/storage.ts`는 이 싱글턴을 import).
- 파일명은 `crypto.randomUUID()` 기반 `{uuidv4}.{확장자}`. 추가 패키지 설치 금지.
- 버킷명은 `profile-image` 고정. 환경변수명은 `NEXT_PUBLIC_PROFILE_IMAGE_BASE_URL` 고정 (값 = 스토리지 주소 + 버킷명, 예: `https://<project-ref>.supabase.co/storage/v1/object/public/profile-image`).
- **`.env.local`은 절대 읽기/쓰기 금지** (프로젝트 훅이 차단). 플레이스홀더는 `.env.example`에만 쓴다. 실값 이전은 사용자가 직접 한다.
- UI 스타일·토큰 변경 없음 (새 색상/매직 넘버 금지 — CLAUDE.md 디자인 규칙).
- Next.js 16.2.10은 훈련 데이터와 다를 수 있다 — 새 Next API를 쓰기 전 `node_modules/next/dist/docs/` 확인. (환경변수 `NEXT_PUBLIC_` 규칙은 이 버전에서도 동일함을 이미 확인: `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`. 단, 코드에서 반드시 `process.env.NEXT_PUBLIC_PROFILE_IMAGE_BASE_URL`를 **리터럴로** 참조할 것 — 빌드 타임 인라인 방식이라 동적 키 조회는 동작하지 않는다.)
- 테스트: `npx vitest run <파일>` (단건) / `npm run test:run` (전체). 기존 50+개 테스트가 전부 통과 상태를 유지해야 한다.
- 커밋 메시지 끝에 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Supabase 마이그레이션 — 버킷 공개 전환 + 스토리지 정책

**Files:** 없음 (Supabase 원격 프로젝트만 변경. MCP `apply_migration` 사용 → Supabase 마이그레이션 이력에 기록됨)

**Interfaces:**
- Consumes: 기존 `profile-image` 버킷(비공개, 정책 0개), `public.profile.image_path` 칼럼(이미 존재).
- Produces: 공개 읽기 가능한 버킷 + 로그인 사용자의 업로드/본인 파일 관리 권한. 이후 태스크의 실기 동작 전제 조건.

- [ ] **Step 1: 마이그레이션 적용**

MCP 도구 `mcp__supabase__apply_migration`을 다음 인자로 호출:

- name: `profile_image_bucket_public_and_policies`
- query:

```sql
-- 프로필 이미지 버킷: 공개 읽기 + 5MB 제한 + 이미지 MIME만 (UI 검증과 동일한 서버측 방어)
update storage.buckets
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/*']
where id = 'profile-image';

-- 쓰기는 로그인 사용자만. 읽기는 public 버킷의 공개 URL로 제공된다.
create policy "profile-image insert authenticated"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-image');

-- 수정·삭제·목록 조회는 본인이 올린 파일만 (owner_id는 text 칼럼이라 캐스팅 필요).
create policy "profile-image select own"
  on storage.objects for select to authenticated
  using (bucket_id = 'profile-image' and owner_id = (select auth.uid()::text));

create policy "profile-image update own"
  on storage.objects for update to authenticated
  using (bucket_id = 'profile-image' and owner_id = (select auth.uid()::text));

create policy "profile-image delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'profile-image' and owner_id = (select auth.uid()::text));
```

- [ ] **Step 2: 적용 검증**

MCP 도구 `mcp__supabase__execute_sql`로 실행:

```sql
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'profile-image';
```

기대: `public = true`, `file_size_limit = 5242880`, `allowed_mime_types = {image/*}`.

```sql
select polname, polcmd from pg_policy where polrelid = 'storage.objects'::regclass order by polname;
```

기대: 위에서 만든 정책 4개 (`polcmd`가 각각 `a`(insert), `r`(select), `w`(update), `d`(delete)).

---

### Task 2: 환경변수 + `lib/storage.ts` 헬퍼 (TDD)

**Files:**
- Modify: `.env.example`
- Modify: `vitest.setup.ts` (파일 맨 위에 env 설정 추가)
- Create: `lib/storage.test.ts`
- Create: `lib/storage.ts`

**Interfaces:**
- Consumes: `lib/supabase.ts`의 `supabase` 싱글턴 (`supabase.storage.from(bucket).upload / .remove`).
- Produces (Task 3·4가 사용):
  - `profileImageUrl(path: string | null): string | null` — `null`→`null`, 값→`${base}/${path}`
  - `uploadProfileImage(file: File): Promise<{ path: string | null; error: string | null }>`
  - `removeProfileImage(path: string): Promise<void>` — 항상 resolve (best-effort)
  - 환경변수 `NEXT_PUBLIC_PROFILE_IMAGE_BASE_URL` (테스트 값은 vitest.setup.ts가 주입)

- [ ] **Step 1: `.env.example`에 환경변수 추가**

`.env.example` 끝에 한 줄 추가 (기존 두 줄은 그대로):

```
NEXT_PUBLIC_PROFILE_IMAGE_BASE_URL=https://<project-ref>.supabase.co/storage/v1/object/public/profile-image
```

- [ ] **Step 2: `vitest.setup.ts` 맨 위에 테스트용 env 주입**

`import '@testing-library/jest-dom/vitest'` 줄 **위에** 추가:

```ts
// lib/storage.ts가 모듈 로드 시점에 요구하는 공개 URL 앞부분(스토리지 주소 + 버킷명).
// 끝 슬래시를 일부러 붙여 조립 시 정규화까지 실전과 같이 검증한다.
process.env.NEXT_PUBLIC_PROFILE_IMAGE_BASE_URL =
  'https://test.supabase.co/storage/v1/object/public/profile-image/'
```

- [ ] **Step 3: 실패하는 테스트 작성 — `lib/storage.test.ts`**

```ts
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

// 스토리지 경계 모킹 — lib/storage.ts는 lib/supabase.ts 싱글턴만 통해 Supabase와 통신한다.
const storageMock = vi.hoisted(() => {
  const state = {
    lastBucket: '' as string,
    uploadError: null as { message: string } | null,
    removeRejects: false,
  }
  const upload = vi.fn(async () => {
    if (state.uploadError) return { data: null, error: state.uploadError }
    return { data: {}, error: null }
  })
  const remove = vi.fn(async () => {
    if (state.removeRejects) throw new Error('network down')
    return { data: null, error: null }
  })
  return { state, upload, remove }
})

vi.mock('./supabase', () => ({
  supabase: {
    storage: {
      from: (bucket: string) => {
        storageMock.state.lastBucket = bucket
        return { upload: storageMock.upload, remove: storageMock.remove }
      },
    },
  },
}))

import { profileImageUrl, uploadProfileImage, removeProfileImage } from './storage'

beforeEach(() => {
  storageMock.state.lastBucket = ''
  storageMock.state.uploadError = null
  storageMock.state.removeRejects = false
  storageMock.upload.mockClear()
  storageMock.remove.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('profileImageUrl — 환경변수(앞부분) + image_path(뒷부분) 조립', () => {
  test('null이면 null을 그대로 돌려준다', () => {
    expect(profileImageUrl(null)).toBeNull()
  })

  test('base 끝 슬래시를 정규화해 이중 슬래시 없이 조립한다', () => {
    // vitest.setup.ts의 base는 끝에 /가 붙어 있다 — 그대로 이으면 //가 된다.
    expect(profileImageUrl('abc.png')).toBe(
      'https://test.supabase.co/storage/v1/object/public/profile-image/abc.png',
    )
  })
})

describe('uploadProfileImage — profile-image 버킷에 uuidv4 파일명 업로드', () => {
  test('uuid.확장자 파일명으로 업로드하고 그 경로를 돌려준다', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '11111111-2222-4333-8444-555555555555',
    )
    const file = new File(['img'], 'cat.png', { type: 'image/png' })

    const { path, error } = await uploadProfileImage(file)

    expect(error).toBeNull()
    expect(path).toBe('11111111-2222-4333-8444-555555555555.png')
    expect(storageMock.state.lastBucket).toBe('profile-image')
    expect(storageMock.upload).toHaveBeenCalledWith(
      '11111111-2222-4333-8444-555555555555.png',
      file,
      { contentType: 'image/png' },
    )
  })

  test('파일명에 확장자가 없으면 MIME 서브타입을 확장자로 쓴다', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '11111111-2222-4333-8444-555555555555',
    )
    const file = new File(['img'], 'photo', { type: 'image/webp' })

    const { path } = await uploadProfileImage(file)

    expect(path).toBe('11111111-2222-4333-8444-555555555555.webp')
  })

  test('업로드 실패 시 path 없이 에러 메시지를 돌려준다', async () => {
    storageMock.state.uploadError = { message: 'quota exceeded' }
    const file = new File(['img'], 'cat.png', { type: 'image/png' })

    const { path, error } = await uploadProfileImage(file)

    expect(path).toBeNull()
    expect(error).toBe('quota exceeded')
  })
})

describe('removeProfileImage — 이전 파일 정리 (best-effort)', () => {
  test('경로 배열로 remove를 호출한다', async () => {
    await removeProfileImage('old.png')

    expect(storageMock.state.lastBucket).toBe('profile-image')
    expect(storageMock.remove).toHaveBeenCalledWith(['old.png'])
  })

  test('삭제가 실패해도 예외를 던지지 않는다', async () => {
    storageMock.state.removeRejects = true

    await expect(removeProfileImage('old.png')).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 4: 테스트가 실패하는지 확인**

Run: `npx vitest run lib/storage.test.ts`
Expected: FAIL — `Cannot find module './storage'` (또는 동등한 로드 에러)

- [ ] **Step 5: `lib/storage.ts` 구현**

```ts
import { supabase } from './supabase'

const BUCKET = 'profile-image'

// 공개 URL의 앞부분(스토리지 주소 + 버킷명). 뒷부분(파일명)은 profile.image_path에 저장된다.
const rawBase = process.env.NEXT_PUBLIC_PROFILE_IMAGE_BASE_URL

if (!rawBase) {
  throw new Error(
    'NEXT_PUBLIC_PROFILE_IMAGE_BASE_URL가 필요합니다 (.env.local 참고: .env.example).',
  )
}

// 끝 슬래시를 정규화해 조립 시 이중 슬래시를 막는다.
const base = rawBase.replace(/\/+$/, '')

// image_path(버킷명 이후 부분)를 완전한 공개 URL로 조립한다.
export function profileImageUrl(path: string | null): string | null {
  return path ? `${base}/${path}` : null
}

// MIME 서브타입(png, webp…)은 그대로 확장자로 쓸 수 있어 이름에 확장자가 없을 때의 폴백으로 충분하다.
function fileExtension(file: File): string {
  const fromName = file.name.split('.').pop()
  if (fromName && fromName !== file.name) return fromName.toLowerCase()
  return file.type.split('/')[1] ?? 'bin'
}

// uuidv4 파일명으로 업로드하고 저장된 경로(파일명)를 돌려준다.
export async function uploadProfileImage(
  file: File,
): Promise<{ path: string | null; error: string | null }> {
  const path = `${crypto.randomUUID()}.${fileExtension(file)}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type })
  if (error) return { path: null, error: error.message }
  return { path, error: null }
}

// 교체·제거로 더 이상 참조되지 않는 파일 정리. 실패해도 저장을 되돌릴 이유는 없다(best-effort).
export async function removeProfileImage(path: string): Promise<void> {
  try {
    await supabase.storage.from(BUCKET).remove([path])
  } catch {
    // 무시 — 쓰레기 파일 1개가 저장 실패보다 낫다.
  }
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run lib/storage.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 7: 전체 테스트 회귀 확인**

Run: `npm run test:run`
Expected: 전부 PASS (기존 테스트는 storage.ts를 아직 import하지 않으므로 영향 없음)

- [ ] **Step 8: 커밋**

```bash
git add .env.example vitest.setup.ts lib/storage.ts lib/storage.test.ts
git commit -m "feat: profile image storage helpers (uuid upload, url join, cleanup)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: 스토어 — `image_path` 연동 (`updateUser` imageFile 입력) (TDD)

**Files:**
- Modify: `lib/store.tsx`
- Test: `lib/store.test.tsx`

**Interfaces:**
- Consumes: Task 2의 `profileImageUrl` / `uploadProfileImage` / `removeProfileImage` (`./storage`).
- Produces (Task 4가 사용):
  - `export type UserUpdate = { nickname?: string; introduction?: string | null; imageFile?: File | null }`
  - `Store.updateUser: (patch: UserUpdate) => Promise<{ error: string | null }>`
    — `imageFile`이 `File`이면 업로드 후 `image_path` 저장, `null`이면 제거, `undefined`면 유지.
  - `User.image`는 이제 **표시용으로 조립된 URL** (image_path 우선, 없으면 기존 image 값).

- [ ] **Step 1: 테스트 대역 갱신 — `lib/store.test.tsx`**

(a) `dbMock`의 profiles 레코드와 upsert에 `image_path` 반영. 기존 코드:

```ts
    profiles: {} as Record<
      string,
      { name: string | null; image: string | null; introduction: string | null }
    >,
```

를 다음으로 교체:

```ts
    profiles: {} as Record<
      string,
      {
        name: string | null
        image: string | null
        introduction: string | null
        image_path?: string | null
      }
    >,
```

upsert 함수(기존 `const upsert = vi.fn(...)`)를 다음으로 교체:

```ts
  const upsert = vi.fn(
    async (row: {
      user_id: string
      name: string | null
      image: string | null
      introduction?: string | null
      image_path?: string | null
    }) => {
      if (state.upsertError) return { error: state.upsertError }
      state.profiles[row.user_id] = {
        name: row.name,
        image: row.image,
        introduction: row.introduction ?? null,
        image_path: row.image_path ?? null,
      }
      return { error: null }
    },
  )
```

(b) `dbMock` 정의 아래(파일 상단, `vi.mock('./supabase', ...)` 위)에 스토리지 대역 추가:

```ts
// Supabase Storage의 in-memory 대역. 스토어는 lib/storage.ts를 통해 이 경계를 쓴다.
const storageMock = vi.hoisted(() => {
  const state = { uploadError: null as { message: string } | null }
  const upload = vi.fn(async () => {
    if (state.uploadError) return { data: null, error: state.uploadError }
    return { data: {}, error: null }
  })
  const remove = vi.fn(async () => ({ data: null, error: null }))
  return {
    state,
    upload,
    remove,
    reset() {
      state.uploadError = null
      upload.mockClear()
      remove.mockClear()
    },
  }
})
```

(c) `vi.mock('./supabase', ...)`의 supabase 객체에 `storage` 추가 (`from:` 아래):

```ts
    storage: {
      from: () => ({ upload: storageMock.upload, remove: storageMock.remove }),
    },
```

(d) `beforeEach`에 `storageMock.reset()` 한 줄 추가.

(e) 기존 단언 갱신 — upsert 행에 `image_path`가 추가되므로:

- `'updateUser는 별명을 profile 행에 upsert하고 user에 반영한다'`의 `toHaveBeenCalledWith` 페이로드에 `image_path: null,` 추가
- `'이미지를 null로 수정하면 DB에 null이 저장되고 빈 아바타가 된다'` — 호출부 `updateUser({ image: null })`를 `updateUser({ imageFile: null })`로 바꾸고 페이로드에 `image_path: null,` 추가
- 자기소개 describe의 upsert 단언 3곳(`'한 줄 소개'`, `introduction: null`, `'기존 소개'` 유지) 페이로드에 각각 `image_path: null,` 추가
- `'조회는 introduction 컬럼을 포함하고...'`의 `expect(dbMock.state.lastSelect).toBe('name, image, introduction')`을 `.toBe('name, image, image_path, introduction')`으로 변경
- resetAll describe 2곳: `dbMock.state.profiles['uid-123']`의 `toEqual` 기대 객체와 upsert `toHaveBeenCalledWith` 페이로드에 각각 `image_path: null,` 추가

- [ ] **Step 2: 실패하는 새 테스트 추가 — `lib/store.test.tsx`**

`describe('프로필 (Supabase public.profile 연동)', ...)` 블록 뒤에 추가:

```ts
describe('프로필 이미지 (Supabase Storage + image_path)', () => {
  const TEST_BASE = 'https://test.supabase.co/storage/v1/object/public/profile-image'

  async function renderProfileReady() {
    const utils = await renderStore()
    act(() => {
      authMock.fire('SIGNED_IN', googleSession)
    })
    await waitFor(() => expect(utils.result.current.profileStatus).toBe('ready'))
    return utils
  }

  test('imageFile(File)을 주면 업로드 후 image_path를 upsert하고 user.image가 조립 URL이 된다', async () => {
    const uuidSpy = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('11111111-2222-4333-8444-555555555555')
    try {
      const { result } = await renderProfileReady()
      const file = new File(['img'], 'cat.png', { type: 'image/png' })

      await act(async () => {
        const { error } = await result.current.updateUser({ imageFile: file })
        expect(error).toBeNull()
      })

      expect(storageMock.upload).toHaveBeenCalledWith(
        '11111111-2222-4333-8444-555555555555.png',
        file,
        { contentType: 'image/png' },
      )
      expect(dbMock.upsert).toHaveBeenCalledWith(
        {
          user_id: 'uid-123',
          name: '김구글',
          image: null,
          image_path: '11111111-2222-4333-8444-555555555555.png',
          introduction: null,
        },
        { onConflict: 'user_id' },
      )
      expect(result.current.user?.image).toBe(
        `${TEST_BASE}/11111111-2222-4333-8444-555555555555.png`,
      )
    } finally {
      uuidSpy.mockRestore()
    }
  })

  test('이미지를 교체하면 이전 image_path 파일을 삭제한다', async () => {
    dbMock.state.profiles['uid-123'] = {
      name: '별명',
      image: null,
      introduction: null,
      image_path: 'old.png',
    }
    const { result } = await renderProfileReady()

    await act(async () => {
      await result.current.updateUser({
        imageFile: new File(['img'], 'new.png', { type: 'image/png' }),
      })
    })

    expect(storageMock.remove).toHaveBeenCalledWith(['old.png'])
  })

  test('업로드 실패 시 upsert 없이 에러를 반환하고 user는 그대로다', async () => {
    storageMock.state.uploadError = { message: 'quota exceeded' }
    const { result } = await renderProfileReady()

    let error: string | null = null
    await act(async () => {
      ;({ error } = await result.current.updateUser({
        imageFile: new File(['img'], 'cat.png', { type: 'image/png' }),
      }))
    })

    expect(error).toBe('quota exceeded')
    expect(dbMock.upsert).not.toHaveBeenCalled()
    expect(result.current.user?.image).toBe(
      'https://lh3.googleusercontent.com/a/photo.jpg',
    )
  })

  test('업로드 성공 후 upsert가 실패하면 방금 올린 파일을 삭제한다(고아 방지)', async () => {
    const uuidSpy = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('11111111-2222-4333-8444-555555555555')
    try {
      dbMock.state.upsertError = { message: 'boom' }
      const { result } = await renderProfileReady()

      let error: string | null = null
      await act(async () => {
        ;({ error } = await result.current.updateUser({
          imageFile: new File(['img'], 'cat.png', { type: 'image/png' }),
        }))
      })

      expect(error).toBe('boom')
      expect(storageMock.remove).toHaveBeenCalledWith([
        '11111111-2222-4333-8444-555555555555.png',
      ])
    } finally {
      uuidSpy.mockRestore()
    }
  })

  test('imageFile: null은 image·image_path를 null로 저장하고 이전 파일을 삭제한다', async () => {
    dbMock.state.profiles['uid-123'] = {
      name: '별명',
      image: null,
      introduction: null,
      image_path: 'old.png',
    }
    const { result } = await renderProfileReady()

    await act(async () => {
      await result.current.updateUser({ imageFile: null })
    })

    expect(dbMock.upsert).toHaveBeenCalledWith(
      { user_id: 'uid-123', name: '별명', image: null, image_path: null, introduction: null },
      { onConflict: 'user_id' },
    )
    expect(storageMock.remove).toHaveBeenCalledWith(['old.png'])
    expect(result.current.user?.image).toBeNull()
  })

  test('저장된 image_path는 재로그인 시 조립된 URL로 복원된다', async () => {
    dbMock.state.profiles['uid-123'] = {
      name: '별명',
      image: null,
      introduction: null,
      image_path: 'saved.png',
    }
    authMock.state.session = googleSession

    const { result } = await renderStore()

    await waitFor(() =>
      expect(result.current.user?.image).toBe(`${TEST_BASE}/saved.png`),
    )
  })

  test('imageFile 없는 patch(별명만 저장)는 image_path를 유지하고 파일을 삭제하지 않는다', async () => {
    dbMock.state.profiles['uid-123'] = {
      name: '별명',
      image: null,
      introduction: null,
      image_path: 'keep.png',
    }
    const { result } = await renderProfileReady()

    await act(async () => {
      await result.current.updateUser({ nickname: '새별명' })
    })

    expect(dbMock.upsert).toHaveBeenCalledWith(
      {
        user_id: 'uid-123',
        name: '새별명',
        image: null,
        image_path: 'keep.png',
        introduction: null,
      },
      { onConflict: 'user_id' },
    )
    expect(storageMock.remove).not.toHaveBeenCalled()
  })

  test('resetAll은 업로드된 파일을 삭제하고 image_path를 null로 되돌린다', async () => {
    dbMock.state.profiles['uid-123'] = {
      name: '별명',
      image: null,
      introduction: null,
      image_path: 'uploaded.png',
    }
    authMock.state.session = googleSession
    const { result } = await renderStore()
    await waitFor(() => expect(result.current.profileStatus).toBe('ready'))

    await act(async () => {
      await result.current.resetAll()
    })

    expect(storageMock.remove).toHaveBeenCalledWith(['uploaded.png'])
    expect(dbMock.state.profiles['uid-123']).toEqual({
      name: '김구글',
      image: 'https://lh3.googleusercontent.com/a/photo.jpg',
      introduction: null,
      image_path: null,
    })
  })
})
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run lib/store.test.tsx`
Expected: FAIL — 새 describe의 8개 테스트 실패 (`updateUser`가 `imageFile`을 모름, `image_path` upsert 안 됨). Step 1에서 페이로드에 `image_path: null`을 추가한 기존 테스트들도 실패한다 (구현 전이므로 정상).

- [ ] **Step 4: `lib/store.tsx` 구현**

(a) import 추가 (파일 상단 `import { supabase } from './supabase'` 아래):

```ts
import { profileImageUrl, removeProfileImage, uploadProfileImage } from './storage'
```

(b) `User` 타입 주석 보강 및 `UserUpdate` 타입 추가 (`export type User` 정의 바로 아래):

```ts
// updateUser 입력. imageFile: File = 새 이미지로 교체(스토리지 업로드),
// null = 제거, undefined = 변경 없음. 이미지가 문자열로 들어오는 경로는 없다 —
// 저장은 항상 스토리지 경로(image_path)를 통한다.
export type UserUpdate = {
  nickname?: string
  introduction?: string | null
  imageFile?: File | null
}
```

(c) `Store` 타입의 `updateUser` 시그니처 변경:

```ts
  updateUser: (patch: UserUpdate) => Promise<{ error: string | null }>
```

(d) `Profile` 타입에 `image_path` 추가 (기존 주석 유지, 필드만 추가):

```ts
type Profile = {
  name: string | null
  image: string | null
  // Storage 파일명(버킷명 이후 부분). 표시 URL은 profileImageUrl()이 조립한다.
  image_path: string | null
  introduction: string | null
}
```

(e) 프로필 조회 effect의 select와 매핑 갱신:

```ts
      .select('name, image, image_path, introduction')
```

```ts
        if (data)
          setProfile({
            name: data.name,
            image: data.image,
            image_path: data.image_path ?? null,
            introduction: data.introduction,
          })
```

(f) `updateUser` 전체 교체:

```ts
  const updateUser = useCallback(
    async (patch: UserUpdate): Promise<{ error: string | null }> => {
      if (!uid || !authUser) return { error: '로그인이 필요합니다.' }
      // 조회가 끝나지 않았거나 실패한 상태의 저장은 profile ?? base 폴백으로
      // DB 행 전체를 기본값으로 덮어쓰는 경로다 — 게이트웨이에서 차단한다(FR-020).
      if (profileStatus !== 'ready')
        return { error: '프로필을 불러오지 못해 저장할 수 없습니다. 다시 시도해 주세요.' }
      const { base } = authUser
      const prevPath = profile?.image_path ?? null

      // 이미지 입력: File = 스토리지에 올리고 경로만 저장, null = 제거, undefined = 유지.
      let nextImage: string | null
      let nextPath: string | null
      let uploadedPath: string | null = null
      if (patch.imageFile) {
        const { path, error } = await uploadProfileImage(patch.imageFile)
        if (!path) return { error: error ?? '이미지를 업로드하지 못했습니다.' }
        uploadedPath = path
        nextPath = path
        nextImage = null
      } else if (patch.imageFile === null) {
        nextPath = null
        nextImage = null
      } else {
        nextPath = prevPath
        nextImage = profile ? profile.image : base.image
      }

      const next: Profile = {
        name:
          patch.nickname !== undefined
            ? patch.nickname
            : (profile?.name ?? base.nickname),
        image: nextImage,
        image_path: nextPath,
        introduction:
          'introduction' in patch
            ? (patch.introduction ?? null)
            : (profile?.introduction ?? null),
      }
      const { error } = await supabase
        .from('profile')
        .upsert({ user_id: uid, ...next }, { onConflict: 'user_id' })
      if (error) {
        // 방금 올린 파일이 DB에 연결되지 못했다 — 고아가 되기 전에 지운다.
        if (uploadedPath) void removeProfileImage(uploadedPath)
        return { error: error.message }
      }
      // 교체·제거로 더 이상 참조되지 않는 이전 파일 정리(best-effort).
      if (prevPath && prevPath !== nextPath) void removeProfileImage(prevPath)
      setProfile(next)
      return { error: null }
    },
    [uid, authUser, profile, profileStatus],
  )
```

(g) `resetAll`의 프로필 초기화 블록 교체 (`if (uid && authUser) { ... }` 내부):

```ts
    if (uid && authUser) {
      // 로컬만 비우면 재로그인 시 되살아난다. 서버에서도 지운다.
      await supabase.from('page').delete().eq('user_id', uid)
      const uploadedPath = profile?.image_path ?? null
      await supabase
        .from('profile')
        .upsert(
          {
            user_id: uid,
            name: authUser.base.nickname,
            image: authUser.base.image,
            image_path: null,
            introduction: null,
          },
          { onConflict: 'user_id' },
        )
      // 업로드했던 프로필 이미지 파일도 정리한다(best-effort).
      if (uploadedPath) void removeProfileImage(uploadedPath)
    }
```

`resetAll`의 의존성 배열을 `[uid, authUser, profile]`로 갱신.

(h) `user` 파생 memo의 image 계산 교체:

```ts
  const user = useMemo<User | null>(() => {
    if (!authUser) return null
    const { base } = authUser
    return {
      nickname: profile?.name ?? base.nickname,
      email: base.email,
      // 스토리지 경로가 있으면 조립 URL, 없으면 DB의 image(구글 아바타 등), 행이 없으면 세션 기본값.
      image: profile
        ? profile.image_path
          ? profileImageUrl(profile.image_path)
          : profile.image
        : base.image,
      introduction: profile?.introduction ?? null,
    }
  }, [authUser, profile])
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run lib/store.test.tsx`
Expected: PASS (기존 + 신규 8개 전부)

주의: 이 시점에 `app/me/page.tsx`는 아직 `updateUser({ image, ... })`를 호출한다. vitest는 타입 검사를 하지 않으므로 테스트는 돌지만, `image` 필드는 새 `UserUpdate`에 없어 무시된다(이미지 저장이 잠시 no-op — Task 4에서 해소). `tsc`/`next build`는 이 시점에 타입 에러를 내는 것이 정상이므로 빌드 검증은 Task 4 이후에 한다. 전체 회귀(`npm run test:run`)도 Task 4 후에 본다.

- [ ] **Step 6: 커밋**

```bash
git add lib/store.tsx lib/store.test.tsx
git commit -m "feat: store profile image via storage upload + image_path

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: 마이페이지 — 저장 시점 업로드 (TDD)

**Files:**
- Modify: `app/me/page.tsx`
- Test: `app/me/page.test.tsx`

**Interfaces:**
- Consumes: Task 3의 `updateUser({ nickname, introduction, imageFile })` (`UserUpdate`).
- Produces: 사용자 시나리오 완성 — 파일 선택(미리보기) → 저장(업로드+DB) → 제거(정리).

- [ ] **Step 1: 테스트 대역 갱신 — `app/me/page.test.tsx`**

(a) `supaMock`의 profiles 레코드 타입에 `image_path?: string | null` 추가, upsert가 `image_path: row.image_path ?? null`을 저장하도록 갱신 (Task 3 Step 1(a)와 같은 형태 — upsert 인자 타입에도 `image_path?: string | null` 추가).

(b) `supaMock` 아래에 스토리지 대역 추가:

```ts
// Supabase Storage 대역 — 업로드는 '변경 사항 저장' 시점에만 일어나야 한다.
const storageMock = vi.hoisted(() => {
  const state = { uploadError: null as { message: string } | null }
  const upload = vi.fn(async () => {
    if (state.uploadError) return { data: null, error: state.uploadError }
    return { data: {}, error: null }
  })
  const remove = vi.fn(async () => ({ data: null, error: null }))
  return {
    state,
    upload,
    remove,
    reset() {
      state.uploadError = null
      upload.mockClear()
      remove.mockClear()
    },
  }
})
```

(c) `vi.mock('@/lib/supabase', ...)`의 supabase 객체에 추가:

```ts
    storage: {
      from: () => ({ upload: storageMock.upload, remove: storageMock.remove }),
    },
```

(d) `beforeEach`에 `storageMock.reset()` 추가.

(e) 기존 `supaMock.upsert).toHaveBeenCalledWith(...)` 단언 **전부**(자기소개 저장 4곳 + 별명·자기소개 동시 1곳 + 별명만 1곳 = 6곳)의 기대 페이로드에 `image_path: null,` 추가.

(f) import에 `fireEvent` 추가: `import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'`

- [ ] **Step 2: 실패하는 새 테스트 추가 — `app/me/page.test.tsx`**

파일 끝에 추가:

```ts
// 숨겨진 파일 입력에 파일을 넣는다. input이 hidden이라 userEvent.upload 대신
// change 이벤트를 직접 쏘고, FileReader 미리보기가 반영될 때까지 기다린다.
async function pickFile(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } })
  })
  await screen.findByAltText('김구글 프로필 이미지')
}

describe('프로필 이미지 (Supabase Storage 업로드)', () => {
  const FIXED_UUID = '11111111-2222-4333-8444-555555555555'

  test('파일을 선택하면 미리보기만 뜨고 업로드는 일어나지 않는다', async () => {
    renderMe()
    await openForm('김구글')

    await pickFile(new File(['img'], 'cat.png', { type: 'image/png' }))

    expect(storageMock.upload).not.toHaveBeenCalled()
    // 파일 선택만으로도 저장 버튼은 활성화된다.
    expect(screen.getByRole('button', { name: '변경 사항 저장' })).toBeEnabled()
  })

  test('저장을 누르면 uuid 파일명으로 업로드하고 image_path를 저장한다', async () => {
    const uuidSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValue(FIXED_UUID)
    try {
      renderMe()
      await openForm('김구글')
      const file = new File(['img'], 'cat.png', { type: 'image/png' })
      await pickFile(file)

      await userEvent.click(screen.getByRole('button', { name: '변경 사항 저장' }))

      expect(await screen.findByText('저장되었습니다.')).toBeInTheDocument()
      expect(storageMock.upload).toHaveBeenCalledWith(`${FIXED_UUID}.png`, file, {
        contentType: 'image/png',
      })
      expect(supaMock.upsert).toHaveBeenCalledWith(
        {
          user_id: 'uid-123',
          name: '김구글',
          image: null,
          image_path: `${FIXED_UUID}.png`,
          introduction: null,
        },
        { onConflict: 'user_id' },
      )
    } finally {
      uuidSpy.mockRestore()
    }
  })

  test('제거 후 저장하면 image_path가 null로 저장되고 이전 파일이 삭제된다', async () => {
    supaMock.state.profiles['uid-123'] = {
      name: '별명이',
      image: null,
      introduction: null,
      image_path: 'old.png',
    }
    renderMe()
    await openForm('별명이')
    // image_path가 있으므로 조립 URL 아바타와 제거 버튼이 보인다.
    await userEvent.click(screen.getByRole('button', { name: /제거/ }))

    await userEvent.click(screen.getByRole('button', { name: '변경 사항 저장' }))

    expect(await screen.findByText('저장되었습니다.')).toBeInTheDocument()
    expect(storageMock.upload).not.toHaveBeenCalled()
    expect(supaMock.upsert).toHaveBeenCalledWith(
      {
        user_id: 'uid-123',
        name: '별명이',
        image: null,
        image_path: null,
        introduction: null,
      },
      { onConflict: 'user_id' },
    )
    expect(storageMock.remove).toHaveBeenCalledWith(['old.png'])
  })

  test('업로드가 실패하면 오류 안내가 뜨고 DB 저장은 일어나지 않는다', async () => {
    storageMock.state.uploadError = { message: 'quota exceeded' }
    renderMe()
    await openForm('김구글')
    await pickFile(new File(['img'], 'cat.png', { type: 'image/png' }))

    await userEvent.click(screen.getByRole('button', { name: '변경 사항 저장' }))

    expect(
      await screen.findByText('저장하지 못했어요. 잠시 후 다시 시도해 주세요.'),
    ).toBeInTheDocument()
    expect(supaMock.upsert).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run app/me/page.test.tsx`
Expected: FAIL — 새 테스트 4개 실패 (`저장을 누르면...`은 upload 미호출, `제거 후...`는 image_path 미저장 등). Task 3에서 `updateUser` 시그니처가 바뀌었으므로 page.tsx의 `updateUser({ nickname, image, introduction })` 호출이 타입 에러를 내는 것도 이 시점에 확인된다.

- [ ] **Step 4: `app/me/page.tsx` 구현**

(a) 상태 추가 (`const [image, setImage] = ...` 아래):

```ts
  // 새로 고른 파일. 업로드는 '변경 사항 저장'에서 일어난다 — 선택 시점에는 미리보기만.
  const [pendingFile, setPendingFile] = useState<File | null>(null)
```

(b) `dirty` 계산 교체:

```ts
  // 이미지 변경 여부: 새 파일을 골랐거나(pendingFile), 있던 이미지를 제거했거나.
  // data URL 미리보기와 저장된 URL은 문자열로 비교할 수 없어 상태로 판정한다.
  const imageDirty = pendingFile !== null || (image === null && user.image !== null)
  const dirty =
    nickname !== user.nickname || imageDirty || introduction !== (user.introduction ?? '')
```

(c) `handleFile`에 파일 보관 추가 (FileReader 미리보기 위):

```ts
    // 여기서는 미리보기만 만든다 — 실제 업로드는 '변경 사항 저장'에서 일어난다.
    setPendingFile(file)
```

(d) '제거' 버튼 onClick 교체:

```tsx
                      onClick={() => {
                        setImage(null)
                        setPendingFile(null)
                      }}
```

(e) `handleSave`의 `updateUser` 호출 교체:

```ts
    // File = 교체, null = 제거, undefined = 변경 없음
    const imageFile = pendingFile ?? (image === null && user.image !== null ? null : undefined)
    const { error } = await updateUser({
      nickname: trimmed,
      introduction: introTrimmed === '' ? null : introTrimmed,
      imageFile,
    })
```

성공 분기(`setSaved(true)` 앞)에 `setPendingFile(null)` 추가.

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run app/me/page.test.tsx`
Expected: PASS (기존 + 신규 4개 전부)

- [ ] **Step 6: 전체 테스트 회귀 확인**

Run: `npm run test:run`
Expected: 전부 PASS

- [ ] **Step 7: 커밋**

```bash
git add app/me/page.tsx app/me/page.test.tsx
git commit -m "feat: upload profile image to storage on save in /me

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: 최종 검증 — 전체 테스트 + 실기 확인

**Files:** 없음 (검증만)

**Interfaces:**
- Consumes: Task 1~4 전부.
- Produces: 동작 확인된 기능. (DESIGN.md는 갱신 불필요 — 토큰·컴포넌트·화면 구조 변경이 없다.)

- [ ] **Step 1: 전체 테스트**

Run: `npm run test:run`
Expected: 전부 PASS

- [ ] **Step 2: 사용자에게 환경변수 이전 요청 (차단 지점)**

`.env.local`은 훅이 막고 있으므로 사용자가 직접 다음 한 줄을 `.env.local`에 추가해야 한다:

```
NEXT_PUBLIC_PROFILE_IMAGE_BASE_URL=https://toazanfnikwnvhlkjhmz.supabase.co/storage/v1/object/public/profile-image
```

이 값이 없으면 `lib/storage.ts`의 모듈 로드 체크 때문에 `npm run dev`/`npm run build`가 실패한다. **사용자 확인 후 다음 단계로.**

- [ ] **Step 3: 실기 확인 (테스트의 Supabase는 모킹이므로 필수)**

1. `npm run dev` → http://localhost:3000 (3001로 뜨면 HANDOVER.md의 포트 주의사항 참고)
2. Google 로그인 → `/me` 진입
3. 이미지 변경 → 파일 선택 → 미리보기 확인 → 이 시점에 Supabase 대시보드 Storage에 파일이 **없어야** 함
4. '변경 사항 저장' → "저장되었습니다." → Storage `profile-image` 버킷에 `{uuid}.{ext}` 생성 확인, `profile.image_path`에 파일명 저장 확인 (`mcp__supabase__execute_sql`: `select user_id, image, image_path from public.profile;`)
5. 새로고침 → 아바타가 스토리지 URL로 표시되는지 (개발자 도구에서 `<img src>`가 `…/object/public/profile-image/…`인지)
6. 다시 이미지 변경 → 저장 → 이전 파일이 버킷에서 삭제됐는지
7. '제거' → 저장 → 아바타가 이니셜로, `image_path`가 null로, 파일 삭제 확인

- [ ] **Step 4: 마무리**

superpowers:finishing-a-development-branch 스킬로 정리 (이 작업은 master 직접 작업이므로 사실상 push 여부 결정).
