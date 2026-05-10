'use client'

import { useEffect, useState } from 'react'
import { PieChart, TrendingUp, Building2, RefreshCcw } from 'lucide-react'
import { Skeleton } from '@/components/ui'
import DonutChart        from './charts/DonutChart'
import LineChart         from './charts/LineChart'
import HorizontalBarChart from './charts/HorizontalBarChart'

interface CategorySlice {
  category:   string
  label:      string
  count:      number
  percentage: number
  color:      string
}

interface MonthPoint {
  year:  number
  month: number
  label: string
  count: number
}

interface DeptBar {
  dept:       string
  totalValue: number
  percentage: number
}

interface ChartsResponse {
  categoryData:  CategorySlice[]
  monthlyData:   MonthPoint[]
  deptValueData: DeptBar[]
}

function ChartCard({
  title,
  icon,
  children,
  loading,
}: {
  title:    string
  icon:     React.ReactNode
  children: React.ReactNode
  loading:  boolean
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-slate-400 dark:text-slate-500">{icon}</span>
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">{title}</h3>
      </div>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ) : (
        children
      )}
    </div>
  )
}

export default function StatsCharts() {
  const [data,    setData]    = useState<ChartsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    fetch('/api/stats/charts')
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((json) => {
        const d = json?.data ?? json
        if (d?.categoryData) setData(d as ChartsResponse)
        else setError(true)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  if (error) return null  // 데이터 없으면 섹션 자체 숨김

  const totalCount = data?.categoryData.reduce((s, c) => s + c.count, 0) ?? 0

  // 데이터가 모두 0이면 차트 섹션 표시 안 함
  if (!loading && totalCount === 0) return null

  return (
    <section aria-label="자산 현황 차트">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-slate-400" />
        <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          자산 현황 차트
        </h2>
      </div>

      {/* 모바일 1열, 데스크톱 2열 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">

        {/* ① 카테고리별 자산 현황 — 도넛 차트 */}
        <ChartCard
          title="카테고리별 자산 현황"
          icon={<PieChart className="w-4 h-4" />}
          loading={loading}
        >
          {data && data.categoryData.length > 0 ? (
            <DonutChart data={data.categoryData} total={totalCount} />
          ) : (
            <EmptyState />
          )}
        </ChartCard>

        {/* ② 월별 자산 등록 추이 — 라인 차트 */}
        <ChartCard
          title="월별 자산 등록 추이 (최근 12개월)"
          icon={<TrendingUp className="w-4 h-4" />}
          loading={loading}
        >
          {data && data.monthlyData.length > 0 ? (
            <LineChart data={data.monthlyData} />
          ) : (
            <EmptyState />
          )}
        </ChartCard>

        {/* ③ 부서별 자산 금액 — 수평 바 차트 (2열 가득 채우기) */}
        <ChartCard
          title="부서별 자산 금액 현황 (상위 7개)"
          icon={<Building2 className="w-4 h-4" />}
          loading={loading}
        >
          {data && data.deptValueData.length > 0 ? (
            <HorizontalBarChart data={data.deptValueData} />
          ) : (
            <EmptyState />
          )}
        </ChartCard>

        {/* ④ 빈 카드 — 로딩 중에만 표시해서 레이아웃 유지 */}
        {loading && (
          <ChartCard title="" icon={<RefreshCcw className="w-4 h-4" />} loading={true}>
            <></>
          </ChartCard>
        )}
      </div>
    </section>
  )
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
      데이터가 없습니다.
    </div>
  )
}
