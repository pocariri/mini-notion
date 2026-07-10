'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'

export default function Home() {
  const { ready, user } = useStore()
  const router = useRouter()

  useEffect(() => {
    if (ready) router.replace(user ? '/workspace' : '/login')
  }, [ready, user, router])

  return (
    <div className="splash">
      <span className="login-logo">m</span>
    </div>
  )
}
