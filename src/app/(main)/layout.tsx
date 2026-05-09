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
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.replace('/login')
    }
  }, [isLoading, isLoggedIn, router])

  useEffect(() => {
    if (!isLoggedIn) return
    fetch('/api/approvals?status=PENDING')
      .then((r) => r.json())
      .then((data: unknown[]) => setPendingCount(Array.isArray(data) ? data.length : 0))
      .catch(() => {})
  }, [isLoggedIn])

  if (isLoading || !isLoggedIn) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} pendingCount={pendingCount} />
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900 print:bg-white print:m-0 print:p-0">
        <Header onMenuToggle={() => setSidebarOpen((o) => !o)} pendingCount={pendingCount} />
        <div className="flex-1 overflow-auto p-4 lg:p-8 custom-scrollbar print:p-2 print:overflow-visible">
          {children}
        </div>
      </main>
    </div>
  )
}
