import { describe, test, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Editor from './Editor'
import type { Post } from '@/lib/store'

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    title: '',
    content: '',
    favorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
    ...overrides,
  }
}

function noop() {}

type HarnessProps = {
  initialPost: Post
}

// post.content를 로컬 상태로 보유하고 onPatch로 갱신하는 소형 테스트 하네스.
// Editor는 controlled 컴포넌트이므로 실제 타이핑 갱신을 검증하려면 상태를 가진 래퍼가 필요하다.
function Harness({ initialPost }: HarnessProps) {
  const [post, setPost] = useState(initialPost)
  return (
    <Editor
      post={post}
      navLabel="워크스페이스"
      nickname="테스터"
      focusTitle={false}
      onPatch={(patch) => setPost((p) => ({ ...p, ...patch }))}
      onToggleFavorite={noop}
      onTrash={noop}
      onRestore={noop}
      onDeleteForever={noop}
    />
  )
}

describe('Editor 글자 수 카운터', () => {
  test('내용이 비어있으면 0자를 표시한다 (C2-1)', () => {
    render(<Harness initialPost={makePost({ content: '' })} />)
    expect(screen.getByText('0자')).toBeInTheDocument()
  })

  test('내용이 있으면 해당 글자 수를 표시한다 (C2-2)', () => {
    render(<Harness initialPost={makePost({ content: '안녕하세요' })} />)
    expect(screen.getByText('5자')).toBeInTheDocument()
  })

  test('타이핑하면 카운터가 즉시 갱신된다 (C2-3)', async () => {
    const user = userEvent.setup()
    render(<Harness initialPost={makePost({ content: '' })} />)

    const contentInput = screen.getByPlaceholderText('여기에 내용을 입력하세요.')
    await user.type(contentInput, 'abc')

    expect(screen.getByText('3자')).toBeInTheDocument()
  })

  test('제목만 변경하면 카운터는 변하지 않는다 (C2-5)', async () => {
    const user = userEvent.setup()
    render(<Harness initialPost={makePost({ title: '', content: '안녕' })} />)

    const titleInput = screen.getByPlaceholderText('제목 없음')
    await user.type(titleInput, '새 제목')

    expect(screen.getByText('2자')).toBeInTheDocument()
  })

  test('타이핑 없이 렌더해도 기존 글의 글자 수를 표시한다', () => {
    render(
      <Editor
        post={makePost({ content: '안녕하세요' })}
        navLabel="워크스페이스"
        nickname="테스터"
        focusTitle={false}
        onPatch={noop}
        onToggleFavorite={noop}
        onTrash={noop}
        onRestore={noop}
        onDeleteForever={noop}
      />
    )
    expect(screen.getByText('5자')).toBeInTheDocument()
  })

  test('다른 글로 전환(rerender)하면 카운터가 새 글자 수로 갱신된다 (C2-6)', () => {
    const { rerender } = render(
      <Editor
        post={makePost({ id: 'post-1', content: '안녕하세요' })}
        navLabel="워크스페이스"
        nickname="테스터"
        focusTitle={false}
        onPatch={noop}
        onToggleFavorite={noop}
        onTrash={noop}
        onRestore={noop}
        onDeleteForever={noop}
      />
    )
    expect(screen.getByText('5자')).toBeInTheDocument()

    rerender(
      <Editor
        post={makePost({ id: 'post-2', content: 'ab' })}
        navLabel="워크스페이스"
        nickname="테스터"
        focusTitle={false}
        onPatch={noop}
        onToggleFavorite={noop}
        onTrash={noop}
        onRestore={noop}
        onDeleteForever={noop}
      />
    )
    expect(screen.getByText('2자')).toBeInTheDocument()
  })

  test('휴지통(readOnly) 글도 카운터를 표시한다 (C2-7)', () => {
    render(
      <Editor
        post={makePost({ content: '안녕하세요', deletedAt: Date.now() })}
        navLabel="워크스페이스"
        nickname="테스터"
        focusTitle={false}
        onPatch={noop}
        onToggleFavorite={noop}
        onTrash={noop}
        onRestore={noop}
        onDeleteForever={noop}
      />
    )
    expect(screen.getByText('5자')).toBeInTheDocument()
  })
})
