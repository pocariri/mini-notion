import { describe, test, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CatCover from './CatCover'

describe('CatCover 커버 이미지 (US1)', () => {
  test('이미지 src가 cataas 엔드포인트 + width·캐시버스터 쿼리를 갖는다 (FR-002, FR-009)', () => {
    render(<CatCover />)
    const img = screen.getByTestId('cover-image')
    const src = img.getAttribute('src') ?? ''
    expect(src.startsWith('https://cataas.com/cat/cute?')).toBe(true)
    const params = new URL(src).searchParams
    expect(params.get('width')).toBe('760')
    // 캐시버스터는 `_` 파라미터여야 한다 — cataas가 쿼리를 스키마 검증하며
    // `r`은 숫자 전용 예약 파라미터라 문자열 nonce를 넣으면 400을 반환한다(실측).
    expect(params.get('_')).toBeTruthy()
    expect(params.has('r')).toBe(false)
  })

  test('장식 이미지로 alt=""를 갖는다', () => {
    render(<CatCover />)
    expect(screen.getByTestId('cover-image')).toHaveAttribute('alt', '')
  })

  test('load 이벤트 후 이미지가 표시된다 (FR-001)', () => {
    render(<CatCover />)
    const img = screen.getByTestId('cover-image')
    fireEvent.load(img)
    expect(img).toBeVisible()
  })

  test('리렌더해도 src가 바뀌지 않는다 — 재요청 없음 (FR-006)', () => {
    const { rerender } = render(<CatCover />)
    const before = screen.getByTestId('cover-image').getAttribute('src')
    rerender(<CatCover />)
    expect(screen.getByTestId('cover-image').getAttribute('src')).toBe(before)
  })

  test('마운트마다 서로 다른 src(새 랜덤 요청)를 생성한다 (FR-009)', () => {
    const first = render(<CatCover />)
    const src1 = screen.getByTestId('cover-image').getAttribute('src')
    first.unmount()
    render(<CatCover />)
    const src2 = screen.getByTestId('cover-image').getAttribute('src')
    expect(src2).not.toBe(src1)
  })
})

describe('CatCover 스켈레톤 로딩 (US2)', () => {
  test('마운트 직후 스켈레톤이 표시되고 이미지는 보이지 않는다 (FR-003)', () => {
    render(<CatCover />)
    expect(screen.getByTestId('cover-skeleton')).toBeInTheDocument()
    expect(screen.getByTestId('cover-image')).not.toBeVisible()
  })

  test('스켈레톤은 장식 요소로 aria-hidden을 갖는다', () => {
    render(<CatCover />)
    expect(screen.getByTestId('cover-skeleton')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
  })

  test('load 이벤트 후 스켈레톤이 사라지고 같은 자리의 이미지가 보인다 (FR-004)', () => {
    render(<CatCover />)
    fireEvent.load(screen.getByTestId('cover-image'))
    expect(screen.queryByTestId('cover-skeleton')).not.toBeInTheDocument()
    expect(screen.getByTestId('cover-image')).toBeVisible()
  })

  test('로딩 동안 커버에는 스켈레톤·이미지 외 다른 요소(스피너 등)가 없다 (SC-002)', () => {
    const { container } = render(<CatCover />)
    const cover = container.querySelector('.cover')!
    const testids = Array.from(cover.children).map((el) =>
      el.getAttribute('data-testid'),
    )
    expect(testids.sort()).toEqual(['cover-image', 'cover-skeleton'])
  })
})

describe('CatCover 실패 폴백 (US3)', () => {
  test('error 이벤트 후 폴백이 표시되고 스켈레톤·이미지는 사라진다 (FR-005)', () => {
    render(<CatCover />)
    fireEvent.error(screen.getByTestId('cover-image'))
    expect(screen.getByTestId('cover-fallback')).toBeInTheDocument()
    expect(screen.queryByTestId('cover-skeleton')).not.toBeInTheDocument()
    expect(screen.queryByTestId('cover-image')).not.toBeInTheDocument()
  })

  test('폴백은 장식 요소로 aria-hidden을 가지며 오류 문구를 노출하지 않는다', () => {
    render(<CatCover />)
    fireEvent.error(screen.getByTestId('cover-image'))
    const fallback = screen.getByTestId('cover-fallback')
    expect(fallback).toHaveAttribute('aria-hidden', 'true')
    expect(fallback.textContent).toBe('')
  })
})
