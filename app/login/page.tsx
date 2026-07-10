'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import GoogleLogo from '@/components/GoogleLogo'
import { useStore } from '@/lib/store'

export default function LoginPage() {
  const { ready, user, login } = useStore()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (ready && user) router.replace('/workspace')
  }, [ready, user, router])

  const handleLogin = () => {
    if (busy) return
    setBusy(true)
    // 실제 서비스에서는 Google OAuth 2.0 리디렉션이 일어나는 자리입니다.
    setTimeout(() => {
      login()
      router.replace('/workspace')
    }, 500)
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
        <p className="login-note">첫 로그인 시 자동으로 계정이 생성됩니다.</p>
      </div>
    </main>
  )
}
