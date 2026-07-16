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
// 실제 행 구조(name·image·introduction)를 그대로 반영한다.
const dbMock = vi.hoisted(() => {
  const state = {
    profiles: {} as Record<
      string,
      { name: string | null; image: string | null; introduction: string | null }
    >,
    upsertError: null as { message: string } | null,
    selectError: null as { message: string } | null,
    lastSelect: null as string | null,
  }
  return {
    state,
    upsert: vi.fn(
      async (row: {
        user_id: string
        name: string | null
        image: string | null
        introduction?: string | null
      }) => {
        if (state.upsertError) return { error: state.upsertError }
        state.profiles[row.user_id] = {
          name: row.name,
          image: row.image,
          introduction: row.introduction ?? null,
        }
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
      select: (columns: string) => {
        dbMock.state.lastSelect = columns
        return {
          eq: (_col: string, uid: string) => ({
            maybeSingle: async () => {
              if (dbMock.state.selectError)
                return { data: null, error: dbMock.state.selectError }
              return { data: dbMock.state.profiles[uid] ?? null, error: null }
            },
          }),
        }
      },
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
  dbMock.state.selectError = null
  dbMock.state.lastSelect = null
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
      introduction: null,
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
    await waitFor(() => expect(result.current.profileStatus).toBe('ready'))

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
        introduction: null,
      },
      { onConflict: 'user_id' },
    )
  })

  test('이미지를 null로 수정하면 DB에 null이 저장되고 빈 아바타가 된다', async () => {
    const { result } = await renderStore()
    act(() => {
      authMock.fire('SIGNED_IN', googleSession)
    })
    await waitFor(() => expect(result.current.profileStatus).toBe('ready'))

    await act(async () => {
      await result.current.updateUser({ image: null })
    })

    expect(result.current.user?.image).toBeNull()
    expect(dbMock.upsert).toHaveBeenCalledWith(
      { user_id: 'uid-123', name: '김구글', image: null, introduction: null },
      { onConflict: 'user_id' },
    )
  })

  test('DB에 저장된 프로필은 다시 로그인해도 복원된다', async () => {
    dbMock.state.profiles['uid-123'] = { name: '저장된별명', image: null, introduction: null }
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
    await waitFor(() => expect(result.current.profileStatus).toBe('ready'))

    let error: string | null = null
    await act(async () => {
      ;({ error } = await result.current.updateUser({ nickname: '실패별명' }))
    })

    expect(error).toBe('boom')
    expect(result.current.user?.nickname).toBe('김구글')
  })
})

describe('자기소개 (public.profile.introduction 연동)', () => {
  test('조회는 introduction 컬럼을 포함하고 저장된 자기소개를 user에 파생한다 (FR-008)', async () => {
    dbMock.state.profiles['uid-123'] = {
      name: '저장된별명',
      image: null,
      introduction: '안녕하세요.\n저장된 소개입니다.',
    }
    authMock.state.session = googleSession

    const { result } = await renderStore()

    await waitFor(() =>
      expect(result.current.user?.introduction).toBe('안녕하세요.\n저장된 소개입니다.'),
    )
    expect(dbMock.state.lastSelect).toBe('name, image, introduction')
  })

  test('프로필 행이 없으면 introduction은 null이고 오류가 아니다', async () => {
    authMock.state.session = googleSession

    const { result } = await renderStore()

    await waitFor(() => expect(result.current.user).not.toBeNull())
    expect(result.current.user?.introduction).toBeNull()
  })

  test('updateUser는 자기소개를 4필드 전체 행으로 upsert하고 user에 반영한다 (FR-010)', async () => {
    const { result } = await renderStore()
    act(() => {
      authMock.fire('SIGNED_IN', googleSession)
    })
    await waitFor(() => expect(result.current.profileStatus).toBe('ready'))

    await act(async () => {
      const { error } = await result.current.updateUser({ introduction: '한 줄 소개' })
      expect(error).toBeNull()
    })

    expect(result.current.user?.introduction).toBe('한 줄 소개')
    expect(dbMock.upsert).toHaveBeenCalledWith(
      {
        user_id: 'uid-123',
        name: '김구글',
        image: 'https://lh3.googleusercontent.com/a/photo.jpg',
        introduction: '한 줄 소개',
      },
      { onConflict: 'user_id' },
    )
  })

  test('updateUser에 introduction: null을 주면 자기소개가 지워진다 (FR-007)', async () => {
    dbMock.state.profiles['uid-123'] = {
      name: '별명',
      image: null,
      introduction: '지울 소개',
    }
    authMock.state.session = googleSession
    const { result } = await renderStore()
    await waitFor(() => expect(result.current.user?.introduction).toBe('지울 소개'))

    await act(async () => {
      await result.current.updateUser({ introduction: null })
    })

    expect(result.current.user?.introduction).toBeNull()
    expect(dbMock.upsert).toHaveBeenCalledWith(
      { user_id: 'uid-123', name: '별명', image: null, introduction: null },
      { onConflict: 'user_id' },
    )
  })

  test('introduction 없는 patch(별명만 저장)는 기존 자기소개를 유지한다 (FR-014)', async () => {
    dbMock.state.profiles['uid-123'] = {
      name: '별명',
      image: null,
      introduction: '기존 소개',
    }
    authMock.state.session = googleSession
    const { result } = await renderStore()
    await waitFor(() => expect(result.current.user?.introduction).toBe('기존 소개'))

    await act(async () => {
      await result.current.updateUser({ nickname: '새별명' })
    })

    expect(result.current.user?.introduction).toBe('기존 소개')
    expect(dbMock.upsert).toHaveBeenCalledWith(
      { user_id: 'uid-123', name: '새별명', image: null, introduction: '기존 소개' },
      { onConflict: 'user_id' },
    )
  })
})

describe('프로필 조회 상태 (profileStatus / retryProfile)', () => {
  test('로그인 전에는 profileStatus가 loading이다', async () => {
    const { result } = await renderStore()

    expect(result.current.profileStatus).toBe('loading')
  })

  test('조회가 성공하면 ready가 된다 (행 부재도 성공)', async () => {
    authMock.state.session = googleSession

    const { result } = await renderStore()

    await waitFor(() => expect(result.current.profileStatus).toBe('ready'))
  })

  test('조회가 실패하면 error가 된다 — 오류를 버리지 않는다 (FR-019)', async () => {
    dbMock.state.selectError = { message: 'network down' }
    authMock.state.session = googleSession

    const { result } = await renderStore()

    await waitFor(() => expect(result.current.profileStatus).toBe('error'))
  })

  test('로그아웃하면 loading으로 리셋된다', async () => {
    authMock.state.session = googleSession
    const { result } = await renderStore()
    await waitFor(() => expect(result.current.profileStatus).toBe('ready'))

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.profileStatus).toBe('loading')
  })

  test('retryProfile은 재조회해서 성공 시 ready와 DB 값을 반영한다 (FR-021)', async () => {
    dbMock.state.selectError = { message: 'network down' }
    dbMock.state.profiles['uid-123'] = {
      name: '복구별명',
      image: null,
      introduction: '복구된 소개',
    }
    authMock.state.session = googleSession
    const { result } = await renderStore()
    await waitFor(() => expect(result.current.profileStatus).toBe('error'))

    dbMock.state.selectError = null
    act(() => {
      result.current.retryProfile()
    })

    await waitFor(() => expect(result.current.profileStatus).toBe('ready'))
    expect(result.current.user?.nickname).toBe('복구별명')
    expect(result.current.user?.introduction).toBe('복구된 소개')
  })

  test('조회 실패 상태에서는 updateUser가 upsert 없이 오류를 반환한다 (FR-020)', async () => {
    dbMock.state.selectError = { message: 'network down' }
    dbMock.state.profiles['uid-123'] = {
      name: '보호될별명',
      image: null,
      introduction: '보호될 소개',
    }
    authMock.state.session = googleSession
    const { result } = await renderStore()
    await waitFor(() => expect(result.current.profileStatus).toBe('error'))

    let error: string | null = null
    await act(async () => {
      ;({ error } = await result.current.updateUser({ introduction: '덮어쓰기 시도' }))
    })

    expect(error).not.toBeNull()
    expect(dbMock.upsert).not.toHaveBeenCalled()
    expect(dbMock.state.profiles['uid-123'].introduction).toBe('보호될 소개')
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
      introduction: null,
    })
    expect(authMock.signOut).toHaveBeenCalled()
  })

  test('resetAll의 초기화 upsert는 자기소개도 null로 지운다 (FR-015)', async () => {
    dbMock.state.profiles['uid-123'] = {
      name: '별명',
      image: null,
      introduction: '남아 있으면 안 되는 소개',
    }
    authMock.state.session = googleSession
    const { result } = await renderStore()
    await waitFor(() => expect(result.current.profileStatus).toBe('ready'))

    await act(async () => {
      await result.current.resetAll()
    })

    expect(dbMock.upsert).toHaveBeenCalledWith(
      {
        user_id: 'uid-123',
        name: '김구글',
        image: 'https://lh3.googleusercontent.com/a/photo.jpg',
        introduction: null,
      },
      { onConflict: 'user_id' },
    )
    expect(dbMock.state.profiles['uid-123'].introduction).toBeNull()
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
