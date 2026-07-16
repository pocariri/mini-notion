'use client'

import { Moon, Sun } from 'lucide-react'
import { useStore } from '@/lib/store'

// 두 사이드바(업무·마이 페이지)가 공유하는 테마 토글.
// props 없이 스토어만 구독해 어디서 렌더돼도 같은 상태를 보인다.
export default function ThemeToggle() {
  const { theme, toggleTheme } = useStore()
  const dark = theme === 'dark'
  const Icon = dark ? Sun : Moon

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      className="navitem"
      onClick={toggleTheme}
    >
      <Icon size={15} />
      {dark ? '라이트 모드' : '다크 모드'}
    </button>
  )
}
