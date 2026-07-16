import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { StoreProvider } from '@/lib/store'
import { THEME_INIT_SCRIPT } from '@/lib/theme'
import './globals.css'

const pretendard = localFont({
  src: './fonts/PretendardVariable.woff2',
  display: 'swap',
  weight: '45 920',
  variable: '--font-pretendard',
})

export const metadata: Metadata = {
  title: 'mini notion — 개인 업무를, 내 방식대로',
  description: '개인 업무 관리를 위한 미니 노션. 페이지를 만들고 내 방식대로 관리하세요.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // 인라인 스크립트가 하이드레이션 전에 data-theme를 교정하므로 React가
    // SSR 기본값(light)과의 불일치를 수용해야 한다(suppressHydrationWarning).
    // Next.js 공식 패턴: docs/01-app/02-guides/preventing-flash-before-hydration.md
    <html
      lang="ko"
      data-theme="light"
      suppressHydrationWarning
      className={pretendard.variable}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  )
}
