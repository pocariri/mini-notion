import { describe, test, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
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

// 로그인된 Google 세션과 public.profile 행의 대역.
// 조회는 실제 네트워크처럼 다음 매크로태스크에 응답한다 — 폼 하이드레이션이
// 프로필 도착을 기다리는지(FR-008) 검증하려면 이 지연이 필수다.
const supaMock = vi.hoisted(() => {
  const googleSession = {
    user: {
      id: 'uid-123',
      email: 'real@gmail.com',
      user_metadata: { full_name: '김구글', avatar_url: null },
    },
  }
  const state = {
    profiles: {} as Record<
      string,
      { name: string | null; image: string | null; introduction: string | null }
    >,
    selectError: null as { message: string } | null,
    upsertError: null as { message: string } | null,
  }
  const upsert = vi.fn(
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
  )
  return { googleSession, state, upsert }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: supaMock.googleSession } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: () => ({
      select: () => ({
        eq: (_col: string, uid: string) => ({
          maybeSingle: async () => {
            await new Promise((resolve) => setTimeout(resolve, 0))
            if (supaMock.state.selectError)
              return { data: null, error: supaMock.state.selectError }
            return { data: supaMock.state.profiles[uid] ?? null, error: null }
          },
          // 페이지 목록 조회(from('page')...order) — /me 테스트에서는 빈 목록이면 충분하다.
          order: async () => ({ data: [], error: null }),
        }),
      }),
      upsert: supaMock.upsert,
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  },
}))

import { StoreProvider } from '@/lib/store'
import MePage from './page'

function renderMe() {
  return render(
    <StoreProvider>
      <MePage />
    </StoreProvider>,
  )
}

// splash(ready 게이트)가 걷히고 레일이 페인트될 때까지 대기한 뒤 접기 토글을 돌려준다.
async function findRailToggle() {
  return await screen.findByRole('button', { name: '사이드바 접기/펼치기' })
}

// 폼이 하이드레이션(프로필 반영)까지 끝난 뒤의 입력란을 돌려준다.
// 하이드레이션 전에 상호작용하면 뒤늦게 도착한 초기값이 입력을 덮어써 테스트가 경쟁한다.
async function openForm(expectedNickname: string) {
  const nickname = await screen.findByRole('textbox', { name: '별명' })
  await waitFor(() => expect(nickname).toHaveValue(expectedNickname))
  const intro = screen.getByRole('textbox', { name: '자기소개' })
  return { nickname, intro }
}

beforeEach(() => {
  routerMock.replace.mockClear()
  supaMock.state.profiles = {}
  supaMock.state.selectError = null
  supaMock.state.upsertError = null
  supaMock.upsert.mockClear()
  localStorage.clear()
})

describe('마이 페이지 설정 레일 접기 (FR-008: 화면 간 일관)', () => {
  test('설정 레일에도 토글 버튼이 렌더된다', async () => {
    renderMe()

    expect(await findRailToggle()).toBeInTheDocument()
  })

  test('토글 클릭 시 레일이 접히고 재클릭 시 펼쳐진다', async () => {
    const user = userEvent.setup()
    const { container } = renderMe()
    const toggle = await findRailToggle()
    const rail = container.querySelector('aside.rail')

    await user.click(toggle)
    expect(rail).toHaveClass('collapsed')

    await user.click(toggle)
    expect(rail).not.toHaveClass('collapsed')
  })

  test('접힘 상태에서도 설정 내비 버튼이 접근 가능한 이름을 유지한다 (FR-014)', async () => {
    const user = userEvent.setup()
    renderMe()
    const toggle = await findRailToggle()

    await user.click(toggle)

    expect(screen.getByRole('button', { name: '프로필' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '계정' })).toBeInTheDocument()
  })

  test('저장된 접힘 상태(true)면 처음부터 접힌 채 페인트된다 (FR-006·016)', async () => {
    localStorage.setItem('mini-notion:sidebar-collapsed', 'true')

    const { container } = renderMe()
    await findRailToggle()

    expect(container.querySelector('aside.rail')).toHaveClass('collapsed')
  })

  test('토글이 aria-expanded로 상태를 노출하고 아이콘 조작부가 data-tip을 가진다 (FR-010·014)', async () => {
    localStorage.setItem('mini-notion:sidebar-collapsed', 'true')

    renderMe()
    const toggle = await findRailToggle()

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

describe('자기소개 등록·조회 (US1)', () => {
  test('자기소개 textarea가 별명 필드와 함께 표시된다 (FR-001·002)', async () => {
    renderMe()

    const intro = await screen.findByRole('textbox', { name: '자기소개' })
    expect(intro.tagName).toBe('TEXTAREA')
    expect(intro).toHaveAttribute('maxlength', '150')
    expect(intro).toHaveAttribute('rows', '3')
    expect(intro).toHaveAttribute('placeholder', '자신을 간단히 소개해 보세요.')
    expect(screen.getByRole('textbox', { name: '별명' })).toBeInTheDocument()
  })

  test('폼은 구글 기본값이 아니라 DB 프로필 값으로 채워진다 (FR-008, 하이드레이션 게이트)', async () => {
    supaMock.state.profiles['uid-123'] = {
      name: 'DB별명',
      image: null,
      introduction: 'DB에 저장된 소개',
    }

    renderMe()

    const { nickname, intro } = await openForm('DB별명')
    expect(nickname).toHaveValue('DB별명')
    expect(intro).toHaveValue('DB에 저장된 소개')
  })

  test('줄바꿈을 포함한 여러 줄 입력이 보존된다 (FR-002)', async () => {
    renderMe()

    const { intro } = await openForm('김구글')
    await userEvent.type(intro, '첫 줄{enter}둘째 줄')

    expect(intro).toHaveValue('첫 줄\n둘째 줄')
  })

  test('자기소개를 저장하면 trim된 값이 upsert되고 성공 안내가 보인다 (FR-006·010·011)', async () => {
    renderMe()

    const { intro } = await openForm('김구글')
    await userEvent.type(intro, '  반가워요. 포카리입니다.  ')
    await userEvent.click(screen.getByRole('button', { name: '변경 사항 저장' }))

    expect(await screen.findByText('저장되었습니다.')).toBeInTheDocument()
    expect(supaMock.upsert).toHaveBeenCalledWith(
      {
        user_id: 'uid-123',
        name: '김구글',
        image: null,
        introduction: '반가워요. 포카리입니다.',
      },
      { onConflict: 'user_id' },
    )
    // 저장 성공 시 입력란은 trim된 값으로 되메워진다
    expect(intro).toHaveValue('반가워요. 포카리입니다.')
  })
})

describe('자기소개 수정·비우기 (US2)', () => {
  test('기존 자기소개를 수정해 저장하면 새 값이 반영된다 (FR-005 수정)', async () => {
    supaMock.state.profiles['uid-123'] = {
      name: '별명이',
      image: null,
      introduction: '옛 소개',
    }
    renderMe()
    const { intro } = await openForm('별명이')
    expect(intro).toHaveValue('옛 소개')

    await userEvent.clear(intro)
    await userEvent.type(intro, '새 소개입니다')
    await userEvent.click(screen.getByRole('button', { name: '변경 사항 저장' }))

    expect(await screen.findByText('저장되었습니다.')).toBeInTheDocument()
    expect(supaMock.upsert).toHaveBeenCalledWith(
      { user_id: 'uid-123', name: '별명이', image: null, introduction: '새 소개입니다' },
      { onConflict: 'user_id' },
    )
    expect(intro).toHaveValue('새 소개입니다')
  })

  test('전부 지우고 저장하면 null로 저장되고 placeholder가 보인다 (FR-007)', async () => {
    supaMock.state.profiles['uid-123'] = {
      name: '별명이',
      image: null,
      introduction: '지울 소개',
    }
    renderMe()
    const { intro } = await openForm('별명이')
    expect(intro).toHaveValue('지울 소개')

    await userEvent.clear(intro)
    await userEvent.click(screen.getByRole('button', { name: '변경 사항 저장' }))

    expect(await screen.findByText('저장되었습니다.')).toBeInTheDocument()
    expect(supaMock.upsert).toHaveBeenCalledWith(
      { user_id: 'uid-123', name: '별명이', image: null, introduction: null },
      { onConflict: 'user_id' },
    )
    expect(intro).toHaveValue('')
    expect(screen.getByPlaceholderText('자신을 간단히 소개해 보세요.')).toBe(intro)
  })

  test('공백·줄바꿈만 입력하고 저장해도 null로 저장된다 (FR-006·007)', async () => {
    renderMe()
    const { intro } = await openForm('김구글')

    await userEvent.type(intro, '  {enter}   ')
    await userEvent.click(screen.getByRole('button', { name: '변경 사항 저장' }))

    expect(await screen.findByText('저장되었습니다.')).toBeInTheDocument()
    expect(supaMock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ introduction: null }),
      { onConflict: 'user_id' },
    )
    expect(intro).toHaveValue('')
  })

  test('자기소개만 변경해도 저장 버튼이 활성화된다 (FR-009)', async () => {
    renderMe()
    const { intro } = await openForm('김구글')
    const button = screen.getByRole('button', { name: '변경 사항 저장' })
    expect(button).toBeDisabled()

    await userEvent.type(intro, '한 줄')

    expect(button).toBeEnabled()
  })

  test('별명과 자기소개를 함께 고치면 한 번의 저장으로 모두 반영된다 (FR-010)', async () => {
    renderMe()
    const { nickname, intro } = await openForm('김구글')

    await userEvent.clear(nickname)
    await userEvent.type(nickname, '새별명')
    await userEvent.type(intro, '소개도 바꿈')
    await userEvent.click(screen.getByRole('button', { name: '변경 사항 저장' }))

    expect(await screen.findByText('저장되었습니다.')).toBeInTheDocument()
    expect(supaMock.upsert).toHaveBeenCalledTimes(1)
    expect(supaMock.upsert).toHaveBeenCalledWith(
      { user_id: 'uid-123', name: '새별명', image: null, introduction: '소개도 바꿈' },
      { onConflict: 'user_id' },
    )
  })

  test('별명만 수정해 저장하면 자기소개는 그대로 유지된다 (FR-014)', async () => {
    supaMock.state.profiles['uid-123'] = {
      name: '별명이',
      image: null,
      introduction: '기존 소개',
    }
    renderMe()
    const { nickname, intro } = await openForm('별명이')
    expect(intro).toHaveValue('기존 소개')

    await userEvent.clear(nickname)
    await userEvent.type(nickname, '새별명')
    await userEvent.click(screen.getByRole('button', { name: '변경 사항 저장' }))

    expect(await screen.findByText('저장되었습니다.')).toBeInTheDocument()
    expect(supaMock.upsert).toHaveBeenCalledWith(
      { user_id: 'uid-123', name: '새별명', image: null, introduction: '기존 소개' },
      { onConflict: 'user_id' },
    )
  })
})

describe('길이 제한과 오류 상황 (US3)', () => {
  test('카운터가 입력에 따라 #n/150 형식으로 즉시 갱신된다 (FR-004)', async () => {
    renderMe()
    const { intro } = await openForm('김구글')
    expect(screen.getByText('#0/150')).toBeInTheDocument()

    await userEvent.type(intro, '안녕')

    expect(screen.getByText('#2/150')).toBeInTheDocument()
  })

  test('150자에 도달하면 추가 입력과 붙여넣기가 반영되지 않는다 (FR-003)', async () => {
    renderMe()
    const { intro } = await openForm('김구글')

    await userEvent.click(intro)
    await userEvent.paste('가'.repeat(151))
    expect(intro).toHaveValue('가'.repeat(150))

    await userEvent.type(intro, '더')
    expect(intro).toHaveValue('가'.repeat(150))
    expect(screen.getByText('#150/150')).toBeInTheDocument()
  })

  test('저장이 실패하면 오류 안내가 뜨고 입력 내용은 유지된다 (FR-012)', async () => {
    supaMock.state.upsertError = { message: 'boom' }
    renderMe()
    const { intro } = await openForm('김구글')

    await userEvent.type(intro, '날아가면 안 되는 소개')
    await userEvent.click(screen.getByRole('button', { name: '변경 사항 저장' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
    )
    expect(intro).toHaveValue('날아가면 안 되는 소개')
  })

  test('저장이 진행되는 동안 버튼은 진행 중 상태로 비활성화된다 (FR-013)', async () => {
    let release!: () => void
    supaMock.upsert.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        release = resolve
      })
      return { error: null }
    })
    renderMe()
    const { intro } = await openForm('김구글')
    await userEvent.type(intro, '저장 중 확인')

    const button = screen.getByRole('button', { name: '변경 사항 저장' })
    await userEvent.click(button)

    expect(screen.getByRole('button', { name: '저장 중…' })).toBeDisabled()

    await act(async () => {
      release()
    })
    expect(await screen.findByText('저장되었습니다.')).toBeInTheDocument()
  })

  test('프로필 조회에 실패하면 폼 전체가 비활성화되고 재시도 버튼이 보인다 (FR-019·020)', async () => {
    supaMock.state.selectError = { message: 'network down' }
    renderMe()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('프로필을 불러오지 못했어요.')
    expect(screen.getByRole('button', { name: '재시도' })).toBeEnabled()
    expect(screen.getByRole('textbox', { name: '별명' })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: '자기소개' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '변경 사항 저장' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /이미지 변경/ })).toBeDisabled()
  })

  test('재시도가 성공하면 폼이 DB 값으로 채워지고 저장이 다시 가능해진다 (FR-021)', async () => {
    supaMock.state.selectError = { message: 'network down' }
    supaMock.state.profiles['uid-123'] = {
      name: '복구별명',
      image: null,
      introduction: '복구된 소개',
    }
    renderMe()
    const retry = await screen.findByRole('button', { name: '재시도' })

    supaMock.state.selectError = null
    await userEvent.click(retry)

    const { intro } = await openForm('복구별명')
    expect(intro).toHaveValue('복구된 소개')
    expect(intro).toBeEnabled()

    await userEvent.type(intro, ' 더')
    expect(screen.getByRole('button', { name: '변경 사항 저장' })).toBeEnabled()
  })
})
