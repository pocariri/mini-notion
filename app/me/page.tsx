'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ImagePlus,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
  X,
} from 'lucide-react'
import Avatar from '@/components/Avatar'
import ThemeToggle from '@/components/ThemeToggle'
import { useStore } from '@/lib/store'

type Tab = 'profile' | 'account'

const MAX_NICKNAME = 20
const MAX_INTRODUCTION = 150
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export default function MePage() {
  const {
    ready,
    user,
    profileStatus,
    retryProfile,
    updateUser,
    logout,
    resetAll,
    sidebarCollapsed,
    toggleSidebar,
  } = useStore()
  const router = useRouter()

  const [tab, setTab] = useState<Tab>('profile')
  const [nickname, setNickname] = useState('')
  const [image, setImage] = useState<string | null>(null)
  // 새로 고른 파일. 업로드는 '변경 사항 저장'에서 일어난다 — 선택 시점에는 미리보기만.
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [introduction, setIntroduction] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ready && !user) router.replace('/login')
  }, [ready, user, router])

  // 폼 초기값은 프로필 조회가 끝난 뒤 한 번만 가져온다.
  // 세션만 보고 채우면 DB 값이 도착하기 전의 Google 기본값이 폼에 남아,
  // 그대로 저장하면 저장된 프로필을 덮어쓴다(FR-008).
  useEffect(() => {
    if (user && profileStatus === 'ready' && !hydrated) {
      setNickname(user.nickname)
      setImage(user.image)
      setIntroduction(user.introduction ?? '')
      setHydrated(true)
    }
  }, [user, profileStatus, hydrated])

  if (!ready || !user || profileStatus === 'loading') {
    return (
      <div className="splash">
        <span className="login-logo">m</span>
      </div>
    )
  }

  // 프로필 조회 실패 — 폼에 보이는 값을 신뢰할 수 없으므로 입력·저장을 전부 잠근다(FR-019·020).
  const profileError = profileStatus === 'error'

  // 이미지 변경 여부: 새 파일을 골랐거나(pendingFile), 있던 이미지를 제거했거나.
  // data URL 미리보기와 저장된 URL은 문자열로 비교할 수 없어 상태로 판정한다.
  const imageDirty = pendingFile !== null || (image === null && user.image !== null)
  const dirty =
    nickname !== user.nickname || imageDirty || introduction !== (user.introduction ?? '')
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
    // 여기서는 미리보기만 만든다 — 실제 업로드는 '변경 사항 저장'에서 일어난다.
    setPendingFile(file)
    const reader = new FileReader()
    reader.onload = () => setImage(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!dirty || !valid || saving || profileStatus !== 'ready') return
    setSaving(true)
    setSaveError(null)
    const trimmed = nickname.trim()
    // 자기소개는 선택 항목 — trim 결과가 비면 "없음"(null)으로 저장한다.
    const introTrimmed = introduction.trim()
    // File = 교체, null = 제거, undefined = 변경 없음
    const imageFile = pendingFile ?? (image === null && user.image !== null ? null : undefined)
    const { error } = await updateUser({
      nickname: trimmed,
      introduction: introTrimmed === '' ? null : introTrimmed,
      imageFile,
    })
    setSaving(false)
    if (error) {
      setSaveError('저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
      return
    }
    setNickname(trimmed)
    setIntroduction(introTrimmed)
    setPendingFile(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = () => {
    if (!window.confirm('모든 페이지와 계정 정보를 삭제할까요? 되돌릴 수 없어요.')) return
    resetAll()
    router.replace('/login')
  }

  const previewUser = { ...user, nickname: nickname || user.nickname, image }

  return (
    <main className="workspace">
      <aside className={sidebarCollapsed ? 'rail collapsed' : 'rail'}>
        <div className="brand">
          <span className="brand-tile">m</span>
          <span className="brand-name">mini notion</span>
          <button
            type="button"
            className="rail-toggle"
            aria-label="사이드바 접기/펼치기"
            aria-expanded={!sidebarCollapsed}
            data-tip="사이드바 접기/펼치기"
            onClick={toggleSidebar}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>
        </div>

        <div className="section-label">설정</div>
        <button
          className={`navitem${tab === 'profile' ? ' active' : ''}`}
          aria-label="프로필"
          data-tip="프로필"
          onClick={() => setTab('profile')}
        >
          <UserRound size={15} />
          <span className="navitem-label">프로필</span>
        </button>
        <button
          className={`navitem${tab === 'account' ? ' active' : ''}`}
          aria-label="계정"
          data-tip="계정"
          onClick={() => setTab('account')}
        >
          <LogOut size={15} />
          <span className="navitem-label">계정</span>
        </button>

        <div className="rail-spacer" />

        <ThemeToggle />

        <Link
          href="/workspace"
          className="navitem"
          aria-label="업무로 돌아가기"
          data-tip="업무로 돌아가기"
        >
          <ArrowLeft size={15} />
          <span className="navitem-label">업무로 돌아가기</span>
        </Link>
      </aside>

      <section className="settings-body">
        {tab === 'profile' ? (
          <>
            <h1 className="settings-title">프로필</h1>

            {profileError && (
              <div className="save-row" style={{ margin: '0 0 24px' }}>
                <span className="save-error" role="alert">
                  프로필을 불러오지 못했어요.
                </span>
                <button className="btn" onClick={retryProfile}>
                  재시도
                </button>
              </div>
            )}

            <div className="profile-row">
              <Avatar user={previewUser} size={78} />
              <div>
                <div className="profile-row-actions">
                  <button
                    className="btn"
                    onClick={() => fileRef.current?.click()}
                    disabled={profileError}
                  >
                    <ImagePlus size={14} />
                    이미지 변경
                  </button>
                  {image && (
                    <button
                      className="btn btn-ghost"
                      onClick={() => {
                        setImage(null)
                        setPendingFile(null)
                      }}
                      disabled={profileError}
                    >
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
                  aria-label="별명"
                  disabled={profileError}
                  onChange={(e) => setNickname(e.target.value)}
                />
                <span className="counter">
                  #{nickname.length}/{MAX_NICKNAME}
                </span>
              </label>
              <p className="hint">서비스에서 표시될 이름이에요.</p>
            </div>

            <div className="field-block">
              <div className="section-label" style={{ paddingLeft: 0 }}>
                자기소개
              </div>
              <label className="field field-multi">
                <textarea
                  value={introduction}
                  maxLength={MAX_INTRODUCTION}
                  rows={3}
                  aria-label="자기소개"
                  placeholder="자신을 간단히 소개해 보세요."
                  disabled={profileError}
                  onChange={(e) => setIntroduction(e.target.value)}
                />
                <span className="counter">
                  #{introduction.length}/{MAX_INTRODUCTION}
                </span>
              </label>
              <p className="hint">150자까지 남길 수 있어요.</p>
            </div>

            <p className="hint" style={{ margin: '0 0 24px' }}>
              연결된 계정 · Google
            </p>

            <div className="save-row">
              <button
                className="btn btn-accent"
                onClick={handleSave}
                disabled={!dirty || !valid || saving || profileStatus !== 'ready'}
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
