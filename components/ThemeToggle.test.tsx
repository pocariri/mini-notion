import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'

// 스토어의 Supabase 경계만 최소로 대체한다 (login/page.test.tsx와 동일 패턴).
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      signInWithOAuth: vi.fn(async () => ({ data: {}, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  },
}))

import { StoreProvider } from '@/lib/store'
import ThemeToggle from './ThemeToggle'

function renderToggle(children: ReactNode = <ThemeToggle />) {
  return render(<StoreProvider>{children}</StoreProvider>)
}

describe('ThemeToggle', () => {
  test('라이트일 때 "다크 모드" 라벨의 switch로 렌더되고 aria-checked=false다', async () => {
    renderToggle()

    const toggle = await screen.findByRole('switch', { name: '다크 모드' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  test('클릭하면 data-theme가 dark로 바뀌고 라벨이 "라이트 모드"로 갱신된다', async () => {
    renderToggle()

    await userEvent.click(await screen.findByRole('switch', { name: '다크 모드' }))

    expect(document.documentElement.dataset.theme).toBe('dark')
    const toggle = screen.getByRole('switch', { name: '라이트 모드' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  test('다시 클릭하면 라이트로 되돌아온다', async () => {
    renderToggle()

    await userEvent.click(await screen.findByRole('switch', { name: '다크 모드' }))
    await userEvent.click(screen.getByRole('switch', { name: '라이트 모드' }))

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(screen.getByRole('switch', { name: '다크 모드' })).toBeInTheDocument()
  })

  test('두 개를 렌더해도(두 레일 상황) 하나를 클릭하면 둘 다 같은 상태를 표시한다', async () => {
    renderToggle(
      <>
        <ThemeToggle />
        <ThemeToggle />
      </>,
    )

    const [first] = await screen.findAllByRole('switch', { name: '다크 모드' })
    await userEvent.click(first)

    expect(screen.getAllByRole('switch', { name: '라이트 모드' })).toHaveLength(2)
    expect(screen.queryByRole('switch', { name: '다크 모드' })).toBeNull()
  })

  test('키보드만으로 도달해 Enter로 전환할 수 있다', async () => {
    renderToggle()
    await screen.findByRole('switch', { name: '다크 모드' })

    await userEvent.tab()
    expect(screen.getByRole('switch', { name: '다크 모드' })).toHaveFocus()

    await userEvent.keyboard('{Enter}')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
