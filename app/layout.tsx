import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { StoreProvider } from '@/lib/store'
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
    <html lang="ko" className={pretendard.variable}>
      <body>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  )
}
