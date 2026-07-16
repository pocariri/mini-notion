'use client'

import Link from 'next/link'
import { FileText, Search, Settings } from 'lucide-react'
import Avatar from '@/components/Avatar'
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

      <Link href="/me" className="rail-footer" title="마이 페이지">
        <Avatar user={user} size={30} />
        <span className="rail-username">{user.nickname}님</span>
        <Settings size={15} className="gear" />
      </Link>
    </aside>
  )
}
