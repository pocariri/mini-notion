'use client'

import { useMemo, useRef, useState } from 'react'
import { ArrowUp, CheckSquare, FileText, Heading1 } from 'lucide-react'

const SLASH_ITEMS = [
  { key: 'page', label: 'page — 새 페이지', icon: FileText, enabled: true },
  { key: 'todo', label: '할 일 목록', icon: CheckSquare, enabled: false },
  { key: 'heading', label: '제목', icon: Heading1, enabled: false },
] as const

type Props = {
  onCreate: (title: string) => void
}

export default function PromptBox({ onCreate }: Props) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isSlash = value.startsWith('/')
  const query = isSlash ? value.slice(1).trim().toLowerCase() : ''
  const matches = useMemo(
    () =>
      isSlash
        ? SLASH_ITEMS.filter(
            (item) => query === '' || item.key.startsWith(query),
          )
        : [],
    [isSlash, query],
  )
  const highlighted = matches.find((item) => item.enabled) ?? null
  const menuOpen = focused && isSlash

  const create = (title: string) => {
    onCreate(title)
    setValue('')
    inputRef.current?.blur()
  }

  const submit = () => {
    if (isSlash) {
      if (highlighted?.key === 'page') create('')
      return
    }
    const title = value.trim()
    if (title) create(title)
  }

  return (
    <div className="promptbox">
      <div className="promptbox-inner">
        <input
          ref={inputRef}
          type="text"
          placeholder="'/page' 입력해 새 페이지…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            } else if (e.key === 'Escape') {
              setValue('')
            }
          }}
        />
        <button
          className="send"
          onClick={submit}
          disabled={isSlash ? highlighted === null : value.trim() === ''}
          aria-label="새 페이지 만들기"
        >
          <ArrowUp size={16} />
        </button>
      </div>

      {menuOpen && (
        <div className="slashmenu">
          <div className="slashmenu-label">기본 블록</div>
          {matches.length === 0 && (
            <div className="slashmenu-empty">일치하는 명령이 없어요.</div>
          )}
          {matches.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                className={`slashmenu-row${item === highlighted ? ' hl' : ''}`}
                disabled={!item.enabled}
                onMouseDown={(e) => {
                  e.preventDefault()
                  if (item.key === 'page') create('')
                }}
              >
                <Icon size={15} />
                {item.label}
                {!item.enabled && <span className="soon">준비 중</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
