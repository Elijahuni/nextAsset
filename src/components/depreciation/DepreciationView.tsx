'use client'

import { useEffect, useState } from 'react'
import { Calculator, RefreshCcw, Lock } from 'lucide-react'
import { useUser } from '@/context/user-context'
import { calculateDepreciation } from '@/lib/depreciation'
import { ASSET_CATEGORY_LABEL, formatCurrency } from '@/lib/utils'

interface ApiAsset {
  id: string
  code: string
  name: string
  category: string
  price: string | number
  acquiredDate: string
}

export default function DepreciationView() {
  const { canManageSystem } = useUser()
  const [assets, setAssets] = useState<ApiAsset[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/assets')
      .then((r) => r.json())
      .then((data: ApiAsset[]) => setAssets(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

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
        <span className="text-slate-500">불러오는 중...</span>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none">
      <div className="p-6 border-b border-slate-200 bg-slate-50/50 print:hidden">
        <h2 className="text-lg font-bold text-slate-800 flex items-center mb-1">
          <Calculator className="w-5 h-5 mr-2 text-emerald-600" /> 감가상각 명세서 (규정 적용)
        </h2>
        <p className="text-xs text-slate-500">
          * 품목 기준 [상각방법]과 [내용연수]에 따라 월 단위 누계액이 실시간으로 계산됩니다.
        </p>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar print:overflow-visible">
        <table className="w-full text-sm text-left text-slate-600 whitespace-nowrap print:text-xs">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 shadow-sm z-10 print:static print:bg-transparent print:border-b-2 print:border-black">
            <tr>
              <th className="px-6 py-4">자산코드 / 명칭</th>
              <th className="px-6 py-4 text-center">품목</th>
              <th className="px-6 py-4 text-center">상각방법 / 연수</th>
              <th className="px-6 py-4 text-center">취득일 (경과월)</th>
              <th className="px-6 py-4 text-right">취득가액</th>
              <th className="px-6 py-4 text-right text-red-500">당기 상각누계액</th>
              <th className="px-6 py-4 text-right text-blue-600">장부가액</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => {
              const { accumulated, bookValue, monthsElapsed, totalMonths, rule } =
                calculateDepreciation(asset.acquiredDate, Number(asset.price), asset.category)
              const fullyDepreciated = monthsElapsed >= totalMonths || bookValue <= 1000
              return (
                <tr
                  key={asset.id}
                  className={`border-b border-slate-100 print:border-slate-300 transition-colors ${fullyDepreciated ? 'bg-slate-50/50' : 'bg-white hover:bg-slate-50/50'}`}
                >
                  <td className="px-6 py-3">
                    <p className="font-mono text-xs text-slate-400">{asset.code}</p>
                    <p className="font-bold text-slate-800">{asset.name}</p>
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md text-xs font-medium border border-slate-200">
                      {ASSET_CATEGORY_LABEL[asset.category] ?? asset.category}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${rule.method === '정액법' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-violet-50 text-violet-700 border-violet-200'}`}>
                      {rule.method} ({rule.years}년)
                    </span>
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className="block font-mono text-xs">{asset.acquiredDate?.split('T')[0] ?? '-'}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${fullyDepreciated ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                      {monthsElapsed}/{totalMonths}개월
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">{formatCurrency(Number(asset.price))}</td>
                  <td className="px-6 py-3 text-right text-red-500">- {formatCurrency(accumulated)}</td>
                  <td className="px-6 py-3 text-right font-bold text-blue-600">{formatCurrency(bookValue)}</td>
                </tr>
              )
            })}
            {assets.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-16 text-slate-400">
                  등록된 자산이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
