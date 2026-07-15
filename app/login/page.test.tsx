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
