'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, FileSignature, BarChart2, ScanLine } from 'lucide-react'
import { useUser } from '@/context/user-context'

const TABS = [
  { href: '/',           icon: LayoutDashboard, label: '대시보드' },
  { href: '/assets',     icon: Package,         label: '자산' },
  { href: '/approvals',  icon: FileSignature,   label: '결재' },
  { href: '/reports',    icon: BarChart2,        label: '보고서' },
  { href: '/audit',      icon: ScanLine,         label: '실사',   managerOnly: true },
]

export default function MobileTabBar({ pendingCount }: { pendingCount: number }) {
  const { isEmployee } = useUser()
  const pathname = usePathname()

  const tabs = isEmployee
    ? TABS.filter((t) => !t.managerOnly)
    : TABS

  return (
    <nav
      aria-label="하단 탭 메뉴"
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center safe-bottom print:hidden"
    >
      {tabs.map((tab) => {
        const Icon    = tab.icon
        const active  = pathname === tab.href || (tab.href !== '/' && pathname.startsWith(tab.href))
        const isPending = tab.href === '/approvals' && pendingCount > 0
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 relative transition-colors ${
              active
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-400 dark:text-slate-500 active:text-slate-600 dark:active:text-slate-300'
            }`}
          >
            <div className="relative">
              <Icon className="w-5 h-5" />
              {isPending && (
                <span className="absolute -top-1 -right-1.5 w-4 h-4 text-[9px] font-bold bg-amber-500 text-white rounded-full flex items-center justify-center">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-semibold leading-none">{tab.label}</span>
            {active && (
              <span className="absolute top-0 inset-x-3 h-0.5 bg-blue-500 dark:bg-blue-400 rounded-b-full" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
