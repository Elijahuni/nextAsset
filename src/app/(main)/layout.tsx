'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/context/user-context'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isLoggedIn } = useUser()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const savedId = localStorage.getItem('asset_user_id')
    if (!savedId) {
      router.replace('/login')
    } else {
      setChecked(true)
    }
  }, [router])

  if (!checked) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 print:bg-white print:m-0 print:p-0">
        <Header />
        <div className="flex-1 overflow-auto p-8 custom-scrollbar print:p-2 print:overflow-visible">
          {children}
        </div>
      </main>
    </div>
  )
}
