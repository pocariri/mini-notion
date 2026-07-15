'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import GoogleLogo from '@/components/GoogleLogo'
import { useStore } from '@/lib/store'

export default function LoginPage() {
  const { ready, user, login } = useStore()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (ready && user) router.replace('/workspace')
  }, [ready, user, router])

  // OAuth 취소/실패로 돌아오면 쿼리(또는 해시)에 error가 실려 온다.
  useEffect(() => {
    const search = new URLSearchParams(window.location.search)
    const hash = new URLSearchParams(window.location.hash.slice(1))
    if (search.has('error') || hash.has('error')) {
      setError('Google 로그인이 완료되지 않았어요. 다시 시도해 주세요.')
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  const handleLogin = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    const { error: loginError } = await login()
    if (loginError) {
      setError('Google 로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.')
      setBusy(false)
      return
    }
    // 성공하면 브라우저가 Google로 리다이렉트되므로 busy를 유지한다.
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-logo">m</div>
        <h1 className="login-title">mini notion</h1>
        <p className="login-tagline">개인 업무를, 내 방식대로.</p>
        <button
          className="btn btn-lg google-btn"
          onClick={handleLogin}
          disabled={busy}
        >
          <GoogleLogo size={18} />
          {busy ? 'Google로 이동 중…' : 'Google 계정으로 계속하기'}
        </button>
        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
        <p className="login-note">첫 로그인 시 자동으로 계정이 생성됩니다.</p>
      </div>
    </main>
  )
}
