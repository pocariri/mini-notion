'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type User = {
  nickname: string
  email: string
  image: string | null
}

export type Post = {
  id: string
  title: string
  content: string
  favorite: boolean
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

type Store = {
  ready: boolean
  user: User | null
  posts: Post[]
  login: () => Promise<{ error: string | null }>
  logout: () => Promise<void>
  updateUser: (patch: Partial<User>) => void
  createPost: (title?: string, content?: string) => string
  updatePost: (id: string, patch: Partial<Pick<Post, 'title' | 'content'>>) => void
  toggleFavorite: (id: string) => void
  trashPost: (id: string) => void
  restorePost: (id: string) => void
  deletePostForever: (id: string) => void
  resetAll: () => Promise<void>
}

const POSTS_KEY = 'mini-notion:posts'
// 가짜 로그인 시절의 사용자 키 — 실제 세션과 섞이지 않도록 초기화 시 제거한다.
const LEGACY_USER_KEY = 'mini-notion:user'

const overlayKey = (uid: string) => `mini-notion:user-overlay:${uid}`

// Google 계정 초기값 위에 /me에서 수정한 값을 덮어쓰는 로컬 오버레이.
// image는 "명시적으로 제거(null)"와 "수정한 적 없음(키 없음)"을 구분한다.
type Overlay = { nickname?: string; image?: string | null }

type AuthUser = { uid: string; base: User }

const StoreContext = createContext<Store | null>(null)

function loadJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function userFromSession(session: Session | null): AuthUser | null {
  const su = session?.user
  if (!su) return null
  const email = su.email ?? ''
  const meta = su.user_metadata ?? {}
  const fullName =
    typeof meta.full_name === 'string' && meta.full_name
      ? meta.full_name
      : typeof meta.name === 'string'
        ? meta.name
        : ''
  const avatar = typeof meta.avatar_url === 'string' ? meta.avatar_url : null
  return {
    uid: su.id,
    base: {
      nickname: fullName || email.split('@')[0] || '사용자',
      email,
      image: avatar,
    },
  }
}

function seedPosts(now: number): Post[] {
  const day = 86_400_000
  const make = (
    title: string,
    content: string,
    age: number,
    favorite = false,
  ): Post => ({
    id: crypto.randomUUID(),
    title,
    content,
    favorite,
    createdAt: now - age,
    updatedAt: now - age,
    deletedAt: null,
  })
  return [
    make(
      '주간 업무 정리',
      '이번 주 목표\n- 미니 노션 MVP 마무리\n- 디자인 시스템 토큰 정리\n- 회의록 템플릿 만들기\n\n메모\n수요일 오후는 집중 작업 시간으로 비워 두기.',
      2 * day,
      true,
    ),
    make(
      '신제품 아이디어',
      '- 개인용 미니 노션: 글 CRUD만 있는 가장 단순한 버전\n- 슬래시 명령(/page)으로 빠르게 새 글 만들기\n- 나중에: 태그 분류, 검색, 할 일 목록',
      3 * day,
    ),
    make(
      '회의 메모',
      '7월 첫 주 회의\n- MVP 범위: 로그인, 업무 페이지, 글 상세, 마이 페이지\n- 운영 비용 0원 유지\n- 다음 회의까지 와이어프레임 확정',
      5 * day,
    ),
    make(
      '읽을 자료 모음',
      '- PRD 작성 가이드\n- 디자인 핸드오프 체크리스트\n- Next.js App Router 문서',
      8 * day,
    ),
  ]
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [overlay, setOverlay] = useState<Overlay>({})
  const [posts, setPosts] = useState<Post[]>([])
  const hadStoredPosts = useRef(false)

  useEffect(() => {
    localStorage.removeItem(LEGACY_USER_KEY)
    hadStoredPosts.current = localStorage.getItem(POSTS_KEY) !== null
    setPosts(loadJSON<Post[]>(POSTS_KEY) ?? [])

    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      setAuthUser(userFromSession(session))
      setReady(true)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(userFromSession(session))
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const uid = authUser?.uid ?? null

  // 계정이 바뀌면 그 계정의 로컬 수정분(오버레이)을 불러온다.
  useEffect(() => {
    setOverlay(uid ? (loadJSON<Overlay>(overlayKey(uid)) ?? {}) : {})
  }, [uid])

  // 이 브라우저에서 글을 저장한 적 없는 첫 로그인이면 시드 글을 만든다.
  useEffect(() => {
    if (!uid || hadStoredPosts.current) return
    setPosts(seedPosts(Date.now()))
    hadStoredPosts.current = true
  }, [uid])

  useEffect(() => {
    if (!ready) return
    localStorage.setItem(POSTS_KEY, JSON.stringify(posts))
  }, [posts, ready])

  const login = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/login` },
    })
    return { error: error?.message ?? null }
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const updateUser = useCallback(
    (patch: Partial<User>) => {
      if (!uid) return
      const next: Overlay = { ...overlay }
      if (patch.nickname !== undefined) next.nickname = patch.nickname
      if ('image' in patch) next.image = patch.image ?? null
      setOverlay(next)
      localStorage.setItem(overlayKey(uid), JSON.stringify(next))
    },
    [uid, overlay],
  )

  const createPost = useCallback((title = '', content = '') => {
    const now = Date.now()
    const post: Post = {
      id: crypto.randomUUID(),
      title,
      content,
      favorite: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }
    setPosts((ps) => [post, ...ps])
    return post.id
  }, [])

  const updatePost = useCallback(
    (id: string, patch: Partial<Pick<Post, 'title' | 'content'>>) => {
      setPosts((ps) =>
        ps.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)),
      )
    },
    [],
  )

  const toggleFavorite = useCallback((id: string) => {
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, favorite: !p.favorite } : p)))
  }, [])

  const trashPost = useCallback((id: string) => {
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, deletedAt: Date.now() } : p)))
  }, [])

  const restorePost = useCallback((id: string) => {
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, deletedAt: null } : p)))
  }, [])

  const deletePostForever = useCallback((id: string) => {
    setPosts((ps) => ps.filter((p) => p.id !== id))
  }, [])

  const resetAll = useCallback(async () => {
    setPosts([])
    setOverlay({})
    localStorage.removeItem(POSTS_KEY)
    if (uid) localStorage.removeItem(overlayKey(uid))
    hadStoredPosts.current = false
    await supabase.auth.signOut()
  }, [uid])

  const user = useMemo<User | null>(() => {
    if (!authUser) return null
    const { base } = authUser
    return {
      nickname: overlay.nickname ?? base.nickname,
      email: base.email,
      image: 'image' in overlay ? (overlay.image ?? null) : base.image,
    }
  }, [authUser, overlay])

  const value = useMemo<Store>(
    () => ({
      ready,
      user,
      posts,
      login,
      logout,
      updateUser,
      createPost,
      updatePost,
      toggleFavorite,
      trashPost,
      restorePost,
      deletePostForever,
      resetAll,
    }),
    [
      ready,
      user,
      posts,
      login,
      logout,
      updateUser,
      createPost,
      updatePost,
      toggleFavorite,
      trashPost,
      restorePost,
      deletePostForever,
      resetAll,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used within StoreProvider')
  return store
}
