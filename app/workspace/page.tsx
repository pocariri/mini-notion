'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, RotateCcw, Star, X } from 'lucide-react'
import Editor from '@/components/Editor'
import PromptBox from '@/components/PromptBox'
import Rail, { NAV_LABELS, type NavKey } from '@/components/Rail'
import { formatDate } from '@/lib/format'
import { useStore, type Post } from '@/lib/store'

const SUGGESTIONS = ['주간 업무 정리', '할 일 적기', '회의 메모']

function filterPosts(posts: Post[], nav: NavKey, search: string): Post[] {
  let list: Post[]
  switch (nav) {
    case 'favorites':
      list = posts
        .filter((p) => !p.deletedAt && p.favorite)
        .sort((a, b) => b.createdAt - a.createdAt)
      break
    case 'recent':
      list = posts
        .filter((p) => !p.deletedAt)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 10)
      break
    case 'trash':
      list = posts
        .filter((p) => p.deletedAt)
        .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
      break
    default:
      list = posts
        .filter((p) => !p.deletedAt)
        .sort((a, b) => b.createdAt - a.createdAt)
  }
  const q = search.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (p) =>
        p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q),
    )
  }
  return list
}

export default function WorkspacePage() {
  const {
    ready,
    user,
    posts,
    createPost,
    updatePost,
    toggleFavorite,
    trashPost,
    restorePost,
    deletePostForever,
    sidebarCollapsed,
    toggleSidebar,
  } = useStore()
  const router = useRouter()

  const [nav, setNav] = useState<NavKey>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)

  useEffect(() => {
    if (ready && !user) router.replace('/login')
  }, [ready, user, router])

  const visible = useMemo(
    () => filterPosts(posts, nav, search),
    [posts, nav, search],
  )
  const counts = useMemo(
    () => ({
      all: posts.filter((p) => !p.deletedAt).length,
      favorites: posts.filter((p) => !p.deletedAt && p.favorite).length,
      trash: posts.filter((p) => p.deletedAt).length,
    }),
    [posts],
  )
  const selected = posts.find((p) => p.id === selectedId) ?? null

  if (!ready || !user) {
    return (
      <div className="splash">
        <span className="login-logo">m</span>
      </div>
    )
  }

  const handleCreate = (title: string) => {
    const id = createPost(title)
    setNav('all')
    setSearch('')
    setSelectedId(id)
    setFocusId(title ? null : id)
  }

  const handleDeleteForever = (id: string) => {
    if (!window.confirm('이 글을 영구 삭제할까요? 되돌릴 수 없어요.')) return
    deletePostForever(id)
    if (selectedId === id) setSelectedId(null)
  }

  const sectionLabel = search.trim()
    ? `검색 결과 · ${visible.length}`
    : `${NAV_LABELS[nav]} · ${visible.length}`

  return (
    <main className="workspace">
      <Rail
        user={user}
        nav={nav}
        counts={counts}
        search={search}
        onNav={(key) => setNav(key)}
        onSearch={setSearch}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />

      <section className="listpane">
        <PromptBox onCreate={handleCreate} />
        <div className="list-section-label">{sectionLabel}</div>

        {visible.length === 0 && (
          <div className="list-empty">
            {nav === 'trash'
              ? '휴지통이 비어 있어요.'
              : search.trim()
                ? '검색 결과가 없어요.'
                : '아직 글이 없어요. /page로 시작해 보세요.'}
          </div>
        )}

        {visible.map((post) => (
          <button
            key={post.id}
            className={`listrow${post.id === selectedId ? ' sel' : ''}`}
            onClick={() => setSelectedId(post.id)}
          >
            <span className={`listrow-title${post.title ? '' : ' untitled'}`}>
              {post.title || '제목 없음'}
            </span>
            {post.content && (
              <span className="listrow-snippet">
                {post.content.split('\n')[0]}
              </span>
            )}
            <span className="listrow-meta">
              {post.favorite && nav !== 'trash' && (
                <Star size={11} className="star" fill="currentColor" />
              )}
              {nav === 'trash'
                ? `삭제 ${formatDate(post.deletedAt ?? 0)}`
                : nav === 'recent'
                  ? `수정 ${formatDate(post.updatedAt)}`
                  : formatDate(post.createdAt)}
            </span>
            {nav === 'trash' && (
              <span className="trash-row-actions">
                <span
                  role="button"
                  tabIndex={0}
                  className="btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    restorePost(post.id)
                    setNav('all')
                    setSelectedId(post.id)
                  }}
                >
                  <RotateCcw size={12} />
                  복원
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  className="btn btn-danger"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteForever(post.id)
                  }}
                >
                  <X size={12} />
                  영구 삭제
                </span>
              </span>
            )}
          </button>
        ))}
      </section>

      {selected ? (
        <Editor
          post={selected}
          navLabel={NAV_LABELS[nav]}
          nickname={user.nickname}
          focusTitle={focusId === selected.id}
          onPatch={(patch) => updatePost(selected.id, patch)}
          onToggleFavorite={() => toggleFavorite(selected.id)}
          onTrash={() => {
            trashPost(selected.id)
            setSelectedId(null)
          }}
          onRestore={() => {
            restorePost(selected.id)
            setNav('all')
          }}
          onDeleteForever={() => handleDeleteForever(selected.id)}
        />
      ) : (
        <section className="detail">
          <div className="empty">
            <div className="empty-box">
              <div className="empty-icon">
                <FileText size={22} />
              </div>
              <h2>
                {user.nickname}님,
                <br />
                무엇을 기록할까요?
              </h2>
              <p>왼쪽 글을 고르거나 &lsquo;/page&rsquo;로 새 글을 시작하세요.</p>
              <div className="empty-chips">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="chip" onClick={() => handleCreate(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
