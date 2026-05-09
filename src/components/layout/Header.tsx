'use client'

import { usePathname } from 'next/navigation'
import { Bell, LogOut, AlertTriangle, Clock, Menu, Sun, Moon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useUser } from '@/context/user-context'
import { getWarrantyStatus } from '@/lib/utils'
import { useTheme } from 'next-themes'

const PAGE_TITLES: Record<string, (isEmployee: boolean) => string> = {
  '/':             (e) => e ? '나의 자산 요약' : '대시보드 (통계)',
  '/assets':       (e) => e ? '내 보유 자산 목록' : '자산 원장 관리',
  '/approvals':    (e) => e ? '결재 신청 내역' : '결재 현황 관리',
  '/audit':        ()  => '재물조사 (바코드 실사)',
  '/map':          ()  => '도면 및 자산 배치도 (Drag & Drop)',
  '/depreciation': ()  => '감가상각 조회 (결산)',
  '/master':       ()  => '기초 정보 (마스터) 관리',
}

interface WarningAsset {
  id: string
  name: string
  warrantyDate: string
  status: string
}

interface HeaderProps {
  onMenuToggle: () => void
  pendingCount: number
}

export default function Header({ onMenuToggle, pendingCount }: HeaderProps) {
  const pathname = usePathname()
  const { currentUser, logout, isEmployee } = useUser()
  const title = (PAGE_TITLES[pathname] ?? (() => '자산관리'))(isEmployee)

  const { theme, setTheme } = useTheme()

  const [warningAssets, setWarningAssets] = useState<WarningAsset[]>([])
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // warrantyExpiring=true: DB에서 30일 이내·만료 자산만 최대 20건 반환 — 전체 fetch 불필요
    fetch('/api/assets?warrantyExpiring=true')
      .then((r) => r.json())
      .then((data: WarningAsset[]) => {
        if (!Array.isArray(data)) return
        setWarningAssets(data.slice(0, 10))
      })
      .catch(() => {})
  }, [])

  // 벨 바깥 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const totalAlerts = pendingCount + warningAssets.length

  const roleLabel =
    currentUser.role === 'admin'   ? '시스템 최고 관리자' :
    currentUser.role === 'manager' ? '부서장 (중간관리자)' : '일반 사용자'

  const avatarColor =
    isEmployee                     ? 'bg-amber-100 text-amber-700' :
    currentUser.role === 'manager' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'

  return (
    <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 lg:px-8 shadow-sm flex-shrink-0 z-10 print:hidden">
      <div className="flex items-center gap-2 min-w-0">
        {/* 모바일 햄버거 버튼 */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="메뉴 열기"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="text-lg lg:text-xl font-bold text-slate-800 truncate">{title}</h1>
      </div>

      <div className="flex items-center space-x-4">
        {!isEmployee && (
          <div ref={bellRef} className="relative">
            <button
              onClick={() => setBellOpen((o) => !o)}
              aria-label={`알림${totalAlerts > 0 ? ` (${totalAlerts}건)` : ''}`}
              aria-expanded={bellOpen}
              aria-haspopup="true"
              className="text-slate-400 hover:text-slate-600 relative p-1"
            >
              <Bell className="w-5 h-5" />
              {totalAlerts > 0 && (
                <span className="absolute top-0 right-0 -mt-0.5 -mr-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 border-2 border-white text-[9px] font-bold text-white">
                  {totalAlerts > 9 ? '9+' : totalAlerts}
                </span>
              )}
            </button>

            {bellOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <p className="text-sm font-bold text-slate-700">알림</p>
                </div>

                <div className="max-h-72 overflow-y-auto custom-scrollbar">
                  {/* 결재 대기 */}
                  {pendingCount > 0 && (
                    <div className="flex items-start gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50">
                      <div className="mt-0.5 w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">결재 대기 {pendingCount}건</p>
                        <p className="text-xs text-slate-400 mt-0.5">승인 또는 반려가 필요한 결재가 있습니다.</p>
                      </div>
                    </div>
                  )}

                  {/* 보증기간 만료·임박 */}
                  {warningAssets.map((asset) => {
                    const ws = getWarrantyStatus(asset.warrantyDate)
                    return (
                      <div key={asset.id} className="flex items-start gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50">
                        <div className="mt-0.5 w-7 h-7 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{asset.name}</p>
                          <p className={`text-xs mt-0.5 font-medium ${ws.isExpired ? 'text-red-500' : 'text-amber-600'}`}>
                            {ws.text}
                          </p>
                        </div>
                      </div>
                    )
                  })}

                  {totalAlerts === 0 && (
                    <div className="py-10 text-center text-slate-400 text-sm">
                      새로운 알림이 없습니다.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          {theme === 'dark'
            ? <Sun className="w-4 h-4" />
            : <Moon className="w-4 h-4" />
          }
        </button>

        <div className="flex items-center pl-3 lg:pl-4 border-l border-slate-200 dark:border-slate-700 space-x-2 lg:space-x-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm shrink-0 ${avatarColor}`}>
            {currentUser.name.charAt(0)}
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="text-sm font-bold text-slate-700">
              {currentUser.name}
              <span className="hidden md:inline"> ({currentUser.department})</span>
            </span>
            <span className="text-[10px] text-slate-400 -mt-0.5">{roleLabel}</span>
          </div>
          <button
            onClick={logout}
            aria-label="로그아웃"
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
