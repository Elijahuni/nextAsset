'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Database, Monitor, FileSignature, Briefcase,
  PieChart, BarChart3, Sparkles, Bot, RefreshCcw,
} from 'lucide-react'

// ─── CountUp 훅 ───────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200) {
  const [count, setCount] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (target === 0) { setCount(0); return }

    let startTime: number | null = null

    const step = (timestamp: number) => {
      if (startTime === null) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      // easeOutQuart: 빠르게 시작해서 부드럽게 감속
      const eased = 1 - Math.pow(1 - progress, 4)
      setCount(Math.round(eased * target))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      }
    }

    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration])

  return count
}

// 상태 요약 카드 내 개별 숫자 애니메이션용 서브컴포넌트
function AnimatedCount({ value }: { value: number }) {
  const animated = useCountUp(value)
  return <>{animated}</>
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* AI 섹션 */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800">
        <div className="flex justify-between items-center mb-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-9 w-40 rounded-xl" />
        </div>
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>

      {/* 통계 카드 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center space-x-4">
            <Skeleton className="w-14 h-14 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-12" />
            </div>
          </div>
        ))}
      </div>

      {/* 차트 2개 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <Skeleton className="h-5 w-28 mb-6" />
          <Skeleton className="h-8 w-full rounded-lg mb-5" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full mb-3" />
          ))}
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <Skeleton className="h-5 w-28 mb-4" />
          <div className="flex space-x-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="flex-1 h-24 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
import { useUser } from '@/context/user-context'
import { CATEGORY_COLORS, ASSET_STATUS_LABEL, ASSET_CATEGORY_LABEL, formatCurrency } from '@/lib/utils'
import { calculateDepreciation } from '@/lib/depreciation'
import { Skeleton } from '@/components/ui'

// ─── API 응답 타입 ────────────────────────────────────────────────────────────

interface ApiAsset {
  id: string
  code: string
  name: string
  category: string        // AssetCategory enum
  department: string
  location: string
  status: string          // AssetStatus enum
  price: string | number  // Decimal → JSON string
  acquiredDate: string
  warrantyDate: string | null
}

// 대시보드에서 사용하는 집계된 통계
interface DashboardStats {
  totalCount: number
  totalValue: number
  inUseCount: number
  pendingApprovals: number
  statusCounts: Record<string, number>
  categoryChartData: Array<{ name: string; value: number; percentage: number }>
  deprSummary: { totalAccumulated: number; totalBookValue: number }
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

const DISPLAY_STATUSES = ['사용중', '사용가능', '수리중', '처분', '보관중']

export default function Dashboard() {
  const { currentUser, isEmployee } = useUser()

  const [assets, setAssets] = useState<ApiAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingApprovals, setPendingApprovals] = useState(0)

  // AI 분석 보고서 상태
  const [aiReport, setAiReport] = useState('')
  const [isAiLoading, setIsAiLoading] = useState(false)

  // ─── 데이터 패칭 ────────────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/assets').then((r) => r.json()),
      fetch('/api/approvals?status=PENDING').then((r) => r.json()),
    ])
      .then(([assetData, approvalData]: [unknown, unknown]) => {
        const assets: ApiAsset[] = Array.isArray(assetData) ? assetData : []
        let filtered: ApiAsset[] = assets
        if (currentUser.role === 'manager') {
          filtered = assets.filter((a) => a.department === currentUser.department)
        }
        setAssets(filtered)
        setPendingApprovals(Array.isArray(approvalData) ? approvalData.length : 0)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [currentUser])

  // ─── 통계 계산 (원본 stats useMemo 이식) ────────────────────────────────────

  const stats: DashboardStats = useMemo(() => {
    const totalCount = assets.length
    const totalValue = assets.reduce((sum, a) => sum + Number(a.price), 0)
    const inUseCount = assets.filter((a) => a.status === 'IN_USE').length

    const statusCounts = assets.reduce<Record<string, number>>((acc, a) => {
      const label = ASSET_STATUS_LABEL[a.status] ?? a.status
      acc[label] = (acc[label] ?? 0) + 1
      return acc
    }, {})

    const categoryValueMap = assets.reduce<Record<string, number>>((acc, a) => {
      const label = ASSET_CATEGORY_LABEL[a.category] ?? a.category
      acc[label] = (acc[label] ?? 0) + Number(a.price)
      return acc
    }, {})

    const categoryChartData = Object.entries(categoryValueMap)
      .map(([name, value]) => ({ name, value, percentage: totalValue ? (value / totalValue) * 100 : 0 }))
      .sort((a, b) => b.value - a.value)

    const deprSummary = assets.reduce(
      (acc, asset) => {
        const { accumulated, bookValue } = calculateDepreciation(
          asset.acquiredDate, Number(asset.price), asset.category
        )
        acc.totalAccumulated += accumulated
        acc.totalBookValue += bookValue
        return acc
      },
      { totalAccumulated: 0, totalBookValue: 0 }
    )

    return { totalCount, totalValue, inUseCount, pendingApprovals, statusCounts, categoryChartData, deprSummary }
  }, [assets, pendingApprovals])

  // ─── CountUp 애니메이션 ──────────────────────────────────────────────────────
  const animTotalCount    = useCountUp(stats.totalCount)
  const animInUseCount    = useCountUp(stats.inUseCount)
  const animPending       = useCountUp(stats.pendingApprovals)
  const animTotalValue    = useCountUp(stats.totalValue)

  // ─── AI 분석 핸들러 → /api/ai/report 호출 ──────────────────────────────────

  const handleGenerateAiReport = async () => {
    setIsAiLoading(true)
    setAiReport('')
    try {
      const deptCounts = assets.reduce<Record<string, number>>((acc, a) => {
        acc[a.department] = (acc[a.department] ?? 0) + 1
        return acc
      }, {})

      const res = await fetch('/api/ai/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalAssets: stats.totalCount,
          totalValue: stats.totalValue,
          inUseAssets: stats.inUseCount,
          repairingAssets: stats.statusCounts['수리중'] ?? 0,
          disposedAssets: stats.statusCounts['처분'] ?? 0,
          topDepartments: Object.entries(deptCounts).sort((a, b) => b[1] - a[1]).slice(0, 2),
          topCategories: stats.categoryChartData.slice(0, 2).map((c) => c.name),
        }),
      })
      const data = await res.json()
      setAiReport(data.text ?? 'AI 분석을 불러오는 중 오류가 발생했습니다.')
    } catch {
      setAiReport('AI 분석을 불러오는 중 오류가 발생했습니다. 나중에 다시 시도해 주세요.')
    } finally {
      setIsAiLoading(false)
    }
  }

  // ─── 렌더 ────────────────────────────────────────────────────────────────────

  if (loading) return <DashboardSkeleton />

  return (
    <div className="space-y-6 print:space-y-4">

      {/* AI 자산 분석 보고서 (원본 UI 그대로) */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800 shadow-sm print:hidden relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Bot className="w-24 h-24 text-indigo-900" />
        </div>
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
            <h3 className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center text-lg">
              <Sparkles className="w-5 h-5 mr-2 text-indigo-600" />
              AI 자산 포트폴리오 분석
            </h3>
            <button
              onClick={handleGenerateAiReport}
              disabled={isAiLoading || stats.totalCount === 0}
              className="mt-3 sm:mt-0 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-all"
            >
              {isAiLoading
                ? <><RefreshCcw className="w-4 h-4 mr-2 animate-spin" />데이터 분석 중...</>
                : <><Bot className="w-4 h-4 mr-2" />AI 요약 리포트 생성 ✨</>
              }
            </button>
          </div>
          <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm p-4 rounded-xl border border-indigo-50/50 dark:border-indigo-800/50 min-h-[80px] flex items-center">
            {isAiLoading ? (
              <p className="text-indigo-600 dark:text-indigo-400 font-medium animate-pulse">AI가 현재 자산 통계를 분석하여 보고서를 작성하고 있습니다...</p>
            ) : aiReport ? (
              <p className="text-slate-800 dark:text-slate-100 text-sm leading-relaxed whitespace-pre-wrap">{aiReport}</p>
            ) : (
              <p className="text-slate-500 dark:text-slate-400 text-sm">상단의 버튼을 눌러 우리 회사의 자산 건전성 분석 보고서를 받아보세요.</p>
            )}
          </div>
        </div>
      </div>

      {/* 통계 카드 4개 (원본 grid 유지) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 print:gap-2 print:grid-cols-4">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center space-x-4 print:border-slate-300 print:rounded-none">
          <div className="p-3.5 bg-blue-50 text-blue-600 rounded-xl print:bg-transparent print:p-0">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">총 보유 자산</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{animTotalCount}<span className="text-sm font-medium text-slate-400 ml-1">건</span></p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center space-x-4 print:border-slate-300 print:rounded-none">
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl print:bg-transparent print:p-0">
            <Monitor className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">사용중인 자산</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{animInUseCount}<span className="text-sm font-medium text-slate-400 ml-1">건</span></p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center space-x-4 cursor-pointer hover:shadow-md transition-shadow group print:border-slate-300 print:rounded-none">
          <div className="p-3.5 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-100 transition-colors print:bg-transparent print:p-0">
            <FileSignature className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">{isEmployee ? '내가 올린 결재' : '결재 대기 문서'}</p>
            <p className="text-2xl font-bold text-amber-600">{animPending}<span className="text-sm font-medium text-slate-400 ml-1">건</span></p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center space-x-4 print:border-slate-300 print:rounded-none">
          <div className="p-3.5 bg-violet-50 text-violet-600 rounded-xl print:bg-transparent print:p-0">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">총 자산가액</p>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{formatCurrency(animTotalValue)}</p>
          </div>
        </div>
      </div>

      {/* 카테고리·상태 차트 (원본 grid 유지) */}
      {stats.totalCount > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:block print:space-y-4">

          {/* 품목별 비중 (원본 PieChart 바 차트) */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col print:border-slate-300 print:rounded-none">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center">
                <PieChart className="w-5 h-5 mr-2 text-slate-400" />
                품목별 비중
              </h3>
            </div>
            <div className="w-full h-8 flex rounded-lg overflow-hidden mb-6 shadow-inner print:border print:border-slate-300">
              {stats.categoryChartData.map((data, idx) => (
                <div
                  key={data.name}
                  className={`h-full ${CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} print:bg-gray-400 border-r border-white`}
                  style={{ width: `${data.percentage}%` }}
                  title={`${data.name}: ${formatCurrency(data.value)}`}
                />
              ))}
            </div>
            <div className="flex-1 overflow-auto pr-2 custom-scrollbar print:overflow-visible">
              <div className="space-y-3">
                {stats.categoryChartData.map((data, idx) => (
                  <div key={data.name} className="flex items-center justify-between text-sm border-b border-slate-50 dark:border-slate-700 pb-2 print:border-slate-200">
                    <div className="flex items-center">
                      <span className={`w-3 h-3 rounded-full mr-3 ${CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} print:hidden`} />
                      <span className="font-medium text-slate-700 dark:text-slate-300">{data.name}</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-slate-400 dark:text-slate-500 w-12 text-right">{data.percentage.toFixed(1)}%</span>
                      <span className="font-bold text-slate-800 dark:text-slate-100 w-24 text-right">{formatCurrency(data.value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 자산 상태 요약 (원본 BarChart3) */}
          <div className="flex flex-col gap-6 print:block print:mt-4">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm print:border-slate-300 print:rounded-none">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-slate-400" />
                자산 상태 요약
              </h3>
              <div className="flex space-x-2">
                {DISPLAY_STATUSES.map((status) => {
                  const count = stats.statusCounts[status] ?? 0
                  if (count === 0) return null
                  return (
                    <div key={status} className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4 text-center print:rounded-none print:border-slate-300">
                      <p className="text-xs font-bold mb-1 opacity-80 text-slate-600 dark:text-slate-400">{status}</p>
                      <p className="text-2xl font-black text-slate-800 dark:text-slate-100"><AnimatedCount value={count} /></p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  )
}
