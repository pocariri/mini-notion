import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

// /me는 실제 StoreProvider를 그대로 쓰고 lib/supabase.ts 싱글턴 경계만 모킹한다.
const authMock = vi.hoisted(() => {
  const state = { session: null as unknown }
  return {
    state,
    signOut: vi.fn(async () => ({ error: null })),
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: authMock.state.session } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      signInWithOAuth: vi.fn(async () => ({ data: {}, error: null })),
      signOut: authMock.signOut,
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
          order: async () => ({ data: [], error: null }),
        }),
      }),
      upsert: vi.fn(async () => ({ error: null })),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  },
}))

import { StoreProvider } from '@/lib/store'
import MePage from './page'

const googleSession = {
  user: {
    id: 'uid-1',
    email: 'tester@gmail.com',
    user_metadata: { full_name: '테스터' },
  },
}

async function renderMe() {
  authMock.state.session = googleSession
  const utils = render(
    <StoreProvider>
      <MePage />
    </StoreProvider>,
  )
  // splash(ready 게이트)가 걷히고 레일이 페인트될 때까지 대기
  const toggle = await screen.findByRole('button', { name: '사이드바 접기/펼치기' })
  return { ...utils, toggle }
}

beforeEach(() => {
  authMock.state.session = null
  routerMock.replace.mockClear()
})

describe('마이 페이지 설정 레일 접기 (FR-008: 화면 간 일관)', () => {
  test('설정 레일에도 토글 버튼이 렌더된다', async () => {
    const { toggle } = await renderMe()

    expect(toggle).toBeInTheDocument()
  })

  test('토글 클릭 시 레일이 접히고 재클릭 시 펼쳐진다', async () => {
    const user = userEvent.setup()
    const { toggle, container } = await renderMe()
    const rail = container.querySelector('aside.rail')

    await user.click(toggle)
    expect(rail).toHaveClass('collapsed')

    await user.click(toggle)
    expect(rail).not.toHaveClass('collapsed')
  })

  test('접힘 상태에서도 설정 내비 버튼이 접근 가능한 이름을 유지한다 (FR-014)', async () => {
    const user = userEvent.setup()
    const { toggle } = await renderMe()

    await user.click(toggle)

    expect(screen.getByRole('button', { name: '프로필' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '계정' })).toBeInTheDocument()
  })

  test('저장된 접힘 상태(true)면 처음부터 접힌 채 페인트된다 (FR-006·016)', async () => {
    localStorage.setItem('mini-notion:sidebar-collapsed', 'true')

    const { container } = await renderMe()

    expect(container.querySelector('aside.rail')).toHaveClass('collapsed')
  })

  test('토글이 aria-expanded로 상태를 노출하고 아이콘 조작부가 data-tip을 가진다 (FR-010·014)', async () => {
    localStorage.setItem('mini-notion:sidebar-collapsed', 'true')

    const { toggle } = await renderMe()

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveAttribute('data-tip', '사이드바 접기/펼치기')
    expect(screen.getByRole('button', { name: '프로필' })).toHaveAttribute(
      'data-tip',
      '프로필',
    )
    expect(screen.getByRole('button', { name: '계정' })).toHaveAttribute(
      'data-tip',
      '계정',
    )
    expect(screen.getByRole('link', { name: '업무로 돌아가기' })).toHaveAttribute(
      'data-tip',
      '업무로 돌아가기',
    )
  })
})
