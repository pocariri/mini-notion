'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, X } from 'lucide-react'
import Editor from '@/components/Editor'
import PromptBox from '@/components/PromptBox'
import Rail, { NAV_LABELS, type NavKey } from '@/components/Rail'
import { formatDate } from '@/lib/format'
import { useStore, type Page } from '@/lib/store'

const SUGGESTIONS = ['주간 업무 정리', '할 일 적기', '회의 메모']

function filterPages(pages: Page[], search: string): Page[] {
  const q = search.trim().toLowerCase()
  if (!q) return pages
  return pages.filter(
    (p) => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q),
  )
}

export default function WorkspacePage() {
  const {
    ready,
    user,
    pages,
    pagesStatus,
    saveStatus,
    notice,
    dismissNotice,
    createPage,
    updatePage,
    deletePage,
    discardIfEmpty,
    flushPending,
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

  const visible = useMemo(() => filterPages(pages, search), [pages, search])
  const counts = useMemo(() => ({ all: pages.length }), [pages])
  const selected = pages.find((p) => p.id === selectedId) ?? null

  if (!ready || !user) {
    return (
      <div className="splash">
        <span className="login-logo">m</span>
      </div>
    )
  }

  // 페이지를 떠날 때 대기 중인 저장을 먼저 보내고, 아무것도 안 쓴 빈 페이지는 정리한다.
  const leaveCurrent = async () => {
    const leaving = selectedId
    await flushPending()
    if (leaving) await discardIfEmpty(leaving)
  }

  const handleSelect = async (id: string) => {
    if (id === selectedId) return
    await leaveCurrent()
    setSelectedId(id)
  }

  const handleCreate = async (title: string) => {
    await leaveCurrent()
    setSearch('')
    const id = await createPage(title)
    if (!id) return
    setSelectedId(id)
    setFocusId(title ? null : id)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('이 페이지를 삭제할까요? 되돌릴 수 없어요.')) return
    if (selectedId === id) setSelectedId(null)
    await deletePage(id)
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

        {notice && (
          <div className="list-notice" role="alert">
            <span>{notice}</span>
            <button type="button" aria-label="알림 닫기" onClick={dismissNotice}>
              <X size={12} />
            </button>
          </div>
        )}

        <div className="list-section-label">{sectionLabel}</div>

        {/* 불러오는 중에는 자리표시만 보여준다. 여기서 빈 상태 안내를 띄우면
            페이지가 있는 사용자에게 "없어요"가 번쩍인다. */}
        {pagesStatus === 'loading' &&
          [0, 1, 2].map((i) => (
            <div key={i} className="listrow-skeleton" aria-hidden="true">
              <span className="sk-title" />
              <span className="sk-snippet" />
              <span className="sk-meta" />
            </div>
          ))}

        {pagesStatus === 'error' && (
          <div className="list-error" role="alert">
            페이지를 불러오지 못했어요. 연결을 확인하고 새로고침해 주세요.
          </div>
        )}

        {pagesStatus === 'ready' && visible.length === 0 && (
          <div className="list-empty">
            {search.trim()
              ? '검색 결과가 없어요.'
              : '아직 페이지가 없어요. /page로 시작해 보세요.'}
          </div>
        )}

        {pagesStatus === 'ready' &&
          visible.map((page) => (
            <button
              key={page.id}
              className={`listrow${page.id === selectedId ? ' sel' : ''}`}
              onClick={() => handleSelect(page.id)}
            >
              <span className={`listrow-title${page.title ? '' : ' untitled'}`}>
                {page.title || '제목 없음'}
              </span>
              {page.content && (
                <span className="listrow-snippet">{page.content.split('\n')[0]}</span>
              )}
              <span className="listrow-meta">{formatDate(page.createdAt)}</span>
            </button>
          ))}
      </section>

      {selected ? (
        <Editor
          page={selected}
          navLabel={NAV_LABELS[nav]}
          nickname={user.nickname}
          focusTitle={focusId === selected.id}
          saveStatus={saveStatus}
          onPatch={(patch) => updatePage(selected.id, patch)}
          onDelete={() => handleDelete(selected.id)}
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
              <p>왼쪽 페이지를 고르거나 &lsquo;/page&rsquo;로 새 페이지를 시작하세요.</p>
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
