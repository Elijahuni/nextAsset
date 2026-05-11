'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Bell, LogOut, AlertTriangle, Clock, Menu, Sun, Moon, CheckCheck, XCircle, Ban, FileText } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
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

interface AppNotification {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  readAt: string | null
  createdAt: string
}

interface HeaderProps {
  onMenuToggle: () => void
  pendingCount: number
}

function NotifIcon({ type }: { type: string }) {
  const cls = 'w-4 h-4'
  if (type === 'APPROVAL_APPROVED')
    return <CheckCheck className={`${cls} text-emerald-600`} />
  if (type === 'APPROVAL_REJECTED')
    return <XCircle className={`${cls} text-red-500`} />
  if (type === 'APPROVAL_CANCELLED')
    return <Ban className={`${cls} text-slate-400`} />
  if (type === 'WARRANTY_EXPIRING')
    return <AlertTriangle className={`${cls} text-amber-500`} />
  // APPROVAL_REQUEST or unknown
  return <FileText className={`${cls} text-blue-500`} />
}

function iconBg(type: string) {
  if (type === 'APPROVAL_APPROVED')  return 'bg-emerald-100'
  if (type === 'APPROVAL_REJECTED')  return 'bg-red-100'
  if (type === 'APPROVAL_CANCELLED') return 'bg-slate-100'
  if (type === 'WARRANTY_EXPIRING')  return 'bg-amber-100'
  return 'bg-blue-100'
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1)  return '방금 전'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24)  return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7)  return `${day}일 전`
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

export default function Header({ onMenuToggle, pendingCount }: HeaderProps) {
  const pathname  = usePathname()
  const router    = useRouter()
  const { currentUser, logout, isEmployee } = useUser()
  const title = (PAGE_TITLES[pathname] ?? (() => '자산관리'))(isEmployee)

  const { theme, setTheme } = useTheme()

  const [warningAssets, setWarningAssets]   = useState<WarningAsset[]>([])
  const [notifications,  setNotifications]  = useState<AppNotification[]>([])
  const [bellOpen,       setBellOpen]       = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  // 보증 만료 임박 자산 (비관리자도 내 자산 한정으로 표시할 수 있으나 여기선 공통 fetch)
  useEffect(() => {
    fetch('/api/assets?warrantyExpiring=true')
      .then((r) => r.json())
      .then((data: WarningAsset[]) => {
        if (Array.isArray(data)) setWarningAssets(data.slice(0, 10))
      })
      .catch(() => {})
  }, [])

  // 알림 fetch (30초 폴링)
  const fetchNotifications = useCallback(() => {
    fetch('/api/notifications')
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (json?.data && Array.isArray(json.data)) setNotifications(json.data)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchNotifications()
    const id = setInterval(fetchNotifications, 30_000)
    return () => clearInterval(id)
  }, [fetchNotifications])

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

  const unreadNotifications = notifications.filter((n) => !n.readAt)
  const unreadCount         = unreadNotifications.length
  const totalAlerts         = unreadCount + warningAssets.length + (pendingCount > 0 ? 1 : 0)

  const handleNotifClick = async (notif: AppNotification) => {
    // 읽음 처리 (fire-and-forget)
    if (!notif.readAt) {
      fetch(`/api/notifications/${notif.id}/read`, { method: 'PATCH' })
        .then(() => fetchNotifications())
        .catch(() => {})
    }
    setBellOpen(false)
    if (notif.link) router.push(notif.link)
  }

  const handleMarkAll = async () => {
    await fetch('/api/notifications', { method: 'PATCH' })
    fetchNotifications()
  }

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
        <h1 className="text-lg lg:text-xl font-bold text-slate-800 dark:text-slate-100 truncate">{title}</h1>
      </div>

      <div className="flex items-center space-x-4">
        {/* 벨 아이콘 — STAFF 포함 전원 표시 (결재 결과 알림 수신) */}
        <div ref={bellRef} className="relative">
          <button
            onClick={() => setBellOpen((o) => !o)}
            aria-label={`알림${totalAlerts > 0 ? ` (${totalAlerts}건)` : ''}`}
            aria-expanded={bellOpen}
            aria-haspopup="true"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 relative p-1"
          >
            <Bell className="w-5 h-5" />
            {totalAlerts > 0 && (
              <span className="absolute top-0 right-0 -mt-0.5 -mr-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 border-2 border-white dark:border-slate-800 text-[9px] font-bold text-white">
                {totalAlerts > 9 ? '9+' : totalAlerts}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
              {/* 헤더 */}
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  알림
                  {unreadCount > 0 && (
                    <span className="ml-2 text-xs font-normal text-blue-500">읽지 않음 {unreadCount}건</span>
                  )}
                </p>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAll}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    전체 읽음
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto custom-scrollbar">
                {/* 결재 대기 (비관리자 제외) */}
                {pendingCount > 0 && !isEmployee && (
                  <div className="flex items-start gap-3 px-4 py-3 border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <div className="mt-0.5 w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">결재 대기 {pendingCount}건</p>
                      <p className="text-xs text-slate-400 mt-0.5">승인 또는 반려가 필요한 결재가 있습니다.</p>
                    </div>
                  </div>
                )}

                {/* 실시간 알림 */}
                {notifications.slice(0, 15).map((notif) => (
                  <button
                    key={notif.id}
                    onClick={() => handleNotifClick(notif)}
                    className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${!notif.readAt ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}
                  >
                    <div className={`mt-0.5 w-7 h-7 rounded-full ${iconBg(notif.type)} flex items-center justify-center shrink-0 relative`}>
                      <NotifIcon type={notif.type} />
                      {!notif.readAt && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-500 border border-white dark:border-slate-800" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm truncate ${!notif.readAt ? 'font-semibold text-slate-800 dark:text-slate-100' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{notif.body}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{timeAgo(notif.createdAt)}</p>
                    </div>
                  </button>
                ))}

                {/* 보증기간 만료·임박 */}
                {warningAssets.map((asset) => {
                  const ws = getWarrantyStatus(asset.warrantyDate)
                  return (
                    <div key={asset.id} className="flex items-start gap-3 px-4 py-3 border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <div className="mt-0.5 w-7 h-7 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{asset.name}</p>
                        <p className={`text-xs mt-0.5 font-medium ${ws.isExpired ? 'text-red-500' : 'text-amber-600'}`}>
                          {ws.text}
                        </p>
                      </div>
                    </div>
                  )
                })}

                {totalAlerts === 0 && notifications.length === 0 && (
                  <div className="py-10 text-center text-slate-400 text-sm">
                    새로운 알림이 없습니다.
                  </div>
                )}
              </div>

              {/* 푸터 */}
              {notifications.length > 0 && (
                <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                  <button
                    onClick={() => { setBellOpen(false); router.push('/approvals') }}
                    className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
                  >
                    결재 현황 보기 →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

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
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {currentUser.name}
              <span className="hidden md:inline"> ({currentUser.department})</span>
            </span>
            <span className="text-[10px] text-slate-400 -mt-0.5">{roleLabel}</span>
          </div>
          <button
            onClick={logout}
            aria-label="로그아웃"
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
