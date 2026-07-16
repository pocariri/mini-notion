'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ImagePlus, LogOut, UserRound, X } from 'lucide-react'
import Avatar from '@/components/Avatar'
import { useStore } from '@/lib/store'

type Tab = 'profile' | 'account'

const MAX_NICKNAME = 20
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export default function MePage() {
  const { ready, user, updateUser, logout, resetAll } = useStore()
  const router = useRouter()

  const [tab, setTab] = useState<Tab>('profile')
  const [nickname, setNickname] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ready && !user) router.replace('/login')
  }, [ready, user, router])

  // 폼 초기값은 최초 진입 시 한 번만 사용자 정보에서 가져온다.
  useEffect(() => {
    if (user && !hydrated) {
      setNickname(user.nickname)
      setImage(user.image)
      setHydrated(true)
    }
  }, [user, hydrated])

  if (!ready || !user) {
    return (
      <div className="splash">
        <span className="login-logo">m</span>
      </div>
    )
  }

  const dirty = nickname !== user.nickname || image !== user.image
  const valid = nickname.trim().length > 0

  const handleFile = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      window.alert('이미지 파일만 업로드할 수 있어요.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      window.alert('5MB 이하 이미지만 업로드할 수 있어요.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setImage(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!dirty || !valid || saving) return
    setSaving(true)
    setSaveError(null)
    const trimmed = nickname.trim()
    const { error } = await updateUser({ nickname: trimmed, image })
    setSaving(false)
    if (error) {
      setSaveError('저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
      return
    }
    setNickname(trimmed)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = () => {
    if (!window.confirm('모든 글과 계정 정보를 삭제할까요? 되돌릴 수 없어요.')) return
    resetAll()
    router.replace('/login')
  }

  const previewUser = { ...user, nickname: nickname || user.nickname, image }

  return (
    <main className="workspace">
      <aside className="rail">
        <div className="brand">
          <span className="brand-tile">m</span>
          <span className="brand-name">mini notion</span>
        </div>

        <div className="section-label">설정</div>
        <button
          className={`navitem${tab === 'profile' ? ' active' : ''}`}
          onClick={() => setTab('profile')}
        >
          <UserRound size={15} />
          프로필
        </button>
        <button
          className={`navitem${tab === 'account' ? ' active' : ''}`}
          onClick={() => setTab('account')}
        >
          <LogOut size={15} />
          계정
        </button>

        <div className="rail-spacer" />

        <Link href="/workspace" className="navitem">
          <ArrowLeft size={15} />
          업무로 돌아가기
        </Link>
      </aside>

      <section className="settings-body">
        {tab === 'profile' ? (
          <>
            <h1 className="settings-title">프로필</h1>

            <div className="profile-row">
              <Avatar user={previewUser} size={78} />
              <div>
                <div className="profile-row-actions">
                  <button className="btn" onClick={() => fileRef.current?.click()}>
                    <ImagePlus size={14} />
                    이미지 변경
                  </button>
                  {image && (
                    <button className="btn btn-ghost" onClick={() => setImage(null)}>
                      <X size={14} />
                      제거
                    </button>
                  )}
                </div>
                <p className="hint">JPG · PNG · 5MB 이하</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    handleFile(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </div>
            </div>

            <div className="field-block">
              <div className="section-label" style={{ paddingLeft: 0 }}>
                별명
              </div>
              <label className="field">
                <input
                  type="text"
                  value={nickname}
                  maxLength={MAX_NICKNAME}
                  onChange={(e) => setNickname(e.target.value)}
                />
                <span className="counter">
                  #{nickname.length}/{MAX_NICKNAME}
                </span>
              </label>
              <p className="hint">서비스에서 표시될 이름이에요.</p>
            </div>

            <p className="hint" style={{ margin: '0 0 24px' }}>
              연결된 계정 · Google
            </p>

            <div className="save-row">
              <button
                className="btn btn-accent"
                onClick={handleSave}
                disabled={!dirty || !valid || saving}
              >
                {saving ? '저장 중…' : '변경 사항 저장'}
              </button>
              {saved && <span className="saved-note">저장되었습니다.</span>}
              {saveError && (
                <span className="save-error" role="alert">
                  {saveError}
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <h1 className="settings-title">계정</h1>

            <div className="account-row">
              <span className="label">이메일</span>
              <span className="value">{user.email}</span>
            </div>
            <div className="account-row">
              <span className="label">연결된 계정</span>
              <span className="badge">GOOGLE</span>
            </div>

            <div className="danger-zone">
              <button
                className="btn"
                onClick={() => {
                  logout()
                  router.replace('/login')
                }}
              >
                <LogOut size={14} />
                로그아웃
              </button>
              <button className="btn btn-danger" onClick={handleReset}>
                모든 데이터 초기화
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
