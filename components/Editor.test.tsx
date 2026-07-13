import { describe, test, expect, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
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

function renderEditor(post: Post) {
  return render(
    <Editor
      post={post}
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
}

describe('Editor 고양이 커버 통합 (US1)', () => {
  test('커버 이미지가 제목 입력창보다 앞(위)에 렌더된다 (FR-001)', () => {
    renderEditor(makePost())
    const cover = screen.getByTestId('cover-image')
    const title = screen.getByPlaceholderText('제목 없음')
    expect(
      cover.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  test('다른 글로 전환하면 커버가 새 src로 다시 로드된다 (FR-007, FR-008)', () => {
    const { rerender } = renderEditor(makePost({ id: 'post-1' }))
    const src1 = screen.getByTestId('cover-image').getAttribute('src')

    rerender(
      <Editor
        post={makePost({ id: 'post-2' })}
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
    const src2 = screen.getByTestId('cover-image').getAttribute('src')
    expect(src2).not.toBe(src1)
  })

  test('휴지통(readOnly) 글에서도 커버가 렌더된다', () => {
    renderEditor(makePost({ deletedAt: Date.now() }))
    expect(screen.getByTestId('cover-image')).toBeInTheDocument()
  })
})

// 아래 두 테스트는 구성상 처음부터 통과하는 회귀 가드다(TDD 드라이버 아님).
// 커버 로딩·실패가 편집을 차단하지 않는다는 스펙 보장(FR-005, FR-006, SC-003, SC-004)이
// 이후 변경으로 깨지지 않도록 지킨다.
describe('Editor 고양이 커버 회귀 가드 (US2·US3)', () => {
  test('커버가 로딩 중(load 이벤트 전)에도 제목 타이핑이 즉시 반영된다 (FR-006, SC-003)', async () => {
    const user = userEvent.setup()
    render(<Harness initialPost={makePost()} />)

    expect(screen.getByTestId('cover-skeleton')).toBeInTheDocument()
    const titleInput = screen.getByPlaceholderText('제목 없음')
    await user.type(titleInput, '고양이 일지')

    expect(titleInput).toHaveValue('고양이 일지')
    expect(screen.getByTestId('cover-skeleton')).toBeInTheDocument()
  })

  test('커버 로드 실패 후에도 내용 편집과 카운터가 정상 동작한다 (FR-005, SC-004)', async () => {
    const user = userEvent.setup()
    render(<Harness initialPost={makePost({ content: '' })} />)

    fireEvent.error(screen.getByTestId('cover-image'))
    expect(screen.getByTestId('cover-fallback')).toBeInTheDocument()

    const contentInput = screen.getByPlaceholderText('여기에 내용을 입력하세요.')
    await user.type(contentInput, '안녕')

    expect(contentInput).toHaveValue('안녕')
    expect(screen.getByText('2자')).toBeInTheDocument()
  })
})
