'use client'

import { useEffect, useState } from 'react'
import { BarChart3, Building2, CalendarDays, Download, Printer, Lock, FileSpreadsheet, UserCheck } from 'lucide-react'
import { useUser } from '@/context/user-context'
import { ASSET_CATEGORY_LABEL, ASSET_STATUS_LABEL, formatCurrency } from '@/lib/utils'
import { calculateDepreciation } from '@/lib/depreciation'
import { Skeleton } from '@/components/ui'

interface RawAsset {
  id:          string
  code:        string
  name:        string
  category:    string
  department:  string
  location:    string
  status:      string
  price:       string | number
  acquiredDate:string
  subCategory?: string | null
  description?: string | null
  size?:       string | null
  color?:      string | null
  barcode?:    string | null
  remarks?:    string | null
  assignedTo?: string | null
}

type TabKey = 'dept' | 'year' | 'assignee'

export default function ReportsView() {
  const { isEmployee, canManageSystem } = useUser()
  const [assets,  setAssets]  = useState<RawAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState<TabKey>('dept')

  useEffect(() => {
    fetch('/api/assets')
      .then((r) => r.json())
      .then((data: RawAsset[]) => setAssets(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (isEmployee) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Lock className="w-10 h-10 mb-3 opacity-30" />
        <p className="font-semibold">접근 권한이 없습니다.</p>
        <p className="text-sm mt-1">관리자 또는 부서장만 보고서를 조회할 수 있습니다.</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">

      {/* 헤더 */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 print:hidden">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">출력 보고서</h2>
          {!loading && (
            <span className="text-xs text-slate-400 dark:text-slate-500">총 {assets.length.toLocaleString()}건</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canManageSystem && (
            <button
              onClick={() => handleDetailExcel(assets)}
              className="flex items-center px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-700"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" /> 상세 엑셀 다운
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="flex items-center px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" /> 인쇄
          </button>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 px-4 bg-slate-50/30 dark:bg-slate-900/30 print:hidden">
        {([
          { key: 'dept'     as TabKey, label: '부서별 자산현황',  icon: <Building2  className="w-4 h-4" /> },
          { key: 'year'     as TabKey, label: '연도별 취득현황',  icon: <CalendarDays className="w-4 h-4" /> },
          { key: 'assignee' as TabKey, label: '담당자별 현황',    icon: <UserCheck  className="w-4 h-4" /> },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-auto custom-scrollbar p-6">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : tab === 'dept' ? (
          <DeptReport assets={assets} canSeePrice={canManageSystem} />
        ) : tab === 'year' ? (
          <YearReport assets={assets} canSeePrice={canManageSystem} />
        ) : (
          <AssigneeReport assets={assets} canSeePrice={canManageSystem} />
        )}
      </div>
    </div>
  )
}

// ── 상세 엑셀 다운로드 (감가상각 포함) ─────────────────────────────────────────
function handleDetailExcel(assets: RawAsset[]) {
  const header = [
    '자산코드', '자산명', '분류', '중분류', '세부정보', '사이즈', '색상',
    '담당자', '부서', '위치', '상태', '취득가액', '취득일',
    '누적상각액', '장부가액', '상각률(%)',
    '시리얼번호', '비고',
  ]
  const rows = assets.map((a) => {
    const price = Number(a.price)
    const { accumulated, bookValue } = calculateDepreciation(a.acquiredDate, price, a.category)
    const rate = price > 0 ? Math.round((accumulated / price) * 100) : 0
    return [
      a.code, a.name,
      ASSET_CATEGORY_LABEL[a.category] ?? a.category,
      a.subCategory ?? '',
      a.description ?? '',
      a.size ?? '',
      a.color ?? '',
      a.assignedTo ?? '',
      a.department,
      a.location,
      ASSET_STATUS_LABEL[a.status] ?? a.status,
      price.toLocaleString(),
      a.acquiredDate?.split('T')[0] ?? '',
      accumulated.toLocaleString(),
      bookValue.toLocaleString(),
      String(rate),
      a.barcode ?? '',
      a.remarks ?? '',
    ]
  })
  const csv  = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `자산상세보고서_${new Date().toISOString().split('T')[0]}.csv`; a.click()
  URL.revokeObjectURL(url)
}

// ── 부서별 자산현황 ─────────────────────────────────────────────────────────────
function DeptReport({ assets, canSeePrice }: { assets: RawAsset[]; canSeePrice: boolean }) {
  type DeptRow = { dept: string; count: number; totalPrice: number; bookValue: number; byStatus: Record<string, number> }

  const map = new Map<string, DeptRow>()
  for (const a of assets) {
    const price = Number(a.price)
    const { bookValue } = calculateDepreciation(a.acquiredDate, price, a.category)
    const row = map.get(a.department) ?? { dept: a.department, count: 0, totalPrice: 0, bookValue: 0, byStatus: {} }
    row.count++
    row.totalPrice += price
    row.bookValue  += bookValue
    row.byStatus[a.status] = (row.byStatus[a.status] ?? 0) + 1
    map.set(a.department, row)
  }

  const rows = Array.from(map.values()).sort((a, b) => b.count - a.count)
  const totals = rows.reduce((acc, r) => ({ count: acc.count + r.count, totalPrice: acc.totalPrice + r.totalPrice, bookValue: acc.bookValue + r.bookValue }), { count: 0, totalPrice: 0, bookValue: 0 })
  const maxCount = Math.max(...rows.map((r) => r.count), 1)

  const handleCsvExport = () => {
    const header = canSeePrice
      ? ['부서', '자산수', '취득가액 합계', '장부가액 합계', '사용중', '사용가능', '수리중', '보관중', '처분']
      : ['부서', '자산수', '사용중', '사용가능', '수리중', '보관중', '처분']
    const dataRows = rows.map((r) => canSeePrice
      ? [r.dept, r.count, r.totalPrice, r.bookValue, r.byStatus.IN_USE ?? 0, r.byStatus.AVAILABLE ?? 0, r.byStatus.UNDER_MAINTENANCE ?? 0, r.byStatus.RETIRED ?? 0, r.byStatus.DISPOSED ?? 0]
      : [r.dept, r.count, r.byStatus.IN_USE ?? 0, r.byStatus.AVAILABLE ?? 0, r.byStatus.UNDER_MAINTENANCE ?? 0, r.byStatus.RETIRED ?? 0, r.byStatus.DISPOSED ?? 0]
    )
    const csv  = [header, ...dataRows].map((row) => row.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `부서별자산현황_${new Date().toISOString().split('T')[0]}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          총 {rows.length}개 부서 · {totals.count.toLocaleString()}건
        </p>
        <button
          onClick={handleCsvExport}
          className="flex items-center px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors gap-1.5"
        >
          <Download className="w-3.5 h-3.5" /> CSV 다운
        </button>
      </div>

      {/* 인쇄 헤더 */}
      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold">부서별 자산현황</h1>
        <p className="text-sm text-slate-500">{new Date().toLocaleDateString('ko-KR')} 기준</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
              <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">부서</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-300">자산수</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300 w-40 print:hidden">비율</th>
              {canSeePrice && <>
                <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">취득가액</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">장부가액</th>
              </>}
              <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-300">사용중</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-300">사용가능</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-300">기타</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.dept} className={`border-b border-slate-100 dark:border-slate-700 ${i % 2 === 0 ? '' : 'bg-slate-50/40 dark:bg-slate-700/20'}`}>
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{row.dept}</td>
                <td className="px-4 py-3 text-center font-bold text-slate-900 dark:text-slate-100">{row.count.toLocaleString()}</td>
                <td className="px-4 py-3 print:hidden">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 bg-blue-500 rounded-full transition-all"
                        style={{ width: `${Math.round((row.count / maxCount) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 w-8 text-right">{Math.round((row.count / totals.count) * 100)}%</span>
                  </div>
                </td>
                {canSeePrice && <>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{formatCurrency(row.totalPrice)}</td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{formatCurrency(row.bookValue)}</td>
                </>}
                <td className="px-4 py-3 text-center">
                  <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                    {(row.byStatus.IN_USE ?? 0).toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                    {(row.byStatus.AVAILABLE ?? 0).toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-xs text-slate-400">
                  {((row.byStatus.UNDER_MAINTENANCE ?? 0) + (row.byStatus.RETIRED ?? 0) + (row.byStatus.DISPOSED ?? 0)).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 dark:bg-slate-700/60 border-t-2 border-slate-300 dark:border-slate-500 font-bold">
              <td className="px-4 py-3 text-slate-800 dark:text-slate-100">합계</td>
              <td className="px-4 py-3 text-center text-slate-900 dark:text-slate-100">{totals.count.toLocaleString()}</td>
              <td className="px-4 py-3 print:hidden" />
              {canSeePrice && <>
                <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-100">{formatCurrency(totals.totalPrice)}</td>
                <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-100">{formatCurrency(totals.bookValue)}</td>
              </>}
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ── 연도별 취득현황 ─────────────────────────────────────────────────────────────
function YearReport({ assets, canSeePrice }: { assets: RawAsset[]; canSeePrice: boolean }) {
  type YearRow = { year: number; count: number; totalPrice: number; byCategory: Record<string, number> }

  const map = new Map<number, YearRow>()
  for (const a of assets) {
    const year = new Date(a.acquiredDate).getFullYear()
    if (isNaN(year)) continue
    const row = map.get(year) ?? { year, count: 0, totalPrice: 0, byCategory: {} }
    row.count++
    row.totalPrice += Number(a.price)
    row.byCategory[a.category] = (row.byCategory[a.category] ?? 0) + 1
    map.set(year, row)
  }

  const rows = Array.from(map.values()).sort((a, b) => a.year - b.year)
  const maxCount = Math.max(...rows.map((r) => r.count), 1)
  const totals = rows.reduce((acc, r) => ({ count: acc.count + r.count, totalPrice: acc.totalPrice + r.totalPrice }), { count: 0, totalPrice: 0 })

  const handleCsvExport = () => {
    const cats = Array.from(new Set(assets.map((a) => a.category)))
    const header = ['연도', '취득건수', ...(canSeePrice ? ['취득가액 합계'] : []), ...cats.map((c) => ASSET_CATEGORY_LABEL[c] ?? c)]
    const dataRows = rows.map((r) => [r.year, r.count, ...(canSeePrice ? [r.totalPrice] : []), ...cats.map((c) => r.byCategory[c] ?? 0)])
    const csv  = [header, ...dataRows].map((row) => row.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `연도별취득현황_${new Date().toISOString().split('T')[0]}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {rows.length > 0 ? `${rows[0].year}년 ~ ${rows[rows.length - 1].year}년` : '-'} · 총 {totals.count.toLocaleString()}건
        </p>
        <button
          onClick={handleCsvExport}
          className="flex items-center px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors gap-1.5"
        >
          <Download className="w-3.5 h-3.5" /> CSV 다운
        </button>
      </div>

      {/* 인쇄 헤더 */}
      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold">연도별 자산 취득현황</h1>
        <p className="text-sm text-slate-500">{new Date().toLocaleDateString('ko-KR')} 기준</p>
      </div>

      {/* 바 차트 */}
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.year} className="flex items-center gap-3">
            <span className="w-12 text-xs font-bold text-slate-600 dark:text-slate-300 text-right shrink-0">
              {row.year}
            </span>
            <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-7 overflow-hidden">
              <div
                className="h-7 bg-gradient-to-r from-blue-500 to-blue-400 rounded-full flex items-center px-3 transition-all"
                style={{ width: `${Math.max(4, Math.round((row.count / maxCount) * 100))}%` }}
              >
                <span className="text-white text-xs font-bold whitespace-nowrap">{row.count}건</span>
              </div>
            </div>
            {canSeePrice && (
              <span className="text-xs text-slate-500 dark:text-slate-400 w-28 text-right shrink-0">
                {formatCurrency(row.totalPrice)}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* 상세 테이블 */}
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
              <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">연도</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-300">취득건수</th>
              {canSeePrice && <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">취득가액 합계</th>}
              <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">주요 품목</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const topCats = Object.entries(row.byCategory).sort(([, a], [, b]) => b - a).slice(0, 3)
              return (
                <tr key={row.year} className={`border-b border-slate-100 dark:border-slate-700 ${i % 2 === 0 ? '' : 'bg-slate-50/40 dark:bg-slate-700/20'}`}>
                  <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">{row.year}년</td>
                  <td className="px-4 py-3 text-center font-semibold text-slate-800 dark:text-slate-200">{row.count.toLocaleString()}</td>
                  {canSeePrice && <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{formatCurrency(row.totalPrice)}</td>}
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {topCats.map(([cat, cnt]) => (
                        <span key={cat} className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                          {ASSET_CATEGORY_LABEL[cat] ?? cat} {cnt}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 dark:bg-slate-700/60 border-t-2 border-slate-300 dark:border-slate-500 font-bold">
              <td className="px-4 py-3 text-slate-800 dark:text-slate-100">합계</td>
              <td className="px-4 py-3 text-center text-slate-900 dark:text-slate-100">{totals.count.toLocaleString()}</td>
              {canSeePrice && <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-100">{formatCurrency(totals.totalPrice)}</td>}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ── 담당자별 현황 ─────────────────────────────────────────────────────────────
function AssigneeReport({ assets, canSeePrice }: { assets: RawAsset[]; canSeePrice: boolean }) {
  type AssigneeRow = { assignee: string; count: number; totalPrice: number; bookValue: number; byStatus: Record<string, number>; byCategory: Record<string, number> }

  const map = new Map<string, AssigneeRow>()
  for (const a of assets) {
    const key = a.assignedTo?.trim() || '(미지정)'
    const price = Number(a.price)
    const { bookValue } = calculateDepreciation(a.acquiredDate, price, a.category)
    const row = map.get(key) ?? { assignee: key, count: 0, totalPrice: 0, bookValue: 0, byStatus: {}, byCategory: {} }
    row.count++
    row.totalPrice += price
    row.bookValue  += bookValue
    row.byStatus[a.status]     = (row.byStatus[a.status]     ?? 0) + 1
    row.byCategory[a.category] = (row.byCategory[a.category] ?? 0) + 1
    map.set(key, row)
  }

  const rows = Array.from(map.values()).sort((a, b) => {
    if (a.assignee === '(미지정)') return 1
    if (b.assignee === '(미지정)') return -1
    return b.count - a.count
  })
  const totals = rows.reduce((acc, r) => ({ count: acc.count + r.count, totalPrice: acc.totalPrice + r.totalPrice, bookValue: acc.bookValue + r.bookValue }), { count: 0, totalPrice: 0, bookValue: 0 })
  const maxCount = Math.max(...rows.map((r) => r.count), 1)

  const handleCsvExport = () => {
    const header = canSeePrice
      ? ['담당자', '자산수', '취득가액 합계', '장부가액 합계', '사용중', '사용가능', '수리중', '보관중', '처분']
      : ['담당자', '자산수', '사용중', '사용가능', '수리중', '보관중', '처분']
    const dataRows = rows.map((r) => canSeePrice
      ? [r.assignee, r.count, r.totalPrice, r.bookValue, r.byStatus.IN_USE ?? 0, r.byStatus.AVAILABLE ?? 0, r.byStatus.UNDER_MAINTENANCE ?? 0, r.byStatus.RETIRED ?? 0, r.byStatus.DISPOSED ?? 0]
      : [r.assignee, r.count, r.byStatus.IN_USE ?? 0, r.byStatus.AVAILABLE ?? 0, r.byStatus.UNDER_MAINTENANCE ?? 0, r.byStatus.RETIRED ?? 0, r.byStatus.DISPOSED ?? 0]
    )
    const csv  = [header, ...dataRows].map((row) => row.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `담당자별자산현황_${new Date().toISOString().split('T')[0]}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const unassignedCount = rows.find((r) => r.assignee === '(미지정)')?.count ?? 0

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            총 {rows.length}명 · {totals.count.toLocaleString()}건
          </p>
          {unassignedCount > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
              미지정 {unassignedCount}건
            </span>
          )}
        </div>
        <button
          onClick={handleCsvExport}
          className="flex items-center px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors gap-1.5"
        >
          <Download className="w-3.5 h-3.5" /> CSV 다운
        </button>
      </div>

      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold">담당자별 자산현황</h1>
        <p className="text-sm text-slate-500">{new Date().toLocaleDateString('ko-KR')} 기준</p>
      </div>

      {/* 바 차트 */}
      <div className="space-y-2 mb-4">
        {rows.slice(0, 15).map((row) => (
          <div key={row.assignee} className="flex items-center gap-3">
            <span className={`w-24 text-xs font-semibold text-right shrink-0 truncate ${row.assignee === '(미지정)' ? 'text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
              {row.assignee}
            </span>
            <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-6 overflow-hidden">
              <div
                className={`h-6 rounded-full flex items-center px-3 transition-all ${row.assignee === '(미지정)' ? 'bg-slate-300 dark:bg-slate-500' : 'bg-gradient-to-r from-violet-500 to-violet-400'}`}
                style={{ width: `${Math.max(4, Math.round((row.count / maxCount) * 100))}%` }}
              >
                <span className="text-white text-xs font-bold whitespace-nowrap">{row.count}건</span>
              </div>
            </div>
            {canSeePrice && (
              <span className="text-xs text-slate-500 dark:text-slate-400 w-28 text-right shrink-0">
                {formatCurrency(row.totalPrice)}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
              <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">담당자</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-300">자산수</th>
              {canSeePrice && <>
                <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">취득가액</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">장부가액</th>
              </>}
              <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-300">사용중</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-300">사용가능</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-300">기타</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.assignee} className={`border-b border-slate-100 dark:border-slate-700 ${i % 2 === 0 ? '' : 'bg-slate-50/40 dark:bg-slate-700/20'} ${row.assignee === '(미지정)' ? 'opacity-60' : ''}`}>
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                  {row.assignee === '(미지정)'
                    ? <span className="text-slate-400 text-xs italic">(미지정)</span>
                    : row.assignee
                  }
                </td>
                <td className="px-4 py-3 text-center font-bold text-slate-900 dark:text-slate-100">{row.count.toLocaleString()}</td>
                {canSeePrice && <>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300 font-medium">{formatCurrency(row.totalPrice)}</td>
                  <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400 font-semibold">{formatCurrency(row.bookValue)}</td>
                </>}
                <td className="px-4 py-3 text-center">
                  {(row.byStatus.IN_USE ?? 0) > 0
                    ? <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">{row.byStatus.IN_USE}</span>
                    : <span className="text-xs text-slate-300">-</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  {(row.byStatus.AVAILABLE ?? 0) > 0
                    ? <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">{row.byStatus.AVAILABLE}</span>
                    : <span className="text-xs text-slate-300">-</span>}
                </td>
                <td className="px-4 py-3 text-center text-xs text-slate-500 dark:text-slate-400">
                  {((row.byStatus.UNDER_MAINTENANCE ?? 0) + (row.byStatus.RETIRED ?? 0) + (row.byStatus.DISPOSED ?? 0)) || '-'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 dark:bg-slate-700/60 border-t-2 border-slate-300 dark:border-slate-500 font-bold">
              <td className="px-4 py-3 text-slate-800 dark:text-slate-100">합계</td>
              <td className="px-4 py-3 text-center text-slate-900 dark:text-slate-100">{totals.count.toLocaleString()}</td>
              {canSeePrice && <>
                <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-100">{formatCurrency(totals.totalPrice)}</td>
                <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400">{formatCurrency(totals.bookValue)}</td>
              </>}
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
