'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { FileText, PanelLeftClose, PanelLeftOpen, Search, Settings } from 'lucide-react'
import Avatar from '@/components/Avatar'
import ThemeToggle from '@/components/ThemeToggle'
import type { User } from '@/lib/store'

// 저장 구조에 즐겨찾기·삭제 표시·수정 시각을 담을 자리가 없어 관련 내비가 모두 사라졌다.
// '최근 항목'은 수정 시각 정렬이 없어지면 '전체'와 같은 목록이 되므로 함께 제거했다.
export type NavKey = 'all'

export const NAV_LABELS: Record<NavKey, string> = {
  all: '전체 페이지',
}

const NAV_ICONS = {
  all: FileText,
} as const

type Props = {
  user: User
  nav: NavKey
  counts: Partial<Record<NavKey, number>>
  search: string
  onNav: (key: NavKey) => void
  onSearch: (value: string) => void
  collapsed: boolean
  onToggleCollapse: () => void
}

export default function Rail({
  user,
  nav,
  counts,
  search,
  onNav,
  onSearch,
  collapsed,
  onToggleCollapse,
}: Props) {
  const searchInputRef = useRef<HTMLInputElement>(null)
  const wantSearchFocus = useRef(false)

  // 접힘 검색 버튼으로 펼친 직후에만, 그제서야 렌더된 검색 입력으로 포커스를 옮긴다(FR-015).
  useEffect(() => {
    if (!collapsed && wantSearchFocus.current) {
      wantSearchFocus.current = false
      searchInputRef.current?.focus()
    }
  }, [collapsed])

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose

  return (
    <aside className={collapsed ? 'rail collapsed' : 'rail'}>
      <div className="brand">
        <span className="brand-tile">m</span>
        <span className="brand-name">mini notion</span>
        <button
          type="button"
          className="rail-toggle"
          aria-label="사이드바 접기/펼치기"
          aria-expanded={!collapsed}
          data-tip="사이드바 접기/펼치기"
          onClick={onToggleCollapse}
        >
          <ToggleIcon size={15} />
        </button>
      </div>

      {collapsed ? (
        <button
          type="button"
          className="rail-search-button"
          aria-label="검색"
          data-tip="검색"
          onClick={() => {
            wantSearchFocus.current = true
            onToggleCollapse()
          }}
        >
          <Search size={14} />
        </button>
      ) : (
        <label className="rail-search">
          <Search size={14} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="검색…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </label>
      )}

      <div className="section-label">내 업무</div>
      {(Object.keys(NAV_LABELS) as NavKey[]).map((key) => {
        const Icon = NAV_ICONS[key]
        const label = NAV_LABELS[key]
        const count = counts[key]
        return (
          <button
            key={key}
            className={`navitem${nav === key ? ' active' : ''}`}
            aria-label={label}
            data-tip={count !== undefined ? `${label} (${count})` : label}
            onClick={() => onNav(key)}
          >
            <Icon size={15} />
            <span className="navitem-label">{label}</span>
            {count !== undefined && <span className="count">{count}</span>}
          </button>
        )
      })}

      <div className="rail-spacer" />

      <ThemeToggle />

      <Link href="/me" className="rail-footer" title="마이 페이지" data-tip="마이 페이지">
        <Avatar user={user} size={30} />
        <span className="rail-username">{user.nickname}님</span>
        <Settings size={15} className="gear" />
      </Link>
    </aside>
  )
}
