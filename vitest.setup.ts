// lib/storage.ts가 모듈 로드 시점에 요구하는 공개 URL 앞부분(스토리지 주소 + 버킷명).
// 끝 슬래시를 일부러 붙여 조립 시 정규화까지 실전과 같이 검증한다.
process.env.NEXT_PUBLIC_PROFILE_IMAGE_BASE_URL =
  'https://test.supabase.co/storage/v1/object/public/profile-image/'

import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// 이 jsdom 빌드는 Web Storage(localStorage)를 구현하지 않고 빈 객체({})로 노출한다.
// 스토어(lib/store.tsx)는 브라우저 localStorage를 실제 경계로 사용하므로,
// 테스트 환경에 실제 동작하는 완전한 in-memory Storage 구현을 제공한다.
// (스토어 로직을 목으로 대체하는 것이 아니라, 외부 API 경계를 실제 구현으로 채우는 것)
class MemoryStorage implements Storage {
  private store = new Map<string, string>()

  get length(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }
}

const storage = new MemoryStorage()
Object.defineProperty(globalThis, 'localStorage', {
  value: storage,
  writable: true,
  configurable: true,
})
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: storage,
    writable: true,
    configurable: true,
  })
}

// 이 jsdom 빌드는 matchMedia도 구현하지 않는다(window.matchMedia === undefined).
// 테마 기능은 '(prefers-color-scheme: dark)'를 실제 경계로 사용하므로,
// Storage와 같은 접근으로 동작하는 in-memory MediaQueryList를 제공한다.
// 테스트는 setSystemDark()로 OS 다크 모드 상태를 제어하고 change 이벤트를 받는다.
const DARK_QUERY = '(prefers-color-scheme: dark)'
type MediaChangeListener = (ev: MediaQueryListEvent) => void

let systemDark = false
const darkListeners = new Set<MediaChangeListener>()

function memoryMatchMedia(query: string): MediaQueryList {
  const isDarkQuery = query === DARK_QUERY
  const mql = {
    get matches() {
      return isDarkQuery && systemDark
    },
    media: query,
    onchange: null,
    addEventListener(type: string, listener: MediaChangeListener) {
      if (type === 'change' && isDarkQuery) darkListeners.add(listener)
    },
    removeEventListener(type: string, listener: MediaChangeListener) {
      if (type === 'change' && isDarkQuery) darkListeners.delete(listener)
    },
    // 레거시 API — 오래된 코드 경로도 실제처럼 동작하게 한다.
    addListener(listener: MediaChangeListener) {
      if (isDarkQuery) darkListeners.add(listener)
    },
    removeListener(listener: MediaChangeListener) {
      if (isDarkQuery) darkListeners.delete(listener)
    },
    dispatchEvent() {
      return true
    },
  }
  return mql as unknown as MediaQueryList
}

export function setSystemDark(value: boolean): void {
  if (systemDark === value) return
  systemDark = value
  const event = { matches: value, media: DARK_QUERY } as MediaQueryListEvent
  darkListeners.forEach((listener) => listener(event))
}

Object.defineProperty(globalThis, 'matchMedia', {
  value: memoryMatchMedia,
  writable: true,
  configurable: true,
})
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    value: memoryMatchMedia,
    writable: true,
    configurable: true,
  })
}

// 각 테스트 후 렌더 트리·저장소·OS 테마 상태를 초기화해 테스트 간 격리를 보장한다.
afterEach(() => {
  cleanup()
  localStorage.clear()
  systemDark = false
  darkListeners.clear()
  document.documentElement.removeAttribute('data-theme')
})
