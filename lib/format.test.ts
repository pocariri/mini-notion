import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { formatDate, charCount } from './format'

describe('formatDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // 결정적 테스트를 위해 현재 시각을 고정한다(원칙 V: 동작 검증은 재현 가능해야 한다).
    vi.setSystemTime(new Date('2026-07-09T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('1분 미만은 "방금"으로 표시한다', () => {
    expect(formatDate(Date.now() - 30_000)).toBe('방금')
  })

  test('1시간 미만은 "N분 전"으로 표시한다', () => {
    expect(formatDate(Date.now() - 5 * 60_000)).toBe('5분 전')
  })

  test('하루 미만은 "N시간 전"으로 표시한다', () => {
    expect(formatDate(Date.now() - 3 * 3_600_000)).toBe('3시간 전')
  })

  test('하루 이상 지나면 "M월 D일" 형식으로 표시한다', () => {
    expect(formatDate(Date.now() - 2 * 86_400_000)).toBe('7월 7일')
  })
})

describe('charCount', () => {
  test('빈 문자열은 0을 반환한다', () => {
    expect(charCount('')).toBe(0)
  })

  test('한글 문자열의 길이를 반환한다', () => {
    expect(charCount('안녕하세요')).toBe(5)
  })

  test('공백과 줄바꿈을 포함해서 센다', () => {
    expect(charCount('a b\nc')).toBe(5)
  })

  test('공백만 있어도 그 개수를 센다', () => {
    expect(charCount('  ')).toBe(2)
  })

  test('이모지는 코드 유닛 수로 센다', () => {
    expect(charCount('👍')).toBe(2)
  })
})
