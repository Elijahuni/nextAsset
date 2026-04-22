'use client'

import { usePathname } from 'next/navigation'
import { Bell, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useUser } from '@/context/user-context'

const PAGE_TITLES: Record<string, (isEmployee: boolean) => string> = {
  '/':             (e) => e ? '나의 자산 요약' : '대시보드 (통계)',
  '/assets':       (e) => e ? '내 보유 자산 목록' : '자산 원장 관리',
  '/approvals':    (e) => e ? '결재 신청 내역' : '결재 현황 관리',
  '/audit':        ()  => '재물조사 (바코드 실사)',
  '/map':          ()  => '도면 및 자산 배치도 (Drag & Drop)',
  '/depreciation': ()  => '감가상각 조회 (결산)',
  '/master':       ()  => '기초 정보 (마스터) 관리',
}

export default function Header() {
  const pathname = usePathname()
  const { currentUser, logout, isEmployee } = useUser()
  const title = (PAGE_TITLES[pathname] ?? (() => '자산관리'))(isEmployee)

  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    fetch('/api/approvals?status=PENDING')
      .then((r) => r.json())
      .then((data: unknown[]) => setPendingCount(Array.isArray(data) ? data.length : 0))
      .catch(() => {})
  }, [])

  const roleLabel =
    currentUser.role === 'admin'   ? '시스템 최고 관리자' :
    currentUser.role === 'manager' ? '부서장 (중간관리자)' : '일반 사용자'

  const avatarColor =
    isEmployee                     ? 'bg-amber-100 text-amber-700' :
    currentUser.role === 'manager' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm flex-shrink-0 z-10 print:hidden">
      <h1 className="text-xl font-bold text-slate-800">{title}</h1>

      <div className="flex items-center space-x-4">
        {!isEmployee && (
          <button className="text-slate-400 hover:text-slate-600 relative">
            <Bell className="w-5 h-5" />
            {pendingCount > 0 && (
              <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-3 w-3 rounded-full bg-red-500 border-2 border-white" />
            )}
          </button>
        )}

        <div className="flex items-center pl-4 border-l border-slate-200 space-x-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ${avatarColor}`}>
            {currentUser.name.charAt(0)}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-700">{currentUser.name} ({currentUser.department})</span>
            <span className="text-[10px] text-slate-400 -mt-0.5">{roleLabel}</span>
          </div>
          <button
            onClick={logout}
            title="로그아웃"
            className="ml-2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
