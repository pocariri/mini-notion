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

// public.profile 테이블(1:1 프로필)의 in-memory 대역.
// upsert가 uid별 행을 덮어쓰고, select().eq().maybeSingle()이 그 행을 돌려준다.
const dbMock = vi.hoisted(() => {
  const state = {
    profiles: {} as Record<string, { name: string | null; image: string | null }>,
    upsertError: null as { message: string } | null,
  }
  return {
    state,
    upsert: vi.fn(
      async (row: { user_id: string; name: string | null; image: string | null }) => {
        if (state.upsertError) return { error: state.upsertError }
        state.profiles[row.user_id] = { name: row.name, image: row.image }
        return { error: null }
      },
    ),
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
    from: () => ({
      select: () => ({
        eq: (_col: string, uid: string) => ({
          maybeSingle: async () => ({
            data: dbMock.state.profiles[uid] ?? null,
            error: null,
          }),
        }),
      }),
      upsert: dbMock.upsert,
    }),
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
  dbMock.state.profiles = {}
  dbMock.state.upsertError = null
  dbMock.upsert.mockClear()
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

  test('초기화 시 레거시 오버레이 키(mini-notion:user-overlay:*)를 제거한다', async () => {
    localStorage.setItem('mini-notion:user-overlay:uid-123', '{"nickname":"옛별명"}')

    await renderStore()

    expect(localStorage.getItem('mini-notion:user-overlay:uid-123')).toBeNull()
  })
})

describe('프로필 (Supabase public.profile 연동)', () => {
  test('updateUser는 별명을 profile 행에 upsert하고 user에 반영한다', async () => {
    const { result } = await renderStore()
    act(() => {
      authMock.fire('SIGNED_IN', googleSession)
    })

    await act(async () => {
      const { error } = await result.current.updateUser({ nickname: '나만의별명' })
      expect(error).toBeNull()
    })

    expect(result.current.user?.nickname).toBe('나만의별명')
    expect(result.current.user?.email).toBe('real@gmail.com')
    expect(dbMock.upsert).toHaveBeenCalledWith(
      {
        user_id: 'uid-123',
        name: '나만의별명',
        image: 'https://lh3.googleusercontent.com/a/photo.jpg',
      },
      { onConflict: 'user_id' },
    )
  })

  test('이미지를 null로 수정하면 DB에 null이 저장되고 빈 아바타가 된다', async () => {
    const { result } = await renderStore()
    act(() => {
      authMock.fire('SIGNED_IN', googleSession)
    })

    await act(async () => {
      await result.current.updateUser({ image: null })
    })

    expect(result.current.user?.image).toBeNull()
    expect(dbMock.upsert).toHaveBeenCalledWith(
      { user_id: 'uid-123', name: '김구글', image: null },
      { onConflict: 'user_id' },
    )
  })

  test('DB에 저장된 프로필은 다시 로그인해도 복원된다', async () => {
    dbMock.state.profiles['uid-123'] = { name: '저장된별명', image: null }
    authMock.state.session = googleSession

    const { result } = await renderStore()

    await waitFor(() => expect(result.current.user?.nickname).toBe('저장된별명'))
    expect(result.current.user?.image).toBeNull()
  })

  test('upsert가 실패하면 에러 메시지를 돌려주고 user는 그대로다', async () => {
    dbMock.state.upsertError = { message: 'boom' }
    const { result } = await renderStore()
    act(() => {
      authMock.fire('SIGNED_IN', googleSession)
    })

    let error: string | null = null
    await act(async () => {
      ;({ error } = await result.current.updateUser({ nickname: '실패별명' }))
    })

    expect(error).toBe('boom')
    expect(result.current.user?.nickname).toBe('김구글')
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
  test('글을 지우고 프로필을 Google 기본값으로 되돌린 뒤 signOut한다', async () => {
    authMock.state.session = googleSession
    const { result } = await renderStore()
    act(() => {
      result.current.createPost('지울 글')
    })
    await act(async () => {
      await result.current.updateUser({ nickname: '지울별명' })
    })

    await act(async () => {
      await result.current.resetAll()
    })

    expect(result.current.posts).toHaveLength(0)
    expect(result.current.user).toBeNull()
    expect(dbMock.state.profiles['uid-123']).toEqual({
      name: '김구글',
      image: 'https://lh3.googleusercontent.com/a/photo.jpg',
    })
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
