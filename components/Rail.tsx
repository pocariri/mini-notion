'use client'

import Link from 'next/link'
import { Clock, FileText, Search, Settings, Star, Trash2 } from 'lucide-react'
import Avatar from '@/components/Avatar'
import ThemeToggle from '@/components/ThemeToggle'
import type { User } from '@/lib/store'

export type NavKey = 'all' | 'favorites' | 'recent' | 'trash'

export const NAV_LABELS: Record<NavKey, string> = {
  all: '전체 글',
  favorites: '즐겨찾기',
  recent: '최근 항목',
  trash: '휴지통',
}

const NAV_ICONS = {
  all: FileText,
  favorites: Star,
  recent: Clock,
  trash: Trash2,
} as const

type Props = {
  user: User
  nav: NavKey
  counts: Partial<Record<NavKey, number>>
  search: string
  onNav: (key: NavKey) => void
  onSearch: (value: string) => void
}

export default function Rail({ user, nav, counts, search, onNav, onSearch }: Props) {
  return (
    <aside className="rail">
      <div className="brand">
        <span className="brand-tile">m</span>
        <span className="brand-name">mini notion</span>
      </div>

      <label className="rail-search">
        <Search size={14} />
        <input
          type="text"
          placeholder="검색…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </label>

      <div className="section-label">내 업무</div>
      {(Object.keys(NAV_LABELS) as NavKey[]).map((key) => {
        const Icon = NAV_ICONS[key]
        const count = counts[key]
        return (
          <button
            key={key}
            className={`navitem${nav === key ? ' active' : ''}`}
            onClick={() => onNav(key)}
          >
            <Icon size={15} />
            {NAV_LABELS[key]}
            {count !== undefined && <span className="count">{count}</span>}
          </button>
        )
      })}

      <div className="rail-spacer" />

      <ThemeToggle />

      <Link href="/me" className="rail-footer" title="마이 페이지">
        <Avatar user={user} size={30} />
        <span className="rail-username">{user.nickname}님</span>
        <Settings size={15} className="gear" />
      </Link>
    </aside>
  )
}
