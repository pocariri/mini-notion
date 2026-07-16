import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  THEME_INIT_SCRIPT,
  THEME_KEY,
  applyInitialTheme,
  parseStoredTheme,
  resolveTheme,
} from './theme'
import { setSystemDark } from '../vitest.setup'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('THEME_KEY', () => {
  test('기존 키 네이밍 관례를 따른다', () => {
    expect(THEME_KEY).toBe('mini-notion:theme')
  })
})

describe('parseStoredTheme — 저장값 검증', () => {
  test('유효 리터럴은 그대로 돌려준다', () => {
    expect(parseStoredTheme('light')).toBe('light')
    expect(parseStoredTheme('dark')).toBe('dark')
  })

  test('손상값·부재는 null(선택 없음)로 해석한다', () => {
    expect(parseStoredTheme('banana')).toBeNull()
    expect(parseStoredTheme('')).toBeNull()
    expect(parseStoredTheme(null)).toBeNull()
  })
})

describe('resolveTheme — 유효 테마 도출 규칙', () => {
  test('저장된 선택이 있으면 OS 설정과 무관하게 그 값이다', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  test('선택이 없으면 OS 다크 여부를 따른다', () => {
    expect(resolveTheme(null, true)).toBe('dark')
    expect(resolveTheme(null, false)).toBe('light')
  })

  test('손상 저장값도 선택 없음과 동일하게 처리된다', () => {
    expect(resolveTheme(parseStoredTheme('banana'), true)).toBe('dark')
    expect(resolveTheme(parseStoredTheme('banana'), false)).toBe('light')
  })
})

describe('applyInitialTheme — 첫 페인트 전 부팅 적용 (인라인 스크립트와 동일 로직)', () => {
  test('저장된 선택이 있으면 OS와 무관하게 그 값을 data-theme에 설정한다', () => {
    localStorage.setItem(THEME_KEY, 'dark')

    applyInitialTheme()

    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  test('저장값이 없으면 OS 다크 여부를 따른다', () => {
    setSystemDark(true)

    applyInitialTheme()

    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  test('손상 저장값은 선택 없음으로 취급해 OS 설정을 따른다', () => {
    localStorage.setItem(THEME_KEY, 'banana')
    setSystemDark(false)

    applyInitialTheme()

    expect(document.documentElement.dataset.theme).toBe('light')
  })

  test('localStorage 접근이 실패해도 예외 없이 OS 설정으로 폴백한다(FR-017)', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage denied')
    })
    setSystemDark(true)

    expect(() => applyInitialTheme()).not.toThrow()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  test('어떤 경로에서도 localStorage에 쓰지 않는다(불변 조건 2)', () => {
    const setItem = vi.spyOn(localStorage, 'setItem')
    setSystemDark(true)

    applyInitialTheme()

    expect(setItem).not.toHaveBeenCalled()
    expect(localStorage.getItem(THEME_KEY)).toBeNull()
  })
})

describe('THEME_INIT_SCRIPT — 레이아웃에 삽입되는 직렬화 IIFE', () => {
  test('실제 스크립트 문자열을 실행하면 applyInitialTheme과 같은 결과를 낸다', () => {
    localStorage.setItem(THEME_KEY, 'dark')

    new Function(THEME_INIT_SCRIPT)()

    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  test('저장값 없음 + OS 다크에서도 스크립트가 다크를 설정한다', () => {
    setSystemDark(true)

    new Function(THEME_INIT_SCRIPT)()

    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
