'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Database, Monitor, FileSignature, Briefcase,
  PieChart, BarChart3, Sparkles, Bot, RefreshCcw,
} from 'lucide-react'
import { useUser } from '@/context/user-context'
import { CATEGORY_COLORS, ASSET_STATUS_LABEL, ASSET_CATEGORY_LABEL, formatCurrency } from '@/lib/utils'
import { calculateDepreciation } from '@/lib/depreciation'

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
      .then(([assetData, approvalData]: [ApiAsset[], unknown[]]) => {
        // 역할별 필터링 (원본 visibleAssets 로직)
        let filtered: ApiAsset[] = assetData
        if (currentUser.role === 'manager') {
          filtered = assetData.filter((a) => a.department === currentUser.department)
        } else if (currentUser.role === 'employee') {
          // employee는 자신에게 할당된 자산만 — API에 user 필드 없으므로 현재는 전체 표시
          filtered = assetData
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCcw className="w-6 h-6 animate-spin text-blue-500 mr-3" />
        <span className="text-slate-500">데이터를 불러오는 중...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 print:space-y-4">

      {/* AI 자산 분석 보고서 (원본 UI 그대로) */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-2xl border border-indigo-100 shadow-sm print:hidden relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Bot className="w-24 h-24 text-indigo-900" />
        </div>
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
            <h3 className="font-bold text-indigo-900 flex items-center text-lg">
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
          <div className="bg-white/70 backdrop-blur-sm p-4 rounded-xl border border-indigo-50/50 min-h-[80px] flex items-center">
            {isAiLoading ? (
              <p className="text-indigo-600 font-medium animate-pulse">AI가 현재 자산 통계를 분석하여 보고서를 작성하고 있습니다...</p>
            ) : aiReport ? (
              <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">{aiReport}</p>
            ) : (
              <p className="text-slate-500 text-sm">상단의 버튼을 눌러 우리 회사의 자산 건전성 분석 보고서를 받아보세요.</p>
            )}
          </div>
        </div>
      </div>

      {/* 통계 카드 4개 (원본 grid 유지) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 print:gap-2 print:grid-cols-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4 print:border-slate-300 print:rounded-none">
          <div className="p-3.5 bg-blue-50 text-blue-600 rounded-xl print:bg-transparent print:p-0">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium mb-1">총 보유 자산</p>
            <p className="text-2xl font-bold text-slate-800">{stats.totalCount}<span className="text-sm font-medium text-slate-400 ml-1">건</span></p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4 print:border-slate-300 print:rounded-none">
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl print:bg-transparent print:p-0">
            <Monitor className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium mb-1">사용중인 자산</p>
            <p className="text-2xl font-bold text-slate-800">{stats.inUseCount}<span className="text-sm font-medium text-slate-400 ml-1">건</span></p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4 cursor-pointer hover:shadow-md transition-shadow group print:border-slate-300 print:rounded-none">
          <div className="p-3.5 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-100 transition-colors print:bg-transparent print:p-0">
            <FileSignature className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium mb-1">{isEmployee ? '내가 올린 결재' : '결재 대기 문서'}</p>
            <p className="text-2xl font-bold text-amber-600">{stats.pendingApprovals}<span className="text-sm font-medium text-slate-400 ml-1">건</span></p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4 print:border-slate-300 print:rounded-none">
          <div className="p-3.5 bg-violet-50 text-violet-600 rounded-xl print:bg-transparent print:p-0">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium mb-1">총 자산가액</p>
            <p className="text-xl font-bold text-slate-800">{formatCurrency(stats.totalValue)}</p>
          </div>
        </div>
      </div>

      {/* 카테고리·상태 차트 (원본 grid 유지) */}
      {stats.totalCount > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:block print:space-y-4">

          {/* 품목별 비중 (원본 PieChart 바 차트) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col print:border-slate-300 print:rounded-none">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center">
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
                  <div key={data.name} className="flex items-center justify-between text-sm border-b border-slate-50 pb-2 print:border-slate-200">
                    <div className="flex items-center">
                      <span className={`w-3 h-3 rounded-full mr-3 ${CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} print:hidden`} />
                      <span className="font-medium text-slate-700">{data.name}</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-slate-400 w-12 text-right">{data.percentage.toFixed(1)}%</span>
                      <span className="font-bold text-slate-800 w-24 text-right">{formatCurrency(data.value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 자산 상태 요약 (원본 BarChart3) */}
          <div className="flex flex-col gap-6 print:block print:mt-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm print:border-slate-300 print:rounded-none">
              <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-slate-400" />
                자산 상태 요약
              </h3>
              <div className="flex space-x-2">
                {DISPLAY_STATUSES.map((status) => {
                  const count = stats.statusCounts[status] ?? 0
                  if (count === 0) return null
                  return (
                    <div key={status} className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center print:rounded-none print:border-slate-300">
                      <p className="text-xs font-bold mb-1 opacity-80 text-slate-600">{status}</p>
                      <p className="text-2xl font-black text-slate-800">{count}</p>
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
