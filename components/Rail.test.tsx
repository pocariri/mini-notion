import { describe, test, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Rail, { NAV_LABELS, type NavKey } from './Rail'
import type { User } from '@/lib/store'

const testUser: User = { nickname: '테스터', email: 'tester@example.com', image: null }

type RailProps = Parameters<typeof Rail>[0]

function makeProps(overrides: Partial<RailProps> = {}): RailProps {
  return {
    user: testUser,
    nav: 'all',
    counts: { all: 3, favorites: 1, trash: 0 },
    search: '',
    onNav: vi.fn(),
    onSearch: vi.fn(),
    collapsed: false,
    onToggleCollapse: vi.fn(),
    ...overrides,
  }
}

function renderRail(overrides: Partial<RailProps> = {}) {
  const props = makeProps(overrides)
  const utils = render(<Rail {...props} />)
  return { ...utils, props }
}

// 접힘 상태를 실제로 보유·반전하는 소형 하네스.
// 접힘 검색 버튼 → 펼침 → 검색 입력 포커스(FR-015)처럼 상태 전환을 관통하는
// 동작은 controlled prop만으로는 검증할 수 없어 상태를 가진 래퍼가 필요하다.
function CollapsibleHarness({ initialCollapsed = true }: { initialCollapsed?: boolean }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  return (
    <Rail {...makeProps({ collapsed, onToggleCollapse: () => setCollapsed((c) => !c) })} />
  )
}

describe('토글 버튼 (C-1 · C-3)', () => {
  test('펼침 상태에서 접근 가능한 이름을 가진 토글 버튼이 렌더된다 (C-1)', () => {
    renderRail({ collapsed: false })

    expect(
      screen.getByRole('button', { name: '사이드바 접기/펼치기' }),
    ).toBeInTheDocument()
  })

  test('접힘 상태에서도 토글 버튼이 그대로 렌더된다 (C-1, FR-001a)', () => {
    renderRail({ collapsed: true })

    expect(
      screen.getByRole('button', { name: '사이드바 접기/펼치기' }),
    ).toBeInTheDocument()
  })

  test('토글 버튼은 레일의 첫 번째 버튼이다 (C-1, SC-004 탭 도달)', () => {
    renderRail({ collapsed: false })

    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).toHaveAccessibleName('사이드바 접기/펼치기')
  })

  test('토글 클릭 시 onToggleCollapse가 정확히 1회 호출된다 (C-3)', async () => {
    const user = userEvent.setup()
    const { props } = renderRail({ collapsed: false })

    await user.click(screen.getByRole('button', { name: '사이드바 접기/펼치기' }))

    expect(props.onToggleCollapse).toHaveBeenCalledTimes(1)
  })
})

describe('접힘 상태 렌더링 (C-4 ~ C-9)', () => {
  test('collapsed=true면 루트에 collapsed 클래스가 붙는다 (C-4)', () => {
    const { container } = renderRail({ collapsed: true })

    const rail = container.querySelector('aside.rail')
    expect(rail).not.toBeNull()
    expect(rail).toHaveClass('collapsed')
  })

  test('collapsed=false면 collapsed 클래스가 없다 (C-4)', () => {
    const { container } = renderRail({ collapsed: false })

    expect(container.querySelector('aside.rail')).not.toHaveClass('collapsed')
  })

  test('접힘 상태에서 내비 버튼 4개가 라벨 이름을 갖고 onNav를 호출한다 (C-5 · C-6)', async () => {
    const user = userEvent.setup()
    const { props } = renderRail({ collapsed: true })

    for (const key of Object.keys(NAV_LABELS) as NavKey[]) {
      await user.click(screen.getByRole('button', { name: NAV_LABELS[key] }))
      expect(props.onNav).toHaveBeenLastCalledWith(key)
    }
    expect(props.onNav).toHaveBeenCalledTimes(4)
  })

  test('접힘 상태에서도 활성 내비 항목이 구분된다 (C-5, FR-013)', () => {
    renderRail({ collapsed: true, nav: 'favorites' })

    expect(screen.getByRole('button', { name: '즐겨찾기' })).toHaveClass('active')
  })

  test('내비 라벨은 span.navitem-label로, 카운트는 .count로 래핑된다 (C-6)', () => {
    const { container } = renderRail()

    expect(container.querySelectorAll('.navitem .navitem-label')).toHaveLength(4)
    // counts prop이 all·favorites·trash 세 항목만 제공하므로 .count도 3개
    expect(container.querySelectorAll('.navitem .count')).toHaveLength(3)
  })

  test('펼침 상태에서는 검색 입력이 렌더된다 (C-7)', () => {
    renderRail({ collapsed: false })

    expect(screen.getByPlaceholderText('검색…')).toBeInTheDocument()
  })

  test('접힘 상태에서는 검색 입력 대신 검색 버튼이 렌더된다 (C-7)', () => {
    const { container } = renderRail({ collapsed: true })

    expect(container.querySelector('.rail-search input')).toBeNull()
    expect(screen.getByRole('button', { name: '검색' })).toBeInTheDocument()
  })

  test('접힘 검색 버튼 클릭 시 레일이 펼쳐지고 검색 입력에 포커스가 놓인다 (C-7, FR-015)', async () => {
    const user = userEvent.setup()
    render(<CollapsibleHarness initialCollapsed />)

    await user.click(screen.getByRole('button', { name: '검색' }))

    const input = screen.getByPlaceholderText('검색…')
    expect(input).toHaveFocus()
  })

  test('접힘 상태에서도 마이 페이지 링크(푸터)가 존재한다 (C-9)', () => {
    renderRail({ collapsed: true })

    expect(screen.getByRole('link')).toHaveAttribute('href', '/me')
  })
})

describe('접근성·툴팁 (US3: C-2 · C-8)', () => {
  test('펼침 상태의 토글은 aria-expanded="true"를 노출한다 (C-2, FR-010)', () => {
    renderRail({ collapsed: false })

    expect(
      screen.getByRole('button', { name: '사이드바 접기/펼치기' }),
    ).toHaveAttribute('aria-expanded', 'true')
  })

  test('접힘 상태의 토글은 aria-expanded="false"를 노출한다 (C-2, FR-010)', () => {
    renderRail({ collapsed: true })

    expect(
      screen.getByRole('button', { name: '사이드바 접기/펼치기' }),
    ).toHaveAttribute('aria-expanded', 'false')
  })

  test('키보드(Enter·Space)로 토글을 실행할 수 있다 (FR-009 — 네이티브 버튼 가드)', async () => {
    const user = userEvent.setup()
    const { props } = renderRail({ collapsed: false })

    screen.getByRole('button', { name: '사이드바 접기/펼치기' }).focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')

    expect(props.onToggleCollapse).toHaveBeenCalledTimes(2)
  })

  test('접힘 상태에서 토글·검색·푸터가 data-tip 라벨을 가진다 (C-8, FR-014)', () => {
    renderRail({ collapsed: true })

    expect(
      screen.getByRole('button', { name: '사이드바 접기/펼치기' }),
    ).toHaveAttribute('data-tip', '사이드바 접기/펼치기')
    expect(screen.getByRole('button', { name: '검색' })).toHaveAttribute(
      'data-tip',
      '검색',
    )
    expect(screen.getByRole('link')).toHaveAttribute('data-tip', '마이 페이지')
  })

  test('접힘 내비의 data-tip은 카운트가 있으면 포함하고 없으면 라벨만 쓴다 (C-8)', () => {
    renderRail({ collapsed: true })

    // counts prop: all 3, favorites 1, trash 0 — recent는 카운트 없음
    expect(screen.getByRole('button', { name: '전체 글' })).toHaveAttribute(
      'data-tip',
      '전체 글 (3)',
    )
    expect(screen.getByRole('button', { name: '즐겨찾기' })).toHaveAttribute(
      'data-tip',
      '즐겨찾기 (1)',
    )
    expect(screen.getByRole('button', { name: '최근 항목' })).toHaveAttribute(
      'data-tip',
      '최근 항목',
    )
    expect(screen.getByRole('button', { name: '휴지통' })).toHaveAttribute(
      'data-tip',
      '휴지통 (0)',
    )
  })
})
