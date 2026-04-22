import type { Metadata } from 'next'
import './globals.css'
import { UserProvider } from '@/context/user-context'

export const metadata: Metadata = {
  title: 'AssetCop MVP',
  description: '자산관리 시스템',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="font-sans text-slate-800 antialiased">
        <UserProvider>
          {children}
        </UserProvider>
      </body>
    </html>
  )
}
