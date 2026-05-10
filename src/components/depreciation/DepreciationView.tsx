'use client'

import { useCallback, useEffect, useState } from 'react'
import { Calculator, RefreshCcw, Lock, Settings, Download } from 'lucide-react'
import { useUser } from '@/context/user-context'
import { ASSET_CATEGORY_LABEL, formatCurrency } from '@/lib/utils'
import DepreciationRuleModal, { type DepreciationRules } from './DepreciationRuleModal'

interface CalcRow {
  id:               string
  code:             string
  name:             string
  category:         string
  price:            number
  acquiredDate:     string
  usefulYears:      number
  method:           string
  monthsElapsed:    number
  totalMonths:      number
  bookValue:        number
  accumulated:      number
  annualDepreciation: number
  salvageValue:     number
  endOfLifeDate:    string
  fullyDepreciated: boolean
}

interface CategoryGroup {
  category:    string
  rows:        CalcRow[]
  totalPrice:  number
  totalAccum:  number
  totalBook:   number
  totalAnnual: number
}

function groupByCategory(rows: CalcRow[]): CategoryGroup[] {
  const map = new Map<string, CalcRow[]>()
  for (const row of rows) {
    if (!map.has(row.category)) map.set(row.category, [])
    map.get(row.category)!.push(row)
  }
  return Array.from(map.entries()).map(([category, items]) => ({
    category,
    rows:        items,
    totalPrice:  items.reduce((s, r) => s + r.price,            0),
    totalAccum:  items.reduce((s, r) => s + r.accumulated,      0),
    totalBook:   items.reduce((s, r) => s + r.bookValue,        0),
    totalAnnual: items.reduce((s, r) => s + r.annualDepreciation, 0),
  }))
}

function exportCSV(rows: CalcRow[]) {
  const BOM = '﻿'
  const headers = [
    '자산코드', '자산명', '품목', '상각방법', '내용연수(년)',
    '취득일', '내용연수종료일', '경과월', '전체월',
    '취득가액', '상각누계액', '연간감가상각비', '잔존가치', '현재장부가', '상각완료여부',
  ]
  const escape = (v: string | number | boolean) => `"${String(v).replace(/"/g, '""')}"`

  const lines = rows.map((r) => [
    escape(r.code),
    escape(r.name),
    escape(ASSET_CATEGORY_LABEL[r.category] ?? r.category),
    escape(r.method),
    escape(r.usefulYears),
    escape(r.acquiredDate),
    escape(r.endOfLifeDate),
    escape(r.monthsElapsed),
    escape(r.totalMonths),
    escape(r.price),
    escape(r.accumulated),
    escape(r.annualDepreciation),
    escape(r.salvageValue),
    escape(r.bookValue),
    escape(r.fullyDepreciated ? 'Y' : 'N'),
  ].join(','))

  const csv  = BOM + [headers.join(','), ...lines].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `감가상각명세서_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function DepreciationView() {
  const { canManageSystem } = useUser()
  const [rows,       setRows]       = useState<CalcRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [customRules, setCustomRules] = useState<DepreciationRules>({})
  const [isRuleOpen, setIsRuleOpen] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/settings/depreciation-rules').then((r) => r.ok ? r.json() : null),
      fetch('/api/depreciation/calculate').then((r) => r.json()),
    ])
      .then(([rules, calc]) => {
        if (rules?.data && typeof rules.data === 'object') setCustomRules(rules.data as DepreciationRules)
        else if (rules && typeof rules === 'object' && !rules.data) setCustomRules(rules as DepreciationRules)
        const data = calc?.data ?? calc
        if (Array.isArray(data)) setRows(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // 규칙 저장 후 계산 결과 재로드
  const handleRuleSave = (rules: DepreciationRules) => {
    setCustomRules(rules)
    load()
  }

  if (!canManageSystem) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Lock className="w-10 h-10 mb-3 opacity-30" />
        <p className="font-semibold">접근 권한이 없습니다.</p>
        <p className="text-sm mt-1">시스템 관리자만 감가상각 명세서를 조회할 수 있습니다.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCcw className="w-5 h-5 animate-spin text-blue-500 mr-2" />
        <span className="text-slate-500">계산 중...</span>
      </div>
    )
  }

  const groups = groupByCategory(rows)
  const grand  = {
    price:  rows.reduce((s, r) => s + r.price,             0),
    accum:  rows.reduce((s, r) => s + r.accumulated,       0),
    book:   rows.reduce((s, r) => s + r.bookValue,         0),
    annual: rows.reduce((s, r) => s + r.annualDepreciation, 0),
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden print:border-none print:shadow-none">
      {/* 헤더 */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 print:hidden flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center mb-1">
            <Calculator className="w-5 h-5 mr-2 text-emerald-600" /> 감가상각 명세서 (DB 규칙 적용)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            * DB에 저장된 품목별 규칙(상각방법·내용연수)을 서버에서 계산합니다. 월 단위 누계 기준.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCSV(rows)}
            disabled={rows.length === 0}
            className="flex items-center px-4 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Download className="w-4 h-4 mr-1.5" /> CSV 내보내기
          </button>
          <button
            onClick={() => setIsRuleOpen(true)}
            className="flex items-center px-4 py-2 text-sm font-semibold text-slate-700 bg-white dark:bg-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors shadow-sm whitespace-nowrap"
          >
            <Settings className="w-4 h-4 mr-1.5 text-slate-500" /> 규칙 편집
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-900/20 print:hidden">
          {[
            { label: '취득원가 합계',   value: grand.price,  color: 'text-slate-700 dark:text-slate-200' },
            { label: '상각누계액',       value: grand.accum,  color: 'text-red-500' },
            { label: '당기 감가상각비', value: grand.annual, color: 'text-violet-600 dark:text-violet-400' },
            { label: '현재 장부가 합계', value: grand.book,   color: 'text-blue-600 dark:text-blue-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 shadow-sm text-center">
              <p className="text-xs text-slate-400 mb-1">{label}</p>
              <p className={`text-base font-bold truncate ${color}`}>{formatCurrency(value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* 테이블 */}
      <div className="flex-1 overflow-auto custom-scrollbar print:overflow-visible">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Calculator className="w-10 h-10 mb-3 opacity-30" />
            <p>등록된 자산이 없습니다.</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300 whitespace-nowrap print:text-xs">
            <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900 sticky top-0 z-10 shadow-sm print:static print:bg-transparent print:border-b-2 print:border-black">
              <tr>
                <th className="px-5 py-3">자산코드 / 명칭</th>
                <th className="px-5 py-3 text-center">상각방법 / 연수</th>
                <th className="px-5 py-3 text-center">취득일</th>
                <th className="px-5 py-3 text-center">만료일</th>
                <th className="px-5 py-3 text-center">경과/전체</th>
                <th className="px-5 py-3 text-right">취득가액</th>
                <th className="px-5 py-3 text-right text-red-500">상각누계액</th>
                <th className="px-5 py-3 text-right text-violet-600 dark:text-violet-400">연간감가상각비</th>
                <th className="px-5 py-3 text-right text-blue-600 dark:text-blue-400">현재장부가</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <>
                  {/* 카테고리 행 */}
                  <tr key={`cat-${group.category}`} className="bg-slate-100 dark:bg-slate-900/60 border-t-2 border-slate-300 dark:border-slate-600">
                    <td colSpan={5} className="px-5 py-2">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                        {ASSET_CATEGORY_LABEL[group.category] ?? group.category}
                        <span className="ml-2 text-slate-400 font-normal">({group.rows.length}건)</span>
                      </span>
                    </td>
                    <td className="px-5 py-2 text-right text-xs font-bold text-slate-600 dark:text-slate-300">
                      {formatCurrency(group.totalPrice)}
                    </td>
                    <td className="px-5 py-2 text-right text-xs font-bold text-red-500">
                      - {formatCurrency(group.totalAccum)}
                    </td>
                    <td className="px-5 py-2 text-right text-xs font-bold text-violet-600 dark:text-violet-400">
                      {formatCurrency(group.totalAnnual)}
                    </td>
                    <td className="px-5 py-2 text-right text-xs font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(group.totalBook)}
                    </td>
                  </tr>

                  {/* 자산 행 */}
                  {group.rows.map((row) => (
                    <tr
                      key={row.id}
                      className={`border-b border-slate-100 dark:border-slate-700/60 transition-colors ${
                        row.fullyDepreciated
                          ? 'bg-slate-50/60 dark:bg-slate-800/40 opacity-70'
                          : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                      }`}
                    >
                      <td className="px-5 py-2.5">
                        <p className="font-mono text-[10px] text-slate-400">{row.code}</p>
                        <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{row.name}</p>
                      </td>
                      <td className="px-5 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          row.method === '정액법'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-violet-50 text-violet-700 border-violet-200'
                        }`}>
                          {row.method} ({row.usefulYears}년)
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-center font-mono text-xs text-slate-500">
                        {row.acquiredDate}
                      </td>
                      <td className="px-5 py-2.5 text-center font-mono text-xs">
                        <span className={row.fullyDepreciated ? 'text-red-500 font-bold' : 'text-slate-500'}>
                          {row.endOfLifeDate}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-center">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          row.fullyDepreciated ? 'bg-red-100 text-red-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                        }`}>
                          {row.monthsElapsed}/{row.totalMonths}개월
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-right text-slate-700 dark:text-slate-300">
                        {formatCurrency(row.price)}
                      </td>
                      <td className="px-5 py-2.5 text-right text-red-500">
                        - {formatCurrency(row.accumulated)}
                      </td>
                      <td className="px-5 py-2.5 text-right text-violet-600 dark:text-violet-400">
                        {row.fullyDepreciated ? '-' : formatCurrency(row.annualDepreciation)}
                      </td>
                      <td className="px-5 py-2.5 text-right font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(row.bookValue)}
                      </td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>

            {/* 총합계 행 */}
            <tfoot className="bg-slate-100 dark:bg-slate-900 border-t-2 border-slate-400 dark:border-slate-500 sticky bottom-0 print:static">
              <tr className="font-bold text-slate-800 dark:text-slate-100">
                <td colSpan={5} className="px-5 py-3 text-sm">
                  총합계 ({rows.length}건 / {groups.length}개 품목)
                </td>
                <td className="px-5 py-3 text-right">{formatCurrency(grand.price)}</td>
                <td className="px-5 py-3 text-right text-red-500">- {formatCurrency(grand.accum)}</td>
                <td className="px-5 py-3 text-right text-violet-600 dark:text-violet-400">{formatCurrency(grand.annual)}</td>
                <td className="px-5 py-3 text-right text-blue-600 dark:text-blue-400">{formatCurrency(grand.book)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {isRuleOpen && (
        <DepreciationRuleModal
          rules={customRules}
          onSave={handleRuleSave}
          onClose={() => setIsRuleOpen(false)}
        />
      )}
    </div>
  )
}
