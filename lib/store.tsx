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
  login: () => void
  logout: () => void
  updateUser: (patch: Partial<User>) => void
  createPost: (title?: string, content?: string) => string
  updatePost: (id: string, patch: Partial<Pick<Post, 'title' | 'content'>>) => void
  toggleFavorite: (id: string) => void
  trashPost: (id: string) => void
  restorePost: (id: string) => void
  deletePostForever: (id: string) => void
  resetAll: () => void
}

const USER_KEY = 'mini-notion:user'
const POSTS_KEY = 'mini-notion:posts'

const StoreContext = createContext<Store | null>(null)

function loadJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
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
  const [user, setUser] = useState<User | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const hadStoredPosts = useRef(false)

  useEffect(() => {
    hadStoredPosts.current = localStorage.getItem(POSTS_KEY) !== null
    setUser(loadJSON<User>(USER_KEY))
    setPosts(loadJSON<Post[]>(POSTS_KEY) ?? [])
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_KEY)
  }, [user, ready])

  useEffect(() => {
    if (!ready) return
    localStorage.setItem(POSTS_KEY, JSON.stringify(posts))
  }, [posts, ready])

  const login = useCallback(() => {
    setUser({ nickname: '유아이볼', email: 'uibowl@gmail.com', image: null })
    if (!hadStoredPosts.current) {
      setPosts(seedPosts(Date.now()))
      hadStoredPosts.current = true
    }
  }, [])

  const logout = useCallback(() => setUser(null), [])

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((u) => (u ? { ...u, ...patch } : u))
  }, [])

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

  const resetAll = useCallback(() => {
    setPosts([])
    setUser(null)
    localStorage.removeItem(POSTS_KEY)
    localStorage.removeItem(USER_KEY)
    hadStoredPosts.current = false
  }, [])

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
