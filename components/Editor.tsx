'use client'

import { useEffect, useRef } from 'react'
import { Trash2 } from 'lucide-react'
import CatCover from '@/components/CatCover'
import { charCount, formatDate } from '@/lib/format'
import type { Page, SaveStatus } from '@/lib/store'

type Props = {
  page: Page
  navLabel: string
  nickname: string
  focusTitle: boolean
  saveStatus: SaveStatus
  onPatch: (patch: Partial<Pick<Page, 'title' | 'content'>>) => void
  onDelete: () => void
}

const SAVE_LABELS: Record<SaveStatus, string> = {
  saved: '저장됨',
  saving: '저장 중…',
  error: '저장 안 됨',
}

export default function Editor({
  page,
  navLabel,
  nickname,
  focusTitle,
  saveStatus,
  onPatch,
  onDelete,
}: Props) {
  const contentRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grow the content textarea to fit its text.
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [page.id, page.content])

  return (
    <div className="detail">
      <div className="detail-inner">
        <div className="detail-toolbar">
          <span className="breadcrumb">
            {navLabel} ›{' '}
            <span className="crumb-title">{page.title || '제목 없음'}</span>
            <span
              className={`save-state${saveStatus === 'error' ? ' err' : ''}`}
              role={saveStatus === 'error' ? 'alert' : undefined}
            >
              · {SAVE_LABELS[saveStatus]}
            </span>
          </span>
          <div className="toolbar-actions">
            <button className="btn btn-danger" onClick={onDelete}>
              <Trash2 size={14} />
              삭제
            </button>
          </div>
        </div>

        <CatCover key={`cover-${page.id}`} />

        <input
          key={page.id}
          className="title-input"
          type="text"
          placeholder="제목 없음"
          value={page.title}
          autoFocus={focusTitle}
          onChange={(e) => onPatch({ title: e.target.value })}
        />

        <div className="doc-meta">
          작성 {formatDate(page.createdAt)} · {nickname}
        </div>

        <div className="doc-divider" />

        <textarea
          ref={contentRef}
          className="content-input"
          placeholder="여기에 내용을 입력하세요."
          value={page.content}
          onChange={(e) => onPatch({ content: e.target.value })}
        />

        <div className="content-counter">{charCount(page.content)}자</div>
      </div>
    </div>
  )
}
