import type { Metadata } from 'next'
import './globals.css'
import { UserProvider } from '@/context/user-context'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from 'next-themes'

export const metadata: Metadata = {
  title: 'AssetCop MVP',
  description: '자산관리 시스템',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="font-sans text-slate-800 dark:text-slate-100 antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <UserProvider>
            {children}
          </UserProvider>
          <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        </ThemeProvider>
      </body>
    </html>
  )
}
