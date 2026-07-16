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
  introduction: string | null
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

// 프로필 행 조회의 명시적 상태 — profile이 null인 것만으로는
// "로딩 중 / 행 없음 / 조회 실패"를 구분할 수 없어서 따로 둔다.
export type ProfileStatus = 'loading' | 'ready' | 'error'

type Store = {
  ready: boolean
  user: User | null
  profileStatus: ProfileStatus
  retryProfile: () => void
  posts: Post[]
  login: () => Promise<{ error: string | null }>
  logout: () => Promise<void>
  updateUser: (patch: Partial<User>) => Promise<{ error: string | null }>
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
// 프로필이 Supabase(public.profile)로 이전되기 전의 로컬 오버레이 키 — 초기화 시 제거한다.
const LEGACY_OVERLAY_PREFIX = 'mini-notion:user-overlay:'

// Supabase public.profile 행(auth.users와 1:1). 최초 로그인 시 DB 트리거가
// Google 이름·사진을 초기값으로 만들어 주고, /me에서 수정하면 이 행을 덮어쓴다.
// image는 "명시적으로 제거"를 null로 저장한다(행이 있으면 DB 값이 진실).
// introduction은 자기소개(선택 항목) — "없음"의 정규 표현은 null이며 ''를 저장하지 않는다.
type Profile = {
  name: string | null
  image: string | null
  introduction: string | null
}

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
      // Google 메타데이터에는 자기소개가 없다 — 기본값은 항상 "없음".
      introduction: null,
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
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('loading')
  // retryProfile이 올릴 때마다 조회 effect가 다시 돈다.
  const [profileFetchCount, setProfileFetchCount] = useState(0)
  const [posts, setPosts] = useState<Post[]>([])
  const hadStoredPosts = useRef(false)

  useEffect(() => {
    localStorage.removeItem(LEGACY_USER_KEY)
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith(LEGACY_OVERLAY_PREFIX)) localStorage.removeItem(key)
    }
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

  // 계정이 바뀌면 그 계정의 프로필 행을 DB에서 불러온다. 행이 없으면 Google 기본값을 쓴다.
  // 조회가 끝나기 전까지는 loading, 실패하면 error — 실패 상태에서는 저장이 막힌다(updateUser 가드).
  useEffect(() => {
    setProfile(null)
    setProfileStatus('loading')
    if (!uid) return
    let cancelled = false
    supabase
      .from('profile')
      .select('name, image, introduction')
      .eq('user_id', uid)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setProfileStatus('error')
          return
        }
        if (data)
          setProfile({
            name: data.name,
            image: data.image,
            introduction: data.introduction,
          })
        setProfileStatus('ready')
      })
    return () => {
      cancelled = true
    }
  }, [uid, profileFetchCount])

  const retryProfile = useCallback(() => {
    setProfileFetchCount((n) => n + 1)
  }, [])

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
    async (patch: Partial<User>): Promise<{ error: string | null }> => {
      if (!uid || !authUser) return { error: '로그인이 필요합니다.' }
      // 조회가 끝나지 않았거나 실패한 상태의 저장은 profile ?? base 폴백으로
      // DB 행 전체를 기본값으로 덮어쓰는 경로다 — 게이트웨이에서 차단한다(FR-020).
      if (profileStatus !== 'ready')
        return { error: '프로필을 불러오지 못해 저장할 수 없습니다. 다시 시도해 주세요.' }
      const { base } = authUser
      const next: Profile = {
        name:
          patch.nickname !== undefined
            ? patch.nickname
            : (profile?.name ?? base.nickname),
        image:
          'image' in patch
            ? (patch.image ?? null)
            : profile
              ? profile.image
              : base.image,
        introduction:
          'introduction' in patch
            ? (patch.introduction ?? null)
            : (profile?.introduction ?? null),
      }
      const { error } = await supabase
        .from('profile')
        .upsert({ user_id: uid, ...next }, { onConflict: 'user_id' })
      if (error) return { error: error.message }
      setProfile(next)
      return { error: null }
    },
    [uid, authUser, profile, profileStatus],
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
    localStorage.removeItem(POSTS_KEY)
    hadStoredPosts.current = false
    // 프로필 행도 Google 계정 초기값으로 되돌린다. 자기소개는 초기값이 없으므로 함께 지운다.
    if (uid && authUser) {
      await supabase
        .from('profile')
        .upsert(
          {
            user_id: uid,
            name: authUser.base.nickname,
            image: authUser.base.image,
            introduction: null,
          },
          { onConflict: 'user_id' },
        )
    }
    setProfile(null)
    await supabase.auth.signOut()
  }, [uid, authUser])

  const user = useMemo<User | null>(() => {
    if (!authUser) return null
    const { base } = authUser
    return {
      nickname: profile?.name ?? base.nickname,
      email: base.email,
      image: profile ? profile.image : base.image,
      introduction: profile?.introduction ?? null,
    }
  }, [authUser, profile])

  const value = useMemo<Store>(
    () => ({
      ready,
      user,
      profileStatus,
      retryProfile,
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
      profileStatus,
      retryProfile,
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
