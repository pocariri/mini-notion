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

// Supabase 테이블들의 in-memory 대역.
//   public.profile — uid와 1:1. upsert가 행을 덮어쓰고 select().eq().maybeSingle()이 돌려준다.
//   public.page    — 실제 칼럼(id, created_at, title, content, user_id)을 그대로 반영한다.
//                    title/content는 실제와 같이 NULL을 허용한다.
//
// 주의: 이 대역은 RLS를 검증하지 못한다. 소유자 격리가 실제로 성립하는지는
// 실제 DB에 대해서만 확인할 수 있다(quickstart.md B). 여기서 user_id로 거르는 것은
// 실제 서버가 남의 행을 주지 않는다는 사실을 흉내 내는 것일 뿐, 그 사실의 증거가 아니다.
const dbMock = vi.hoisted(() => {
  type PageRow = {
    id: string
    created_at: string
    title: string | null
    content: string | null
    user_id: string
  }
  const state = {
    profiles: {} as Record<string, { name: string | null; image: string | null }>,
    upsertError: null as { message: string } | null,
    pages: [] as PageRow[],
    selectError: null as { message: string } | null,
    insertError: null as { message: string } | null,
    updateError: null as { message: string } | null,
    deleteError: null as { message: string } | null,
    // 완료를 테스트가 직접 풀어 주도록 만들어 응답 역전을 재현하는 훅.
    // 키는 페이지 id, 값은 그 저장을 완료시키는 함수.
    gateUpdates: false,
    pendingUpdates: [] as Array<() => void>,
  }

  const upsert = vi.fn(
    async (row: { user_id: string; name: string | null; image: string | null }) => {
      if (state.upsertError) return { error: state.upsertError }
      state.profiles[row.user_id] = { name: row.name, image: row.image }
      return { error: null }
    },
  )

  const insert = vi.fn()
  const update = vi.fn()
  const remove = vi.fn()

  function pageTable() {
    return {
      select: () => {
        const filters: { user_id?: string; id?: string } = {}
        let ascending = true
        const builder = {
          eq(col: 'user_id' | 'id', val: string) {
            filters[col] = val
            return builder
          },
          order(_col: string, opts?: { ascending?: boolean }) {
            ascending = opts?.ascending ?? true
            return builder
          },
          then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
            const run = async () => {
              if (state.selectError) return { data: null, error: state.selectError }
              const rows = state.pages
                .filter(
                  (r) =>
                    (filters.user_id === undefined || r.user_id === filters.user_id) &&
                    (filters.id === undefined || r.id === filters.id),
                )
                .sort((a, b) =>
                  ascending
                    ? a.created_at.localeCompare(b.created_at)
                    : b.created_at.localeCompare(a.created_at),
                )
              return { data: rows.map((r) => ({ ...r })), error: null }
            }
            return run().then(resolve, reject)
          },
        }
        return builder
      },

      insert: (row: Omit<PageRow, 'created_at'> & { created_at?: string }) => {
        insert(row)
        const run = async () => {
          if (state.insertError) return { data: null, error: state.insertError }
          // 실제 DB는 created_at에 now() 기본값을 채운다. 대역도 그 동작을 그대로 반영한다.
          const stored: PageRow = {
            created_at: new Date().toISOString(),
            ...row,
          }
          state.pages.push(stored)
          return { data: { ...stored }, error: null }
        }
        return {
          select: () => ({ single: run }),
          then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
            run().then(resolve, reject),
        }
      },

      update: (patch: Partial<PageRow>) => {
        update(patch)
        const builder = {
          eq(_col: string, id: string) {
            const run = async () => {
              if (state.gateUpdates) {
                await new Promise<void>((r) => state.pendingUpdates.push(r))
              }
              if (state.updateError) return { error: state.updateError }
              const row = state.pages.find((r) => r.id === id)
              if (row) Object.assign(row, patch)
              return { error: null }
            }
            return {
              then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
                run().then(resolve, reject),
            }
          },
        }
        return builder
      },

      delete: () => {
        remove()
        return {
          // 실제와 같이 어떤 칼럼으로도 거를 수 있어야 한다.
          // (id로 한 건 삭제, user_id로 계정의 전체 삭제 둘 다 쓰인다)
          eq(col: 'id' | 'user_id', val: string) {
            const run = async () => {
              if (state.deleteError) return { error: state.deleteError }
              state.pages = state.pages.filter((r) => r[col] !== val)
              return { error: null }
            }
            return {
              then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
                run().then(resolve, reject),
            }
          },
        }
      },
    }
  }

  function profileTable() {
    return {
      select: () => ({
        eq: (_col: string, uid: string) => ({
          maybeSingle: async () => ({
            data: state.profiles[uid] ?? null,
            error: null,
          }),
        }),
      }),
      upsert,
    }
  }

  return {
    state,
    upsert,
    insert,
    update,
    remove,
    // 대기 중인 저장을 원하는 순서로 완료시켜 응답 역전을 재현한다.
    releaseUpdate(index = 0) {
      const [fn] = state.pendingUpdates.splice(index, 1)
      fn?.()
    },
    from(table: string) {
      return table === 'page' ? pageTable() : profileTable()
    },
    reset() {
      state.profiles = {}
      state.upsertError = null
      state.pages = []
      state.selectError = null
      state.insertError = null
      state.updateError = null
      state.deleteError = null
      state.gateUpdates = false
      state.pendingUpdates = []
    },
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
    from: (table: string) => dbMock.from(table),
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
  dbMock.reset()
  dbMock.upsert.mockClear()
  dbMock.insert.mockClear()
  dbMock.update.mockClear()
  dbMock.remove.mockClear()
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

describe('첫 로그인 (FR-014)', () => {
  test('예시 페이지를 만들지 않고 빈 목록에서 시작한다', async () => {
    const { result } = await renderStore()

    act(() => {
      authMock.fire('SIGNED_IN', googleSession)
    })

    await waitFor(() => expect(result.current.pagesStatus).toBe('ready'))
    expect(result.current.pages).toHaveLength(0)
    expect(dbMock.state.pages).toHaveLength(0)
  })

  test('초기화 시 레거시 mini-notion:posts 키를 제거하고 그 내용을 쓰지 않는다', async () => {
    localStorage.setItem(
      'mini-notion:posts',
      JSON.stringify([{ id: 'old-1', title: '옛 글', content: '', createdAt: 1 }]),
    )
    authMock.state.session = googleSession

    const { result } = await renderStore()

    await waitFor(() => expect(result.current.pagesStatus).toBe('ready'))
    expect(localStorage.getItem('mini-notion:posts')).toBeNull()
    expect(result.current.pages).toHaveLength(0)
  })
})

describe('resetAll', () => {
  test('서버의 페이지를 지우고 프로필을 Google 기본값으로 되돌린 뒤 signOut한다', async () => {
    authMock.state.session = googleSession
    const { result } = await renderStore()
    await waitFor(() => expect(result.current.pagesStatus).toBe('ready'))
    await act(async () => {
      await result.current.createPage('지울 글')
    })
    expect(dbMock.state.pages).toHaveLength(1)
    await act(async () => {
      await result.current.updateUser({ nickname: '지울별명' })
    })

    await act(async () => {
      await result.current.resetAll()
    })

    expect(result.current.pages).toHaveLength(0)
    // 로컬 상태만 비우면 재로그인 시 되살아난다. 서버에서도 지워져야 한다.
    expect(dbMock.state.pages).toHaveLength(0)
    expect(result.current.user).toBeNull()
    expect(dbMock.state.profiles['uid-123']).toEqual({
      name: '김구글',
      image: 'https://lh3.googleusercontent.com/a/photo.jpg',
    })
    expect(authMock.signOut).toHaveBeenCalled()
  })
})

// 서버에 이미 행이 있는 상태로 로그인시키는 헬퍼.
function seedServerPage(overrides: Partial<{
  id: string
  created_at: string
  title: string | null
  content: string | null
  user_id: string
}> = {}) {
  const row = {
    id: 'srv-1',
    created_at: '2026-07-10T00:00:00.000Z',
    title: '서버 글',
    content: '서버 내용',
    user_id: 'uid-123',
    ...overrides,
  }
  dbMock.state.pages.push(row)
  return row
}

async function renderSignedIn() {
  authMock.state.session = googleSession
  const utils = await renderStore()
  await waitFor(() => expect(utils.result.current.pagesStatus).toBe('ready'))
  return utils
}

describe('페이지 목록 로드 (US1: FR-001, FR-011, FR-020)', () => {
  test('로그인하면 서버의 페이지를 불러온다', async () => {
    seedServerPage({ id: 'srv-1', title: '내 서버 글' })

    const { result } = await renderSignedIn()

    expect(result.current.pages).toHaveLength(1)
    expect(result.current.pages[0]).toMatchObject({
      id: 'srv-1',
      title: '내 서버 글',
      content: '서버 내용',
    })
  })

  test('created_at 내림차순(최신 먼저)으로 정렬한다', async () => {
    seedServerPage({ id: 'old', created_at: '2026-07-01T00:00:00.000Z' })
    seedServerPage({ id: 'new', created_at: '2026-07-15T00:00:00.000Z' })
    seedServerPage({ id: 'mid', created_at: '2026-07-08T00:00:00.000Z' })

    const { result } = await renderSignedIn()

    expect(result.current.pages.map((p) => p.id)).toEqual(['new', 'mid', 'old'])
  })

  test('DB의 NULL title/content를 빈 문자열로 정규화한다', async () => {
    seedServerPage({ title: null, content: null })

    const { result } = await renderSignedIn()

    expect(result.current.pages[0].title).toBe('')
    expect(result.current.pages[0].content).toBe('')
  })

  test('created_at(timestamptz)을 epoch ms로 변환한다', async () => {
    seedServerPage({ created_at: '2026-07-10T00:00:00.000Z' })

    const { result } = await renderSignedIn()

    expect(result.current.pages[0].createdAt).toBe(Date.parse('2026-07-10T00:00:00.000Z'))
  })

  test('pagesStatus가 loading에서 시작해 ready로 전이한다', async () => {
    authMock.state.session = googleSession
    // renderStore()는 ready를 기다리므로 초기 상태를 볼 수 없다. 직접 렌더한다.
    const { result } = renderHook(() => useStore(), { wrapper })

    expect(result.current.pagesStatus).toBe('loading')
    await waitFor(() => expect(result.current.pagesStatus).toBe('ready'))
  })
})

describe('로딩·빈·실패 구분 (US1: FR-021, SC-009)', () => {
  test('불러오는 중에는 페이지가 0건이어도 ready가 아니다', async () => {
    seedServerPage()
    authMock.state.session = googleSession
    const { result } = renderHook(() => useStore(), { wrapper })

    // 서버에 페이지가 있는데도 아직 도착 전이라 목록은 비어 있다.
    // 이때 "페이지 없음"으로 단정하면 사용자는 글이 사라진 줄 안다.
    expect(result.current.pages).toHaveLength(0)
    expect(result.current.pagesStatus).toBe('loading')

    await waitFor(() => expect(result.current.pagesStatus).toBe('ready'))
    expect(result.current.pages).toHaveLength(1)
  })

  test('로드 실패 시 pagesStatus가 error가 되어 빈 목록과 구분된다', async () => {
    dbMock.state.selectError = { message: 'network down' }
    authMock.state.session = googleSession

    const { result } = await renderStore()

    await waitFor(() => expect(result.current.pagesStatus).toBe('error'))
    expect(result.current.pages).toHaveLength(0)
  })
})

describe('페이지 생성 (US1: FR-018, FR-022, FR-023)', () => {
  test('createPage는 서버 응답 전에 목록 맨 앞에 추가하고 id를 반환한다', async () => {
    const { result } = await renderSignedIn()

    let id: string | null = null
    await act(async () => {
      id = await result.current.createPage('제목', '내용')
    })

    expect(id).toBeTruthy()
    expect(result.current.pages[0]).toMatchObject({
      id,
      title: '제목',
      content: '내용',
    })
  })

  test('생성한 페이지를 소유자와 함께 서버에 저장한다', async () => {
    const { result } = await renderSignedIn()

    await act(async () => {
      await result.current.createPage('서버로', '간다')
    })

    expect(dbMock.state.pages).toHaveLength(1)
    expect(dbMock.state.pages[0]).toMatchObject({
      title: '서버로',
      content: '간다',
      user_id: 'uid-123',
    })
  })

  test('insert 실패 시 그 페이지를 목록에서 제거하고 notice를 남긴다', async () => {
    dbMock.state.insertError = { message: 'insert failed' }
    const { result } = await renderSignedIn()

    await act(async () => {
      await result.current.createPage('실패할 글')
    })

    expect(result.current.pages).toHaveLength(0)
    expect(result.current.notice).toBeTruthy()
  })
})

describe('자동 저장 디바운스 (US1: FR-016, FR-017, SC-010)', () => {
  test('연속 입력은 800ms 후 한 번의 저장으로 합쳐진다', async () => {
    vi.useFakeTimers()
    try {
      seedServerPage({ id: 'p1', title: '', content: '' })
      authMock.state.session = googleSession
      const utils = renderHook(() => useStore(), { wrapper })
      await vi.waitFor(() => expect(utils.result.current.pagesStatus).toBe('ready'))

      act(() => {
        utils.result.current.updatePage('p1', { content: 'a' })
        utils.result.current.updatePage('p1', { content: 'ab' })
        utils.result.current.updatePage('p1', { content: 'abc' })
      })

      // 아직 지연 시간이 지나지 않아 저장이 일어나선 안 된다.
      expect(dbMock.update).not.toHaveBeenCalled()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(800)
      })

      expect(dbMock.update).toHaveBeenCalledTimes(1)
      expect(dbMock.update).toHaveBeenCalledWith({ content: 'abc' })
    } finally {
      vi.useRealTimers()
    }
  })

  test('flushPending은 지연을 기다리지 않고 즉시 저장한다', async () => {
    vi.useFakeTimers()
    try {
      seedServerPage({ id: 'p1' })
      authMock.state.session = googleSession
      const utils = renderHook(() => useStore(), { wrapper })
      await vi.waitFor(() => expect(utils.result.current.pagesStatus).toBe('ready'))

      act(() => {
        utils.result.current.updatePage('p1', { title: '급한 저장' })
      })
      expect(dbMock.update).not.toHaveBeenCalled()

      await act(async () => {
        await utils.result.current.flushPending()
      })

      expect(dbMock.update).toHaveBeenCalledWith({ title: '급한 저장' })
    } finally {
      vi.useRealTimers()
    }
  })

  test('저장 실패해도 입력한 내용을 되돌리지 않는다 (FR-024)', async () => {
    vi.useFakeTimers()
    try {
      seedServerPage({ id: 'p1', content: '원본' })
      dbMock.state.updateError = { message: 'save failed' }
      authMock.state.session = googleSession
      const utils = renderHook(() => useStore(), { wrapper })
      await vi.waitFor(() => expect(utils.result.current.pagesStatus).toBe('ready'))

      act(() => {
        utils.result.current.updatePage('p1', { content: '사용자가 힘들게 쓴 글' })
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(800)
      })

      // 입력 내용은 그대로 남아야 한다. 되돌리면 사용자가 쓴 글이 사라진다.
      expect(utils.result.current.pages[0].content).toBe('사용자가 힘들게 쓴 글')
      expect(utils.result.current.saveStatus).toBe('error')
    } finally {
      vi.useRealTimers()
    }
  })

  test('저장 응답이 역순으로 도착해도 마지막 입력이 최종 상태다 (R5)', async () => {
    vi.useFakeTimers()
    try {
      seedServerPage({ id: 'p1', content: '' })
      dbMock.state.gateUpdates = true
      authMock.state.session = googleSession
      const utils = renderHook(() => useStore(), { wrapper })
      await vi.waitFor(() => expect(utils.result.current.pagesStatus).toBe('ready'))

      act(() => {
        utils.result.current.updatePage('p1', { content: '첫 번째' })
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(800)
      })

      act(() => {
        utils.result.current.updatePage('p1', { content: '두 번째' })
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(800)
      })

      // 대기 중인 저장을 항상 "나중 것부터" 풀어 응답이 뒤집혀 도착하는 상황을 만든다.
      // 큐가 빌 때까지 반복해 후속 저장까지 모두 정착시킨다.
      await act(async () => {
        while (dbMock.state.pendingUpdates.length > 0) {
          dbMock.releaseUpdate(dbMock.state.pendingUpdates.length - 1)
          await vi.runAllTimersAsync()
        }
      })

      // 어떤 순서로 응답이 오든 서버의 최종 상태는 사용자가 마지막에 친 값이어야 한다.
      expect(dbMock.state.pages[0].content).toBe('두 번째')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('소유자 격리 — 클라이언트 몫 (US2: FR-010, SC-003)', () => {
  // 격리 자체는 DB의 RLS 정책이 강제한다. 이 대역으로는 그걸 검증할 수 없다.
  // 여기서 지키는 건 "이전 사용자의 페이지가 화면에 남지 않는다"는 클라이언트의 몫뿐이다.
  test('로그아웃하면 목록이 비워진다', async () => {
    seedServerPage()
    const { result } = await renderSignedIn()
    expect(result.current.pages).toHaveLength(1)

    await act(async () => {
      await result.current.logout()
    })

    await waitFor(() => expect(result.current.pages).toHaveLength(0))
  })

  test('계정이 바뀌면 이전 계정의 목록을 즉시 버리고 새 계정의 것을 불러온다', async () => {
    seedServerPage({ id: 'a-1', title: 'A의 글', user_id: 'uid-123' })
    seedServerPage({ id: 'b-1', title: 'B의 글', user_id: 'uid-999' })
    const { result } = await renderSignedIn()
    expect(result.current.pages.map((p) => p.id)).toEqual(['a-1'])

    act(() => {
      authMock.fire('SIGNED_IN', {
        user: { id: 'uid-999', email: 'b@gmail.com', user_metadata: {} },
      })
    })

    // 새 목록이 도착하기 전에 A의 글이 한 프레임이라도 남아 있으면 안 된다.
    // B는 A의 글을 볼 자격이 없고, 잠깐이라도 보이면 그것이 곧 유출이다.
    expect(result.current.pages).toHaveLength(0)

    await waitFor(() => expect(result.current.pages.map((p) => p.id)).toEqual(['b-1']))
  })
})

describe('로그인해야 페이지를 쓸 수 있다 (US3: FR-002, FR-003)', () => {
  test('비로그인 상태에서는 createPage가 아무것도 만들지 않고 null을 반환한다', async () => {
    const { result } = await renderStore()
    expect(result.current.user).toBeNull()

    let id: string | null = 'not-null'
    await act(async () => {
      id = await result.current.createPage('몰래 쓰기')
    })

    expect(id).toBeNull()
    expect(result.current.pages).toHaveLength(0)
    expect(dbMock.state.pages).toHaveLength(0)
    expect(dbMock.insert).not.toHaveBeenCalled()
  })

  test('생성된 페이지의 소유자는 현재 세션 사용자다', async () => {
    const { result } = await renderSignedIn()

    await act(async () => {
      await result.current.createPage('내 글')
    })

    expect(dbMock.state.pages[0].user_id).toBe('uid-123')
  })

  test('세션이 사라진 뒤의 수정은 서버로 보내지 않는다', async () => {
    vi.useFakeTimers()
    try {
      seedServerPage({ id: 'p1' })
      authMock.state.session = googleSession
      const utils = renderHook(() => useStore(), { wrapper })
      await vi.waitFor(() => expect(utils.result.current.pagesStatus).toBe('ready'))

      await act(async () => {
        authMock.fire('SIGNED_OUT', null)
      })
      act(() => {
        utils.result.current.updatePage('p1', { title: '세션 만료 후' })
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(800)
      })

      expect(dbMock.update).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('내 페이지만 삭제 (US4: FR-005, FR-022, FR-023)', () => {
  test('deletePage는 서버 응답 전에 목록에서 제거한다', async () => {
    seedServerPage({ id: 'p1' })
    const { result } = await renderSignedIn()

    await act(async () => {
      await result.current.deletePage('p1')
    })

    expect(result.current.pages).toHaveLength(0)
    expect(dbMock.state.pages).toHaveLength(0)
  })

  test('삭제 실패 시 원래 자리에 복원하고 notice를 남긴다', async () => {
    seedServerPage({ id: 'first', created_at: '2026-07-15T00:00:00.000Z' })
    seedServerPage({ id: 'target', created_at: '2026-07-10T00:00:00.000Z' })
    seedServerPage({ id: 'last', created_at: '2026-07-05T00:00:00.000Z' })
    const { result } = await renderSignedIn()
    expect(result.current.pages.map((p) => p.id)).toEqual(['first', 'target', 'last'])

    dbMock.state.deleteError = { message: 'delete failed' }
    await act(async () => {
      await result.current.deletePage('target')
    })

    // 사라졌다가 원래 순서 그대로 돌아와야 한다. 끝에 붙으면 사용자가 혼란스럽다.
    expect(result.current.pages.map((p) => p.id)).toEqual(['first', 'target', 'last'])
    expect(result.current.notice).toBeTruthy()
    expect(dbMock.state.pages).toHaveLength(3)
  })

  test('스토어는 삭제 확인을 묻지 않는다 — 확인은 호출자의 몫이다', async () => {
    seedServerPage({ id: 'p1' })
    const confirmSpy = vi.spyOn(window, 'confirm')
    const { result } = await renderSignedIn()

    await act(async () => {
      await result.current.deletePage('p1')
    })

    // 스토어가 확인을 물으면 discardIfEmpty가 확인 없이 지울 수 없게 된다.
    expect(confirmSpy).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  test('빈 페이지 자동 삭제는 notice를 띄우지 않는다', async () => {
    const { result } = await renderSignedIn()
    let id = ''
    await act(async () => {
      id = (await result.current.createPage()) ?? ''
    })

    dbMock.state.deleteError = { message: 'nope' }
    await act(async () => {
      await result.current.discardIfEmpty(id)
    })

    // 사용자가 요청한 적 없는 정리 작업이므로 실패를 알릴 이유가 없다.
    expect(result.current.notice).toBeNull()
  })
})

describe('빈 페이지 자동 삭제 (US1: FR-019)', () => {
  test('제목·내용이 모두 비면 이탈 시 삭제한다', async () => {
    const { result } = await renderSignedIn()

    let id = ''
    await act(async () => {
      id = (await result.current.createPage()) ?? ''
    })
    expect(dbMock.state.pages).toHaveLength(1)

    await act(async () => {
      await result.current.discardIfEmpty(id)
    })

    expect(result.current.pages).toHaveLength(0)
    expect(dbMock.state.pages).toHaveLength(0)
  })

  test('제목만 있어도 삭제하지 않는다', async () => {
    const { result } = await renderSignedIn()

    let id = ''
    await act(async () => {
      id = (await result.current.createPage('제목 있음')) ?? ''
    })

    await act(async () => {
      await result.current.discardIfEmpty(id)
    })

    expect(result.current.pages).toHaveLength(1)
    expect(dbMock.state.pages).toHaveLength(1)
  })

  test('내용만 있어도 삭제하지 않는다', async () => {
    const { result } = await renderSignedIn()

    let id = ''
    await act(async () => {
      id = (await result.current.createPage('', '내용 있음')) ?? ''
    })

    await act(async () => {
      await result.current.discardIfEmpty(id)
    })

    expect(result.current.pages).toHaveLength(1)
  })
})
