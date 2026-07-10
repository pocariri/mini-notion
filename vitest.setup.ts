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

// 각 테스트 후 렌더 트리와 저장소를 초기화해 테스트 간 격리를 보장한다.
afterEach(() => {
  cleanup()
  localStorage.clear()
})
