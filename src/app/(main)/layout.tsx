'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/context/user-context'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isLoggedIn, isLoading } = useUser()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.replace('/login')
    }
  }, [isLoading, isLoggedIn, router])

  // 세션 확인 중이거나 미로그인 상태면 로딩 스피너 표시
  if (isLoading || !isLoggedIn) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900 print:bg-white print:m-0 print:p-0">
        <Header onMenuToggle={() => setSidebarOpen((o) => !o)} />
        <div className="flex-1 overflow-auto p-4 lg:p-8 custom-scrollbar print:p-2 print:overflow-visible">
          {children}
        </div>
      </main>
    </div>
  )
}
