'use client'

import { useEffect, useRef } from 'react'
import { RotateCcw, Star, Trash2, X } from 'lucide-react'
import CatCover from '@/components/CatCover'
import { charCount, formatDate } from '@/lib/format'
import type { Post } from '@/lib/store'

type Props = {
  post: Post
  navLabel: string
  nickname: string
  focusTitle: boolean
  onPatch: (patch: Partial<Pick<Post, 'title' | 'content'>>) => void
  onToggleFavorite: () => void
  onTrash: () => void
  onRestore: () => void
  onDeleteForever: () => void
}

export default function Editor({
  post,
  navLabel,
  nickname,
  focusTitle,
  onPatch,
  onToggleFavorite,
  onTrash,
  onRestore,
  onDeleteForever,
}: Props) {
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const inTrash = post.deletedAt !== null

  // Auto-grow the content textarea to fit its text.
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [post.id, post.content])

  return (
    <div className="detail">
      <div className="detail-inner">
        <div className="detail-toolbar">
          <span className="breadcrumb">
            {navLabel} ›{' '}
            <span className="crumb-title">{post.title || '제목 없음'}</span>
            {!inTrash && (
              <span className="save-state">· 저장됨 {formatDate(post.updatedAt)}</span>
            )}
          </span>
          {!inTrash && (
            <div className="toolbar-actions">
              <button
                className={`chip${post.favorite ? ' on' : ''}`}
                onClick={onToggleFavorite}
              >
                <Star
                  size={14}
                  fill={post.favorite ? 'currentColor' : 'none'}
                />
                즐겨찾기
              </button>
              <button className="btn btn-danger" onClick={onTrash}>
                <Trash2 size={14} />
                삭제
              </button>
            </div>
          )}
        </div>

        {inTrash && (
          <div className="trash-banner">
            <span>휴지통에 있는 글이에요. 복원하면 다시 편집할 수 있어요.</span>
            <span className="trash-banner-actions">
              <button className="btn" onClick={onRestore}>
                <RotateCcw size={14} />
                복원
              </button>
              <button className="btn btn-danger" onClick={onDeleteForever}>
                <X size={14} />
                영구 삭제
              </button>
            </span>
          </div>
        )}

        <CatCover key={`cover-${post.id}`} />

        <input
          key={post.id}
          className="title-input"
          type="text"
          placeholder="제목 없음"
          value={post.title}
          autoFocus={focusTitle && !inTrash}
          readOnly={inTrash}
          onChange={(e) => onPatch({ title: e.target.value })}
        />

        <div className="doc-meta">
          작성 {formatDate(post.createdAt)} · 수정 {formatDate(post.updatedAt)} ·{' '}
          {nickname}
        </div>

        <div className="doc-divider" />

        <textarea
          ref={contentRef}
          className="content-input"
          placeholder="여기에 내용을 입력하세요."
          value={post.content}
          readOnly={inTrash}
          onChange={(e) => onPatch({ content: e.target.value })}
        />

        <div className="content-counter">{charCount(post.content)}자</div>
      </div>
    </div>
  )
}
