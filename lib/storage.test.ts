import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

// 스토리지 경계 모킹 — lib/storage.ts는 lib/supabase.ts 싱글턴만 통해 Supabase와 통신한다.
const storageMock = vi.hoisted(() => {
  const state = {
    lastBucket: '' as string,
    uploadError: null as { message: string } | null,
    removeRejects: false,
  }
  const upload = vi.fn(async () => {
    if (state.uploadError) return { data: null, error: state.uploadError }
    return { data: {}, error: null }
  })
  const remove = vi.fn(async () => {
    if (state.removeRejects) throw new Error('network down')
    return { data: null, error: null }
  })
  return { state, upload, remove }
})

vi.mock('./supabase', () => ({
  supabase: {
    storage: {
      from: (bucket: string) => {
        storageMock.state.lastBucket = bucket
        return { upload: storageMock.upload, remove: storageMock.remove }
      },
    },
  },
}))

import { profileImageUrl, uploadProfileImage, removeProfileImage } from './storage'

beforeEach(() => {
  storageMock.state.lastBucket = ''
  storageMock.state.uploadError = null
  storageMock.state.removeRejects = false
  storageMock.upload.mockClear()
  storageMock.remove.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('profileImageUrl — 환경변수(앞부분) + image_path(뒷부분) 조립', () => {
  test('null이면 null을 그대로 돌려준다', () => {
    expect(profileImageUrl(null)).toBeNull()
  })

  test('base 끝 슬래시를 정규화해 이중 슬래시 없이 조립한다', () => {
    // vitest.setup.ts의 base는 끝에 /가 붙어 있다 — 그대로 이으면 //가 된다.
    expect(profileImageUrl('abc.png')).toBe(
      'https://test.supabase.co/storage/v1/object/public/profile-image/abc.png',
    )
  })
})

describe('uploadProfileImage — profile-image 버킷에 uuidv4 파일명 업로드', () => {
  test('uuid.확장자 파일명으로 업로드하고 그 경로를 돌려준다', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '11111111-2222-4333-8444-555555555555',
    )
    const file = new File(['img'], 'cat.png', { type: 'image/png' })

    const { path, error } = await uploadProfileImage(file)

    expect(error).toBeNull()
    expect(path).toBe('11111111-2222-4333-8444-555555555555.png')
    expect(storageMock.state.lastBucket).toBe('profile-image')
    expect(storageMock.upload).toHaveBeenCalledWith(
      '11111111-2222-4333-8444-555555555555.png',
      file,
      { contentType: 'image/png' },
    )
  })

  test('파일명에 확장자가 없으면 MIME 서브타입을 확장자로 쓴다', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '11111111-2222-4333-8444-555555555555',
    )
    const file = new File(['img'], 'photo', { type: 'image/webp' })

    const { path } = await uploadProfileImage(file)

    expect(path).toBe('11111111-2222-4333-8444-555555555555.webp')
  })

  test('업로드 실패 시 path 없이 에러 메시지를 돌려준다', async () => {
    storageMock.state.uploadError = { message: 'quota exceeded' }
    const file = new File(['img'], 'cat.png', { type: 'image/png' })

    const { path, error } = await uploadProfileImage(file)

    expect(path).toBeNull()
    expect(error).toBe('quota exceeded')
  })
})

describe('removeProfileImage — 이전 파일 정리 (best-effort)', () => {
  test('경로 배열로 remove를 호출한다', async () => {
    await removeProfileImage('old.png')

    expect(storageMock.state.lastBucket).toBe('profile-image')
    expect(storageMock.remove).toHaveBeenCalledWith(['old.png'])
  })

  test('삭제가 실패해도 예외를 던지지 않는다', async () => {
    storageMock.state.removeRejects = true

    await expect(removeProfileImage('old.png')).resolves.toBeUndefined()
  })
})
