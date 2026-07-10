import { describe, test, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { StoreProvider, useStore } from './store'

const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider>{children}</StoreProvider>
)

describe('useStore', () => {
  test('createPost는 새 글을 목록 맨 앞에 추가하고 id를 반환한다', () => {
    const { result } = renderHook(() => useStore(), { wrapper })

    let id = ''
    act(() => {
      id = result.current.createPost('제목', '내용')
    })

    expect(id).toBeTruthy()
    expect(result.current.posts[0]).toMatchObject({
      id,
      title: '제목',
      content: '내용',
      favorite: false,
      deletedAt: null,
    })
  })

  test('createPost로 만든 글은 localStorage(mini-notion:posts)에 저장된다', () => {
    const { result } = renderHook(() => useStore(), { wrapper })

    act(() => {
      result.current.createPost('저장 확인')
    })

    const raw = localStorage.getItem('mini-notion:posts')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!)[0].title).toBe('저장 확인')
  })

  test('trashPost는 글을 영구 삭제하지 않고 deletedAt만 채운다', () => {
    const { result } = renderHook(() => useStore(), { wrapper })

    let id = ''
    act(() => {
      id = result.current.createPost('버릴 글')
    })
    act(() => {
      result.current.trashPost(id)
    })

    const post = result.current.posts.find((p) => p.id === id)
    expect(post).toBeDefined()
    expect(post!.deletedAt).not.toBeNull()
  })
})
