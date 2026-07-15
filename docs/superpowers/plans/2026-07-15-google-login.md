# 실제 Google 로그인 (Supabase Auth) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인 페이지의 가짜 Google 로그인을 Supabase Auth 기반 실제 Google OAuth로 교체한다 (스펙: `docs/superpowers/specs/2026-07-15-google-login-design.md`).

**Architecture:** 클라이언트 전용 supabase-js. `lib/supabase.ts` 브라우저 싱글턴 하나를 두고, `lib/store.tsx`의 `user`를 Supabase 세션에서 파생시킨다(초기 `getSession()` + `onAuthStateChange` 구독). Google 계정 초기값 위에 `/me` 수정분을 uid별 localStorage 오버레이로 병합. 서버 코드·쿠키·콜백 라우트 없음.

**Tech Stack:** Next.js 16.2.10 (App Router, 전 페이지 클라이언트 컴포넌트), @supabase/supabase-js 2.110.5 (PKCE), Vitest + Testing Library (jsdom), Playwright (검증용).

## Global Constraints

- 이 Next.js는 16.2.10 — `middleware.ts`가 `proxy.ts`로 개명됨. 이번 범위에서 서버 코드(라우트 핸들러·proxy)를 추가하지 않는다. 새 Next API를 쓸 일이 생기면 `node_modules/next/dist/docs/` 먼저 확인.
- 의존성은 `@supabase/supabase-js@2.110.5` 정확히 고정(`--save-exact`), `package-lock.json` 커밋.
- `.env.local`은 절대 커밋하지 않는다(`.gitignore`의 `.env*`가 이미 제외, `!.env.example`만 예외).
- 글(posts) 데이터는 localStorage 유지. `public.page`/`public.profile` 테이블 연동 금지 (스펙 범위 외).
- 디자인: 새 색상/매직 넘버 금지. 기존 토큰만 사용 (`--red-500`, `--text-2xs` 등, `app/globals.css`). UI 변경 시 `DESIGN.md` 동기화.
- TDD: 모든 코드 변경은 실패하는 테스트(RED) 먼저, 구현(GREEN) 순서.
- 기존 테스트 19개 전부 계속 통과해야 한다 (`npm run test:run`).
- Supabase 프로젝트: `https://toazanfnikwnvhlkjhmz.supabase.co`, publishable key `sb_publishable_57ayVV4xcokJuKAlWZvfBA_uKzliJFv`, Google provider 활성화 확인됨.
- 커밋 메시지 끝에 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` 추가.

## 파일 구조

| 파일 | 역할 |
|---|---|
| `lib/supabase.ts` (신규) | 브라우저용 supabase-js 클라이언트 싱글턴. 유일한 Supabase 접점 |
| `.env.local` (신규, 미커밋) | Supabase URL·publishable key |
| `.env.example` (신규, 커밋) | 환경 변수 템플릿 |
| `lib/store.tsx` (수정) | user를 세션에서 파생, login/logout/resetAll을 실제 인증으로, 오버레이 병합 |
| `lib/store.test.tsx` (수정) | supabase 모킹 + 인증/오버레이/시드 테스트, 기존 테스트 async 대응 |
| `app/login/page.tsx` (수정) | 가짜 setTimeout 제거, 실제 login() + 에러 표시 |
| `app/login/page.test.tsx` (신규) | 로그인 페이지 컴포넌트 테스트 |
| `app/globals.css` (수정) | `.login-error` 스타일 (기존 토큰만) |
| `DESIGN.md` (수정) | §5.10 Login에 에러 상태 반영 |

변경하지 않는 파일: `app/page.tsx`, `app/workspace/page.tsx`, `app/me/page.tsx`(스토어 인터페이스가 호환 유지), `components/*`.

---

### Task 1: 브랜치·의존성·Supabase 클라이언트·환경 변수

**Files:**
- Create: `lib/supabase.ts`
- Create: `.env.local` (커밋 안 함)
- Create: `.env.example`
- Modify: `package.json`, `package-lock.json` (npm install 결과)

**Interfaces:**
- Produces: `lib/supabase.ts`가 `export const supabase` (supabase-js `SupabaseClient`)를 내보낸다. Task 2의 스토어가 `import { supabase } from './supabase'`로 사용.

- [ ] **Step 1: 작업 브랜치 생성**

```bash
git checkout -b 003-google-login
```

- [ ] **Step 2: 의존성 설치 (버전 고정)**

```bash
npm install --save-exact @supabase/supabase-js@2.110.5
```

Expected: `package.json` dependencies에 `"@supabase/supabase-js": "2.110.5"` 추가.

- [ ] **Step 3: 환경 변수 파일 생성**

`.env.local` (git 제외 — `.gitignore`의 `.env*`):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://toazanfnikwnvhlkjhmz.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_57ayVV4xcokJuKAlWZvfBA_uKzliJFv
```

`.env.example` (커밋 대상 — `.gitignore`의 `!.env.example` 예외):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

- [ ] **Step 4: `lib/supabase.ts` 작성**

```ts
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY가 필요합니다 (.env.local 참고: .env.example).',
  )
}

// 브라우저 전용 싱글턴. PKCE 흐름: 로그인 복귀 시 URL의 인증 코드를
// supabase-js가 자동 교환(detectSessionInUrl)해 세션을 복원한다.
export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})
```

- [ ] **Step 5: 회귀 확인 + 타입 체크**

```bash
npm run test:run
npx tsc --noEmit
```

Expected: 기존 테스트 전부 PASS (파일 4개: format·store·Editor·CatCover), tsc 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add package.json package-lock.json lib/supabase.ts .env.example
git commit -m "feat: add supabase-js client singleton and env template

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

`git status`로 `.env.local`이 스테이징되지 않았는지 확인 (untracked에도 없어야 정상 — `.env*` 제외 규칙).

---

### Task 2: 스토어를 Supabase 세션 기반으로 전환 (TDD)

**Files:**
- Modify: `lib/store.test.tsx` (전체 교체)
- Modify: `lib/store.tsx` (전체 교체)

**Interfaces:**
- Consumes: Task 1의 `supabase` 싱글턴 (`lib/supabase.ts`).
- Produces (기존 소비자인 `app/*.tsx`가 의존하는 시그니처 — 호환 유지):
  - `useStore()` → `{ ready: boolean; user: User | null; posts: Post[]; ... }`
  - `User = { nickname: string; email: string; image: string | null }` (변경 없음)
  - `login: () => Promise<{ error: string | null }>` ← 기존 `() => void`에서 변경. Task 3의 로그인 페이지가 사용.
  - `logout: () => Promise<void>`, `resetAll: () => Promise<void>` ← async로 변경되지만 기존 호출부(`app/me/page.tsx`)는 fire-and-forget이라 수정 불필요.
  - 나머지(`updateUser`, `createPost`, `updatePost`, `toggleFavorite`, `trashPost`, `restorePost`, `deletePostForever`)는 시그니처 동일.

- [ ] **Step 1: 실패하는 테스트 작성 — `lib/store.test.tsx` 전체를 다음으로 교체**

```tsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

// 스토어는 lib/supabase.ts 싱글턴을 통해서만 Supabase와 통신한다.
// 그 경계를 통째로 모킹하고, 테스트에서 fire()로 인증 이벤트를 흉내 낸다.
const authMock = vi.hoisted(() => {
  type AuthCallback = (event: string, session: unknown) => void
  const state = {
    session: null as unknown,
    callbacks: [] as AuthCallback[],
  }
  return {
    state,
    fire(event: string, session: unknown) {
      state.session = session
      for (const cb of [...state.callbacks]) cb(event, session)
    },
    signInWithOAuth: vi.fn(async () => ({
      data: {},
      error: null as { message: string } | null,
    })),
    signOut: vi.fn(async () => {
      state.session = null
      for (const cb of [...state.callbacks]) cb('SIGNED_OUT', null)
      return { error: null }
    }),
  }
})

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: authMock.state.session } }),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        authMock.state.callbacks.push(cb)
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                const i = authMock.state.callbacks.indexOf(cb)
                if (i >= 0) authMock.state.callbacks.splice(i, 1)
              },
            },
          },
        }
      },
      signInWithOAuth: authMock.signInWithOAuth,
      signOut: authMock.signOut,
    },
  },
}))

import { StoreProvider, useStore } from './store'

const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider>{children}</StoreProvider>
)

const googleSession = {
  user: {
    id: 'uid-123',
    email: 'real@gmail.com',
    user_metadata: {
      full_name: '김구글',
      avatar_url: 'https://lh3.googleusercontent.com/a/photo.jpg',
    },
  },
}

async function renderStore() {
  const utils = renderHook(() => useStore(), { wrapper })
  await waitFor(() => expect(utils.result.current.ready).toBe(true))
  return utils
}

beforeEach(() => {
  authMock.state.session = null
  authMock.state.callbacks.length = 0
  authMock.signInWithOAuth.mockClear()
  authMock.signOut.mockClear()
})

describe('인증 (Supabase Google OAuth)', () => {
  test('login은 signInWithOAuth를 google provider와 /login 복귀 주소로 호출한다', async () => {
    const { result } = await renderStore()

    await act(async () => {
      await result.current.login()
    })

    expect(authMock.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/login` },
    })
  })

  test('SIGNED_IN 세션에서 Google 이름·이메일·사진으로 user를 파생한다', async () => {
    const { result } = await renderStore()

    act(() => {
      authMock.fire('SIGNED_IN', googleSession)
    })

    expect(result.current.user).toEqual({
      nickname: '김구글',
      email: 'real@gmail.com',
      image: 'https://lh3.googleusercontent.com/a/photo.jpg',
    })
  })

  test('full_name이 없으면 이메일 로컬 파트를 별명으로 쓴다', async () => {
    const { result } = await renderStore()

    act(() => {
      authMock.fire('SIGNED_IN', {
        user: { id: 'uid-9', email: 'nobody@gmail.com', user_metadata: {} },
      })
    })

    expect(result.current.user?.nickname).toBe('nobody')
  })

  test('마운트 시 기존 세션이 있으면 user가 바로 복원된다', async () => {
    authMock.state.session = googleSession

    const { result } = await renderStore()

    expect(result.current.user?.email).toBe('real@gmail.com')
  })

  test('logout은 signOut을 호출하고 user를 null로 만든다', async () => {
    authMock.state.session = googleSession
    const { result } = await renderStore()

    await act(async () => {
      await result.current.logout()
    })

    expect(authMock.signOut).toHaveBeenCalled()
    expect(result.current.user).toBeNull()
  })

  test('초기화 시 레거시 mini-notion:user 키를 제거한다', async () => {
    localStorage.setItem('mini-notion:user', '{"nickname":"유아이볼"}')

    await renderStore()

    expect(localStorage.getItem('mini-notion:user')).toBeNull()
  })
})

describe('프로필 오버레이', () => {
  test('updateUser는 별명 수정을 uid별 오버레이에 저장하고 user에 병합한다', async () => {
    const { result } = await renderStore()
    act(() => {
      authMock.fire('SIGNED_IN', googleSession)
    })

    act(() => {
      result.current.updateUser({ nickname: '나만의별명' })
    })

    expect(result.current.user?.nickname).toBe('나만의별명')
    expect(result.current.user?.email).toBe('real@gmail.com')
    const raw = localStorage.getItem('mini-notion:user-overlay:uid-123')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!)).toMatchObject({ nickname: '나만의별명' })
  })

  test('이미지를 null로 수정하면 Google 사진 대신 빈 아바타가 된다', async () => {
    const { result } = await renderStore()
    act(() => {
      authMock.fire('SIGNED_IN', googleSession)
    })

    act(() => {
      result.current.updateUser({ image: null })
    })

    expect(result.current.user?.image).toBeNull()
  })

  test('저장된 오버레이는 다시 로그인해도 유지된다', async () => {
    localStorage.setItem(
      'mini-notion:user-overlay:uid-123',
      JSON.stringify({ nickname: '저장된별명' }),
    )
    authMock.state.session = googleSession

    const { result } = await renderStore()

    await waitFor(() => expect(result.current.user?.nickname).toBe('저장된별명'))
  })
})

describe('첫 로그인 시드', () => {
  test('저장된 글이 없는 첫 로그인이면 시드 글을 만든다', async () => {
    const { result } = await renderStore()
    expect(result.current.posts).toHaveLength(0)

    act(() => {
      authMock.fire('SIGNED_IN', googleSession)
    })

    await waitFor(() => expect(result.current.posts.length).toBeGreaterThan(0))
  })

  test('저장된 글이 있으면 시드를 만들지 않는다', async () => {
    localStorage.setItem('mini-notion:posts', JSON.stringify([]))

    const { result } = await renderStore()
    act(() => {
      authMock.fire('SIGNED_IN', googleSession)
    })

    expect(result.current.posts).toHaveLength(0)
  })
})

describe('resetAll', () => {
  test('글과 오버레이를 지우고 signOut한다', async () => {
    authMock.state.session = googleSession
    const { result } = await renderStore()
    act(() => {
      result.current.createPost('지울 글')
    })
    act(() => {
      result.current.updateUser({ nickname: '지울별명' })
    })

    await act(async () => {
      await result.current.resetAll()
    })

    expect(result.current.posts).toHaveLength(0)
    expect(result.current.user).toBeNull()
    expect(localStorage.getItem('mini-notion:user-overlay:uid-123')).toBeNull()
    expect(authMock.signOut).toHaveBeenCalled()
  })
})

describe('글 CRUD (기존 동작 유지)', () => {
  test('createPost는 새 글을 목록 맨 앞에 추가하고 id를 반환한다', async () => {
    const { result } = await renderStore()

    let id = ''
    act(() => {
      id = result.current.createPost('제목', '내용')
    })

    expect(id).toBeTruthy()
    expect(result.current.posts[0]).toMatchObject({
      id,
      title: '제목',
      content: '내용',
      favorite: false,
      deletedAt: null,
    })
  })

  test('createPost로 만든 글은 localStorage(mini-notion:posts)에 저장된다', async () => {
    const { result } = await renderStore()

    act(() => {
      result.current.createPost('저장 확인')
    })

    const raw = localStorage.getItem('mini-notion:posts')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!)[0].title).toBe('저장 확인')
  })

  test('trashPost는 글을 영구 삭제하지 않고 deletedAt만 채운다', async () => {
    const { result } = await renderStore()

    let id = ''
    act(() => {
      id = result.current.createPost('버릴 글')
    })
    act(() => {
      result.current.trashPost(id)
    })

    const post = result.current.posts.find((p) => p.id === id)
    expect(post).toBeDefined()
    expect(post!.deletedAt).not.toBeNull()
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인 (RED)**

```bash
npm run test:run -- lib/store.test.tsx
```

Expected: FAIL — `login()`이 Promise를 반환하지 않고, `signInWithOAuth` 미호출, user 파생 로직 없음 등으로 신규 테스트 다수 실패. (기존 스토어는 `./supabase`를 import하지 않으므로 모킹은 무해하게 무시된다.)

- [ ] **Step 3: `lib/store.tsx` 전체를 다음으로 교체 (GREEN)**

```tsx
'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type User = {
  nickname: string
  email: string
  image: string | null
}

export type Post = {
  id: string
  title: string
  content: string
  favorite: boolean
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

type Store = {
  ready: boolean
  user: User | null
  posts: Post[]
  login: () => Promise<{ error: string | null }>
  logout: () => Promise<void>
  updateUser: (patch: Partial<User>) => void
  createPost: (title?: string, content?: string) => string
  updatePost: (id: string, patch: Partial<Pick<Post, 'title' | 'content'>>) => void
  toggleFavorite: (id: string) => void
  trashPost: (id: string) => void
  restorePost: (id: string) => void
  deletePostForever: (id: string) => void
  resetAll: () => Promise<void>
}

const POSTS_KEY = 'mini-notion:posts'
// 가짜 로그인 시절의 사용자 키 — 실제 세션과 섞이지 않도록 초기화 시 제거한다.
const LEGACY_USER_KEY = 'mini-notion:user'

const overlayKey = (uid: string) => `mini-notion:user-overlay:${uid}`

// Google 계정 초기값 위에 /me에서 수정한 값을 덮어쓰는 로컬 오버레이.
// image는 "명시적으로 제거(null)"와 "수정한 적 없음(키 없음)"을 구분한다.
type Overlay = { nickname?: string; image?: string | null }

type AuthUser = { uid: string; base: User }

const StoreContext = createContext<Store | null>(null)

function loadJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function userFromSession(session: Session | null): AuthUser | null {
  const su = session?.user
  if (!su) return null
  const email = su.email ?? ''
  const meta = su.user_metadata ?? {}
  const fullName =
    typeof meta.full_name === 'string' && meta.full_name
      ? meta.full_name
      : typeof meta.name === 'string'
        ? meta.name
        : ''
  const avatar = typeof meta.avatar_url === 'string' ? meta.avatar_url : null
  return {
    uid: su.id,
    base: {
      nickname: fullName || email.split('@')[0] || '사용자',
      email,
      image: avatar,
    },
  }
}

function seedPosts(now: number): Post[] {
  const day = 86_400_000
  const make = (
    title: string,
    content: string,
    age: number,
    favorite = false,
  ): Post => ({
    id: crypto.randomUUID(),
    title,
    content,
    favorite,
    createdAt: now - age,
    updatedAt: now - age,
    deletedAt: null,
  })
  return [
    make(
      '주간 업무 정리',
      '이번 주 목표\n- 미니 노션 MVP 마무리\n- 디자인 시스템 토큰 정리\n- 회의록 템플릿 만들기\n\n메모\n수요일 오후는 집중 작업 시간으로 비워 두기.',
      2 * day,
      true,
    ),
    make(
      '신제품 아이디어',
      '- 개인용 미니 노션: 글 CRUD만 있는 가장 단순한 버전\n- 슬래시 명령(/page)으로 빠르게 새 글 만들기\n- 나중에: 태그 분류, 검색, 할 일 목록',
      3 * day,
    ),
    make(
      '회의 메모',
      '7월 첫 주 회의\n- MVP 범위: 로그인, 업무 페이지, 글 상세, 마이 페이지\n- 운영 비용 0원 유지\n- 다음 회의까지 와이어프레임 확정',
      5 * day,
    ),
    make(
      '읽을 자료 모음',
      '- PRD 작성 가이드\n- 디자인 핸드오프 체크리스트\n- Next.js App Router 문서',
      8 * day,
    ),
  ]
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [overlay, setOverlay] = useState<Overlay>({})
  const [posts, setPosts] = useState<Post[]>([])
  const hadStoredPosts = useRef(false)

  useEffect(() => {
    localStorage.removeItem(LEGACY_USER_KEY)
    hadStoredPosts.current = localStorage.getItem(POSTS_KEY) !== null
    setPosts(loadJSON<Post[]>(POSTS_KEY) ?? [])

    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      setAuthUser(userFromSession(session))
      setReady(true)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(userFromSession(session))
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const uid = authUser?.uid ?? null

  // 계정이 바뀌면 그 계정의 로컬 수정분(오버레이)을 불러온다.
  useEffect(() => {
    setOverlay(uid ? (loadJSON<Overlay>(overlayKey(uid)) ?? {}) : {})
  }, [uid])

  // 이 브라우저에서 글을 저장한 적 없는 첫 로그인이면 시드 글을 만든다.
  useEffect(() => {
    if (!uid || hadStoredPosts.current) return
    setPosts(seedPosts(Date.now()))
    hadStoredPosts.current = true
  }, [uid])

  useEffect(() => {
    if (!ready) return
    localStorage.setItem(POSTS_KEY, JSON.stringify(posts))
  }, [posts, ready])

  const login = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/login` },
    })
    return { error: error?.message ?? null }
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const updateUser = useCallback(
    (patch: Partial<User>) => {
      if (!uid) return
      const next: Overlay = { ...overlay }
      if (patch.nickname !== undefined) next.nickname = patch.nickname
      if ('image' in patch) next.image = patch.image ?? null
      setOverlay(next)
      localStorage.setItem(overlayKey(uid), JSON.stringify(next))
    },
    [uid, overlay],
  )

  const createPost = useCallback((title = '', content = '') => {
    const now = Date.now()
    const post: Post = {
      id: crypto.randomUUID(),
      title,
      content,
      favorite: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }
    setPosts((ps) => [post, ...ps])
    return post.id
  }, [])

  const updatePost = useCallback(
    (id: string, patch: Partial<Pick<Post, 'title' | 'content'>>) => {
      setPosts((ps) =>
        ps.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)),
      )
    },
    [],
  )

  const toggleFavorite = useCallback((id: string) => {
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, favorite: !p.favorite } : p)))
  }, [])

  const trashPost = useCallback((id: string) => {
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, deletedAt: Date.now() } : p)))
  }, [])

  const restorePost = useCallback((id: string) => {
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, deletedAt: null } : p)))
  }, [])

  const deletePostForever = useCallback((id: string) => {
    setPosts((ps) => ps.filter((p) => p.id !== id))
  }, [])

  const resetAll = useCallback(async () => {
    setPosts([])
    setOverlay({})
    localStorage.removeItem(POSTS_KEY)
    if (uid) localStorage.removeItem(overlayKey(uid))
    hadStoredPosts.current = false
    await supabase.auth.signOut()
  }, [uid])

  const user = useMemo<User | null>(() => {
    if (!authUser) return null
    const { base } = authUser
    return {
      nickname: overlay.nickname ?? base.nickname,
      email: base.email,
      image: 'image' in overlay ? (overlay.image ?? null) : base.image,
    }
  }, [authUser, overlay])

  const value = useMemo<Store>(
    () => ({
      ready,
      user,
      posts,
      login,
      logout,
      updateUser,
      createPost,
      updatePost,
      toggleFavorite,
      trashPost,
      restorePost,
      deletePostForever,
      resetAll,
    }),
    [
      ready,
      user,
      posts,
      login,
      logout,
      updateUser,
      createPost,
      updatePost,
      toggleFavorite,
      trashPost,
      restorePost,
      deletePostForever,
      resetAll,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used within StoreProvider')
  return store
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인 (GREEN)**

```bash
npm run test:run
```

Expected: 전체 PASS (`lib/store.test.tsx`는 15개: 인증 6 + 오버레이 3 + 시드 2 + resetAll 1 + CRUD 3). `app/login/page.tsx`는 아직 `login()`을 동기처럼 호출하지만 반환값을 쓰지 않으므로 컴파일·기존 테스트에 영향 없음.

```bash
npx tsc --noEmit
```

Expected: 에러 없음.

- [ ] **Step 5: 커밋**

```bash
git add lib/store.tsx lib/store.test.tsx
git commit -m "feat: derive user from Supabase session with per-uid local overlay

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: 로그인 페이지 실제 로그인 + 에러 표시 (TDD)

**Files:**
- Create: `app/login/page.test.tsx`
- Modify: `app/login/page.tsx` (전체 교체)
- Modify: `app/globals.css` (`.login-note` 블록 뒤에 `.login-error` 추가, 954행 부근)
- Modify: `DESIGN.md` (§5.10 Login 동기화)

**Interfaces:**
- Consumes: Task 2의 `login: () => Promise<{ error: string | null }>`.
- Produces: 없음 (말단 UI).

- [ ] **Step 1: 실패하는 테스트 작성 — `app/login/page.test.tsx` 생성**

```tsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const routerMock = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
}))

const authMock = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(async () => ({
    data: {},
    error: null as { message: string } | null,
  })),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      signInWithOAuth: authMock.signInWithOAuth,
      signOut: vi.fn(async () => ({ error: null })),
    },
  },
}))

import { StoreProvider } from '@/lib/store'
import LoginPage from './page'

function renderLogin() {
  return render(
    <StoreProvider>
      <LoginPage />
    </StoreProvider>,
  )
}

beforeEach(() => {
  authMock.signInWithOAuth.mockClear()
  authMock.signInWithOAuth.mockImplementation(async () => ({ data: {}, error: null }))
  routerMock.replace.mockClear()
  window.history.replaceState(null, '', '/login')
})

describe('LoginPage', () => {
  test('버튼 클릭 시 Google OAuth 로그인을 시작한다', async () => {
    renderLogin()

    await userEvent.click(
      screen.getByRole('button', { name: /Google 계정으로 계속하기/ }),
    )

    await waitFor(() =>
      expect(authMock.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/login` },
      }),
    )
  })

  test('로그인 시작에 실패하면 에러 문구를 보여주고 버튼을 다시 활성화한다', async () => {
    authMock.signInWithOAuth.mockImplementation(async () => ({
      data: {},
      error: { message: 'boom' },
    }))
    renderLogin()

    const button = screen.getByRole('button', { name: /Google 계정으로 계속하기/ })
    await userEvent.click(button)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Google 로그인을 시작하지 못했어요',
    )
    expect(button).toBeEnabled()
  })

  test('OAuth 취소로 ?error=가 붙어 돌아오면 안내 문구를 보여준다', async () => {
    window.history.replaceState(
      null,
      '',
      '/login?error=access_denied&error_description=cancelled',
    )
    renderLogin()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Google 로그인이 완료되지 않았어요',
    )
    // 안내 후 URL에서 에러 파라미터를 지운다
    await waitFor(() => expect(window.location.search).toBe(''))
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인 (RED)**

```bash
npm run test:run -- app/login/page.test.tsx
```

Expected: FAIL — 현재 페이지는 `setTimeout` 가짜 로그인이라 `signInWithOAuth` 미호출, `role="alert"` 요소 없음.

- [ ] **Step 3: `app/login/page.tsx` 전체를 다음으로 교체**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import GoogleLogo from '@/components/GoogleLogo'
import { useStore } from '@/lib/store'

export default function LoginPage() {
  const { ready, user, login } = useStore()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (ready && user) router.replace('/workspace')
  }, [ready, user, router])

  // OAuth 취소/실패로 돌아오면 쿼리(또는 해시)에 error가 실려 온다.
  useEffect(() => {
    const search = new URLSearchParams(window.location.search)
    const hash = new URLSearchParams(window.location.hash.slice(1))
    if (search.has('error') || hash.has('error')) {
      setError('Google 로그인이 완료되지 않았어요. 다시 시도해 주세요.')
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  const handleLogin = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    const { error: loginError } = await login()
    if (loginError) {
      setError('Google 로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.')
      setBusy(false)
      return
    }
    // 성공하면 브라우저가 Google로 리다이렉트되므로 busy를 유지한다.
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-logo">m</div>
        <h1 className="login-title">mini notion</h1>
        <p className="login-tagline">개인 업무를, 내 방식대로.</p>
        <button
          className="btn btn-lg google-btn"
          onClick={handleLogin}
          disabled={busy}
        >
          <GoogleLogo size={18} />
          {busy ? 'Google로 이동 중…' : 'Google 계정으로 계속하기'}
        </button>
        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
        <p className="login-note">첫 로그인 시 자동으로 계정이 생성됩니다.</p>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: `app/globals.css`의 `.login-note` 블록 바로 뒤에 추가**

```css
.login-error {
  margin: 16px 0 0;
  font-size: var(--text-2xs);
  color: var(--red-500);
}
```

(기존 토큰만 사용: `--text-2xs`, `--red-500`. 새 값 없음.)

- [ ] **Step 5: 테스트 실행 — 통과 확인 (GREEN)**

```bash
npm run test:run
npx tsc --noEmit
```

Expected: 전체 PASS (로그인 페이지 3개 포함), tsc 에러 없음.

- [ ] **Step 6: `DESIGN.md` §5.10 Login 동기화**

§5.10의 스타일 표에서 `.login-note` 행 아래에 다음 행을 추가:

```markdown
| `.login-error` | `margin:16px 0 0`, `--text-2xs`, `color:--red-500`(#e5484d) — Google 로그인 실패·취소 안내, `role="alert"` |
```

같은 섹션의 React 설명 문단(현재 "클릭 시 500ms 후 `login()` + `/workspace`로 이동(목 인증).")을 다음으로 교체:

```markdown
클릭 시 `login()`이 Supabase `signInWithOAuth({ provider: 'google' })`로 실제 Google OAuth 리다이렉트(복귀 랜딩 `/login`, 로그인되면 기존 가드가 `/workspace`로 이동). 시작 실패·취소 시 `.login-error` 문구 표시.
```

§1 개요의 "구글(목) 로그인"은 "구글 로그인(Supabase Auth)"으로 수정.

- [ ] **Step 7: 커밋**

```bash
git add app/login/page.tsx app/login/page.test.tsx app/globals.css DESIGN.md
git commit -m "feat: real Google OAuth login on login page with error states

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: 실제 앱 구동 검증

**Files:**
- Create: (스크래치, 미커밋) `/private/tmp/claude-501/-Users-pocari-Desktop-Sesac-dx-claudecode-master-03-notion-15-notion-social-login/d0c79e65-ba23-4f5a-8978-6ad680c0087e/scratchpad/verify-login.mjs`

**Interfaces:**
- Consumes: Task 1~3의 결과 전체 (dev 서버로 구동).
- Produces: 검증 결과 보고 (코드 산출물 없음).

- [ ] **Step 1: dev 서버 기동**

```bash
npm run dev
```

(백그라운드 실행, 기본 포트 3000. 이미 3000이 점유돼 다른 포트로 뜨면 아래 스크립트의 URL도 맞춰 바꾼다.)

- [ ] **Step 2: 스모크 확인**

```bash
curl -s http://localhost:3000/login | grep -o "Google 계정으로 계속하기" | head -1
```

Expected: `Google 계정으로 계속하기` 출력, dev 서버 로그에 에러 없음.

- [ ] **Step 3: Playwright로 실제 리다이렉트 확인**

스크래치 디렉터리에 `verify-login.mjs` 작성:

```js
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('http://localhost:3000/login')
await page.click('button:has-text("Google 계정으로 계속하기")')
await page.waitForURL(/accounts\.google\.com/, { timeout: 15000 })
console.log('OK: Google OAuth 화면으로 리다이렉트됨 →', page.url())
await browser.close()
```

실행 (playwright 패키지는 스크래치에만 설치, 크로미움은 `~/Library/Caches/ms-playwright/`에 이미 설치돼 있음):

```bash
cd /private/tmp/claude-501/-Users-pocari-Desktop-Sesac-dx-claudecode-master-03-notion-15-notion-social-login/d0c79e65-ba23-4f5a-8978-6ad680c0087e/scratchpad
npm init -y >/dev/null 2>&1 && npm install playwright >/dev/null 2>&1
node verify-login.mjs
```

Expected: `OK: Google OAuth 화면으로 리다이렉트됨 → https://accounts.google.com/...`

실패 시 확인 순서: (1) 콘솔/서버 로그의 에러, (2) 버튼 클릭 후 URL이 그대로면 `signInWithOAuth` 에러 문구가 화면에 떴는지, (3) Supabase 대시보드 → Authentication → URL Configuration에서 Site URL이 `http://localhost:3000`인지.

- [ ] **Step 4: 사용자 완주 확인 요청 (자동화 불가 구간)**

실계정 로그인은 사용자 브라우저에서 확인 부탁:
1. `http://localhost:3000/login` → 버튼 클릭 → 실제 Google 계정 선택.
2. `/workspace` 도착 + 시드 글 4개 표시 확인.
3. `/me`에서 실제 Google 이름·이메일·사진 확인, 별명 수정 → 저장 → 유지 확인.
4. 새로고침 → 세션 유지 확인. 로그아웃 → `/login` 복귀 확인.

주의: 로그인 후 `/login`이 아니라 `/`(루트)로 돌아온다면 Supabase의 Redirect URL allowlist가 `redirectTo`를 거부하고 Site URL로 폴백한 것 — 동작엔 문제없지만, 대시보드 URL Configuration의 Redirect URLs에 `http://localhost:3000/**`를 추가하면 해소된다.

- [ ] **Step 5: dev 서버 종료 + 최종 회귀**

```bash
npm run test:run
```

Expected: 전체 PASS. 문제없으면 완료 보고 (superpowers:verification-before-completion 참고).
