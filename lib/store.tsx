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
import { THEME_KEY, parseStoredTheme, type Theme } from './theme'

export type User = {
  nickname: string
  email: string
  image: string | null
  introduction: string | null
}

// public.page 한 행. 저장 구조가 확정되어 있어 이 네 가지가 담을 수 있는 전부다.
// (즐겨찾기·수정 시각·삭제 표시를 담을 칼럼이 없어 해당 기능이 존재하지 않는다.)
export type Page = {
  id: string
  title: string
  content: string
  createdAt: number
}

// 목록이 "비었다"와 "아직 모른다"와 "못 불러왔다"는 서로 다른 상태다.
// 이걸 구분하지 않으면 로딩 중에 "페이지가 없어요"가 번쩍인다.
export type PagesStatus = 'loading' | 'ready' | 'error'
export type SaveStatus = 'saved' | 'saving' | 'error'
// 프로필 행 조회의 명시적 상태 — profile이 null인 것만으로는
// "로딩 중 / 행 없음 / 조회 실패"를 구분할 수 없어서 따로 둔다.
export type ProfileStatus = 'loading' | 'ready' | 'error'

type Store = {
  ready: boolean
  user: User | null
  pages: Page[]
  pagesStatus: PagesStatus
  saveStatus: SaveStatus
  notice: string | null
  dismissNotice: () => void
  theme: Theme
  toggleTheme: () => void
  profileStatus: ProfileStatus
  retryProfile: () => void
  login: () => Promise<{ error: string | null }>
  logout: () => Promise<void>
  updateUser: (patch: Partial<User>) => Promise<{ error: string | null }>
  createPage: (title?: string, content?: string) => Promise<string | null>
  updatePage: (id: string, patch: Partial<Pick<Page, 'title' | 'content'>>) => void
  deletePage: (id: string) => Promise<void>
  discardIfEmpty: (id: string) => Promise<void>
  flushPending: () => Promise<void>
  resetAll: () => Promise<void>
  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

// 입력이 멈춘 뒤 저장까지의 지연. 타이핑을 끊지 않으면서 요청을 합칠 만큼 짧다.
const SAVE_DEBOUNCE_MS = 800

// 접힘 여부는 계정이 아니라 기기·브라우저 단위 설정이므로 uid를 붙이지 않는다.
const SIDEBAR_KEY = 'mini-notion:sidebar-collapsed'
// 가짜 로그인 시절의 사용자 키 — 실제 세션과 섞이지 않도록 초기화 시 제거한다.
const LEGACY_USER_KEY = 'mini-notion:user'
// 프로필이 Supabase(public.profile)로 이전되기 전의 로컬 오버레이 키 — 초기화 시 제거한다.
const LEGACY_OVERLAY_PREFIX = 'mini-notion:user-overlay:'
// 페이지가 Supabase(public.page)로 이전되기 전의 로컬 저장 키 — 초기화 시 제거한다.
// 이 브라우저에 남은 옛 글은 서버로 옮기지 않는다.
const LEGACY_PAGES_KEY = 'mini-notion:posts'

// Supabase public.profile 행(auth.users와 1:1). 최초 로그인 시 DB 트리거가
// Google 이름·사진을 초기값으로 만들어 주고, /me에서 수정하면 이 행을 덮어쓴다.
// image는 "명시적으로 제거"를 null로 저장한다(행이 있으면 DB 값이 진실).
// introduction은 자기소개(선택 항목) — "없음"의 정규 표현은 null이며 ''를 저장하지 않는다.
type Profile = {
  name: string | null
  image: string | null
  introduction: string | null
}

type PageRow = {
  id: string
  created_at: string
  title: string | null
  content: string | null
  user_id: string
}

type AuthUser = { uid: string; base: User }

const StoreContext = createContext<Store | null>(null)

// 전환 프레임에만 트랜지션을 억제하며 <html data-theme>를 바꾼다(FR-003a).
// 강제 리플로우로 억제 상태의 스타일 재계산을 확정한 뒤 즉시 해제한다.
function switchDomTheme(next: Theme) {
  const root = document.documentElement
  root.classList.add('theme-switching')
  root.dataset.theme = next
  void root.offsetWidth
  root.classList.remove('theme-switching')
}

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

// DB는 title/content에 NULL을 허용한다. UI 전체가 문자열을 전제하므로 경계에서 한 번 정규화한다.
function pageFromRow(row: PageRow): Page {
  return {
    id: row.id,
    title: row.title ?? '',
    content: row.content ?? '',
    createdAt: Date.parse(row.created_at),
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [pages, setPages] = useState<Page[]>([])
  const [pagesStatus, setPagesStatus] = useState<PagesStatus>('loading')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [notice, setNotice] = useState<string | null>(null)
  // 유효 테마. 초기값은 레이아웃 인라인 스크립트가 첫 페인트 전에 설정한
  // <html data-theme>에서 읽는다(SSR 중에는 document가 없어 클라이언트 효과에서 수행).
  const [theme, setTheme] = useState<Theme>('light')
  // 사용자가 토글로 직접 선택한 적이 있는지 — 선택 전에만 OS 변경을 따라간다(FR-015·016).
  const hasThemeChoice = useRef(false)
  // 접힘 여부는 계정이 아니라 기기·브라우저 단위 설정이다(FR-017).
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // 저장 대기열. 페이지별로 "아직 서버에 못 보낸 변경"과 그 타이머를 들고 있다.
  const pendingRef = useRef(new Map<string, Partial<Pick<Page, 'title' | 'content'>>>())
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  // 같은 페이지에 저장이 겹치면 응답 순서가 뒤집혀 옛 값이 최종본이 될 수 있다.
  // 페이지당 한 번에 하나만 보내고, 그 사이 쌓인 변경은 끝난 뒤 이어서 보낸다.
  const inflightRef = useRef(new Set<string>())
  // 콜백이 최신 목록을 stale closure 없이 읽기 위한 거울.
  const pagesRef = useRef<Page[]>([])
  pagesRef.current = pages

  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('loading')
  // retryProfile이 올릴 때마다 조회 effect가 다시 돈다.
  const [profileFetchCount, setProfileFetchCount] = useState(0)

  useEffect(() => {
    const initial = parseStoredTheme(document.documentElement.dataset.theme ?? null)
    if (initial) setTheme(initial)
    try {
      hasThemeChoice.current = parseStoredTheme(localStorage.getItem(THEME_KEY)) !== null
    } catch {
      hasThemeChoice.current = false
    }
    const mql =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null
    const onSystemThemeChange = (e: MediaQueryListEvent) => {
      if (hasThemeChoice.current) return
      const next: Theme = e.matches ? 'dark' : 'light'
      switchDomTheme(next)
      setTheme(next)
    }
    mql?.addEventListener('change', onSystemThemeChange)

    localStorage.removeItem(LEGACY_USER_KEY)
    localStorage.removeItem(LEGACY_PAGES_KEY)
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith(LEGACY_OVERLAY_PREFIX)) localStorage.removeItem(key)
    }
    // true 외의 모든 값(부재·손상·비 boolean)은 펼침 기본값으로 정규화한다.
    setSidebarCollapsed(loadJSON<unknown>(SIDEBAR_KEY) === true)

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
      mql?.removeEventListener('change', onSystemThemeChange)
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

  // 계정의 페이지를 서버에서 불러온다. 계정이 바뀌거나 로그아웃하면 이전 목록을 즉시 버린다.
  // 소유자 필터는 명확성과 전송량을 위한 것이지 보안 경계가 아니다 — RLS가 애초에 남의 행을 주지 않는다.
  useEffect(() => {
    // 계정이 바뀌거나 로그아웃하면 이전 목록을 먼저 버린다. 새 목록이 도착할 때까지
    // 남겨 두면 다른 사람의 페이지가 한 프레임이라도 화면에 보인다.
    setPages([])
    if (!ready) return
    if (!uid) {
      setPagesStatus('ready')
      return
    }
    setPagesStatus('loading')
    let cancelled = false
    supabase
      .from('page')
      .select('id, created_at, title, content, user_id')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setPagesStatus('error')
          return
        }
        setPages(((data ?? []) as PageRow[]).map(pageFromRow))
        setPagesStatus('ready')
      })
    return () => {
      cancelled = true
    }
  }, [ready, uid])

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    switchDomTheme(next)
    hasThemeChoice.current = true
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      // 저장 불가(프라이빗 모드·용량 초과)여도 세션 내 전환은 계속 동작한다(FR-017).
    }
    setTheme(next)
  }, [theme])

  useEffect(() => {
    if (!ready) return
    localStorage.setItem(SIDEBAR_KEY, JSON.stringify(sidebarCollapsed))
  }, [sidebarCollapsed, ready])

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

  const dismissNotice = useCallback(() => setNotice(null), [])

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

  // 대기 중인 변경을 서버로 보낸다. 저장 중 쌓인 변경은 같은 루프에서 이어서 보내
  // 요청이 항상 입력 순서대로 도착하게 한다.
  const flushOne = useCallback(async (id: string) => {
    if (inflightRef.current.has(id)) return
    let patch = pendingRef.current.get(id)
    if (!patch) return
    inflightRef.current.add(id)
    try {
      while (patch) {
        pendingRef.current.delete(id)
        setSaveStatus('saving')
        const { error } = await supabase.from('page').update(patch).eq('id', id)
        if (error) {
          // 사용자가 입력한 내용은 되돌리지 않는다. 되돌리면 방금 쓴 글이 사라진다.
          setSaveStatus('error')
          return
        }
        setSaveStatus('saved')
        patch = pendingRef.current.get(id)
      }
    } finally {
      inflightRef.current.delete(id)
    }
  }, [])

  const createPage = useCallback(
    async (title = '', content = ''): Promise<string | null> => {
      // 소유자 없는 페이지는 존재할 수 없다. RLS도 이를 거부하지만, 요청 자체를
      // 보내지 않는 편이 사용자에게 더 정직하다.
      if (!uid) return null
      // 서버 왕복을 기다리지 않고 바로 편집기를 열 수 있도록 id를 여기서 만든다.
      const id = crypto.randomUUID()
      setPages((ps) => [{ id, title, content, createdAt: Date.now() }, ...ps])

      const { data, error } = await supabase
        .from('page')
        .insert({ id, title, content, user_id: uid })
        .select()
        .single()

      if (error) {
        setPages((ps) => ps.filter((p) => p.id !== id))
        setNotice('페이지를 만들지 못했어요. 잠시 후 다시 시도해 주세요.')
        return null
      }
      // created_at은 서버 값이 진실이다. 낙관적으로 쓴 클라이언트 시각을 교체한다.
      if (data) {
        const saved = pageFromRow(data as PageRow)
        setPages((ps) => ps.map((p) => (p.id === id ? saved : p)))
      }
      return id
    },
    [uid],
  )

  const updatePage = useCallback(
    (id: string, patch: Partial<Pick<Page, 'title' | 'content'>>) => {
      // 세션이 만료된 뒤의 저장은 서버가 어차피 거부한다. 보내지 않는다.
      if (!uid) return
      setPages((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)))
      pendingRef.current.set(id, { ...(pendingRef.current.get(id) ?? {}), ...patch })

      const existing = timersRef.current.get(id)
      if (existing) clearTimeout(existing)
      timersRef.current.set(
        id,
        setTimeout(() => {
          timersRef.current.delete(id)
          void flushOne(id)
        }, SAVE_DEBOUNCE_MS),
      )
    },
    [uid, flushOne],
  )

  const flushPending = useCallback(async () => {
    for (const timer of timersRef.current.values()) clearTimeout(timer)
    timersRef.current.clear()
    const ids = [...pendingRef.current.keys()]
    await Promise.all(ids.map((id) => flushOne(id)))
  }, [flushOne])

  // 화면에서 먼저 지우고 서버에 보낸다. 실패하면 원래 자리에 되돌린다 —
  // 화면과 서버가 어긋난 채 남으면 사용자는 지운 줄 알고 나갔다가 살아 있는 걸 보게 된다.
  const removePage = useCallback(async (id: string, announce: boolean) => {
    const index = pagesRef.current.findIndex((p) => p.id === id)
    if (index < 0) return
    const removed = pagesRef.current[index]

    pendingRef.current.delete(id)
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }

    setPages((ps) => ps.filter((p) => p.id !== id))
    const { error } = await supabase.from('page').delete().eq('id', id)
    if (error) {
      // 원래 자리에 되돌린다. 끝에 붙이면 사용자가 목록이 뒤섞인 것으로 본다.
      setPages((ps) => {
        const next = [...ps]
        next.splice(Math.min(index, next.length), 0, removed)
        return next
      })
      // 사용자가 직접 요청한 삭제만 실패를 알린다. 빈 페이지 자동 정리는
      // 사용자가 요청한 적 없으므로 조용히 실패한다.
      if (announce) setNotice('페이지를 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.')
    }
  }, [])

  // 삭제 확인은 호출자(UI)의 몫이다. 스토어가 확인을 물으면 아래 discardIfEmpty가
  // 확인 없이 지울 수 없게 된다.
  const deletePage = useCallback(
    async (id: string) => {
      await removePage(id, true)
    },
    [removePage],
  )

  // 새로 만들고 아무것도 쓰지 않은 페이지가 서버에 쌓이지 않도록 이탈 시 정리한다.
  const discardIfEmpty = useCallback(
    async (id: string) => {
      const page = pagesRef.current.find((p) => p.id === id)
      if (!page || page.title !== '' || page.content !== '') return
      await removePage(id, false)
    },
    [removePage],
  )

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((c) => !c)
  }, [])

  const resetAll = useCallback(async () => {
    // 프로필 행도 Google 계정 초기값으로 되돌린다. 자기소개는 초기값이 없으므로 함께 지운다.
    if (uid && authUser) {
      // 로컬만 비우면 재로그인 시 되살아난다. 서버에서도 지운다.
      await supabase.from('page').delete().eq('user_id', uid)
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
    pendingRef.current.clear()
    for (const timer of timersRef.current.values()) clearTimeout(timer)
    timersRef.current.clear()
    setPages([])
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
      pages,
      pagesStatus,
      saveStatus,
      notice,
      dismissNotice,
      theme,
      toggleTheme,
      profileStatus,
      retryProfile,
      login,
      logout,
      updateUser,
      createPage,
      updatePage,
      deletePage,
      discardIfEmpty,
      flushPending,
      resetAll,
      sidebarCollapsed,
      toggleSidebar,
    }),
    [
      ready,
      user,
      pages,
      pagesStatus,
      saveStatus,
      notice,
      dismissNotice,
      theme,
      toggleTheme,
      profileStatus,
      retryProfile,
      login,
      logout,
      updateUser,
      createPage,
      updatePage,
      deletePage,
      discardIfEmpty,
      flushPending,
      resetAll,
      sidebarCollapsed,
      toggleSidebar,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used within StoreProvider')
  return store
}
