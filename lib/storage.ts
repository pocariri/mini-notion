import { supabase } from './supabase'

const BUCKET = 'profile-image'

// 공개 URL의 앞부분(스토리지 주소 + 버킷명). 뒷부분(파일명)은 profile.image_path에 저장된다.
const rawBase = process.env.NEXT_PUBLIC_PROFILE_IMAGE_BASE_URL

if (!rawBase) {
  throw new Error(
    'NEXT_PUBLIC_PROFILE_IMAGE_BASE_URL가 필요합니다 (.env.local 참고: .env.example).',
  )
}

// 끝 슬래시를 정규화해 조립 시 이중 슬래시를 막는다.
const base = rawBase.replace(/\/+$/, '')

// image_path(버킷명 이후 부분)를 완전한 공개 URL로 조립한다.
export function profileImageUrl(path: string | null): string | null {
  return path ? `${base}/${path}` : null
}

// MIME 서브타입(png, webp…)은 그대로 확장자로 쓸 수 있어 이름에 확장자가 없을 때의 폴백으로 충분하다.
function fileExtension(file: File): string {
  const fromName = file.name.split('.').pop()
  if (fromName && fromName !== file.name) return fromName.toLowerCase()
  return file.type.split('/')[1] ?? 'bin'
}

// uuidv4 파일명으로 업로드하고 저장된 경로(파일명)를 돌려준다.
export async function uploadProfileImage(
  file: File,
): Promise<{ path: string | null; error: string | null }> {
  const path = `${crypto.randomUUID()}.${fileExtension(file)}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type })
  if (error) return { path: null, error: error.message }
  return { path, error: null }
}

// 교체·제거로 더 이상 참조되지 않는 파일 정리. 실패해도 저장을 되돌릴 이유는 없다(best-effort).
export async function removeProfileImage(path: string): Promise<void> {
  try {
    await supabase.storage.from(BUCKET).remove([path])
  } catch {
    // 무시 — 쓰레기 파일 1개가 저장 실패보다 낫다.
  }
}
