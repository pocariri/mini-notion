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
import { setSystemDark } from '../vitest.setup'

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

describe('테마 (다크모드)', () => {
  test('초기값은 <html data-theme>를 따른다 (인라인 스크립트가 설정한 값, 이중 판정 금지)', async () => {
    document.documentElement.dataset.theme = 'dark'

    const { result } = await renderStore()

    expect(result.current.theme).toBe('dark')
  })

  test('data-theme가 없으면 라이트로 시작한다', async () => {
    const { result } = await renderStore()

    expect(result.current.theme).toBe('light')
  })

  test('toggleTheme은 라이트→다크→라이트로 전이한다', async () => {
    const { result } = await renderStore()

    act(() => {
      result.current.toggleTheme()
    })
    expect(result.current.theme).toBe('dark')

    act(() => {
      result.current.toggleTheme()
    })
    expect(result.current.theme).toBe('light')
  })

  test('전환하면 document의 data-theme가 즉시 갱신된다', async () => {
    const { result } = await renderStore()

    act(() => {
      result.current.toggleTheme()
    })

    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  test('토글한 선택은 localStorage(mini-notion:theme)에 저장된다', async () => {
    const { result } = await renderStore()

    act(() => {
      result.current.toggleTheme()
    })

    expect(localStorage.getItem('mini-notion:theme')).toBe('dark')
  })

  // 아래 두 테스트는 T007에서 이미 구현된 FR-017·FR-018 경로의 회귀 방지 고정(pin)이다.
  test('resetAll은 글 키는 지우되 테마 키(mini-notion:theme)는 보존한다(FR-018)', async () => {
    authMock.state.session = googleSession
    const { result } = await renderStore()
    act(() => {
      result.current.createPost('지울 글')
    })
    act(() => {
      result.current.toggleTheme()
    })
    expect(localStorage.getItem('mini-notion:theme')).toBe('dark')

    await act(async () => {
      await result.current.resetAll()
    })

    // 글 데이터는 비워진다(키는 지속 효과가 빈 배열로 즉시 재기록 — 기존 동작).
    expect(JSON.parse(localStorage.getItem('mini-notion:posts') ?? '[]')).toHaveLength(0)
    expect(localStorage.getItem('mini-notion:theme')).toBe('dark')
  })

  test('저장소 쓰기가 실패해도 세션 내 토글은 계속 동작한다(FR-017)', async () => {
    const { result } = await renderStore()
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    try {
      act(() => {
        result.current.toggleTheme()
      })

      expect(result.current.theme).toBe('dark')
      expect(document.documentElement.dataset.theme).toBe('dark')

      act(() => {
        result.current.toggleTheme()
      })
      expect(result.current.theme).toBe('light')
    } finally {
      setItem.mockRestore()
    }
  })

  test('테마 전환은 posts·user 상태를 건드리지 않는다', async () => {
    authMock.state.session = googleSession
    const { result } = await renderStore()
    act(() => {
      result.current.createPost('테마 무관 글')
    })
    const postsBefore = result.current.posts
    const userBefore = result.current.user

    act(() => {
      result.current.toggleTheme()
    })

    expect(result.current.posts).toBe(postsBefore)
    expect(result.current.user).toBe(userBefore)
  })
})

describe('테마 — 운영체제 설정 연동 (US3)', () => {
  test('저장된 선택이 없는 동안 OS 다크 전환이 즉시 반영된다(FR-016)', async () => {
    document.documentElement.dataset.theme = 'light'
    const { result } = await renderStore()
    expect(result.current.theme).toBe('light')

    act(() => {
      setSystemDark(true)
    })

    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')

    act(() => {
      setSystemDark(false)
    })
    expect(result.current.theme).toBe('light')
  })

  test('토글로 직접 선택한 뒤에는 OS 전환을 무시한다(FR-015)', async () => {
    const { result } = await renderStore()
    act(() => {
      result.current.toggleTheme()
    })
    expect(result.current.theme).toBe('dark')

    act(() => {
      setSystemDark(true)
    })
    act(() => {
      setSystemDark(false)
    })

    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  test('이전 방문에서 저장한 선택이 있으면 OS 전환을 무시한다(FR-015, 재방문)', async () => {
    localStorage.setItem('mini-notion:theme', 'light')
    document.documentElement.dataset.theme = 'light'
    const { result } = await renderStore()

    act(() => {
      setSystemDark(true)
    })

    expect(result.current.theme).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  test('선택 없음 + OS 다크(유효 다크)에서 토글하면 반대인 light가 저장된다', async () => {
    setSystemDark(true)
    document.documentElement.dataset.theme = 'dark'
    const { result } = await renderStore()
    expect(result.current.theme).toBe('dark')

    act(() => {
      result.current.toggleTheme()
    })

    expect(result.current.theme).toBe('light')
    expect(localStorage.getItem('mini-notion:theme')).toBe('light')
  })

  test('첫 렌더는 OS 값을 저장하지 않는다(불변 조건 2 — 선택 전 OS 추적 유지)', async () => {
    setSystemDark(true)
    document.documentElement.dataset.theme = 'dark'

    await renderStore()

    expect(localStorage.getItem('mini-notion:theme')).toBeNull()
  })

  test('matchMedia 미지원 환경에서도 오류 없이 동작한다(라이트 폴백)', async () => {
    const original = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    try {
      const { result } = await renderStore()
      expect(result.current.theme).toBe('light')

      act(() => {
        result.current.toggleTheme()
      })
      expect(result.current.theme).toBe('dark')
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        value: original,
        writable: true,
        configurable: true,
      })
    }
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
