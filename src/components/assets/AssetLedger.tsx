'use client'

import { useEffect, useState } from 'react'
import { Search, Upload, Download, RefreshCcw, FileSignature } from 'lucide-react'
import { useUser } from '@/context/user-context'
import { ASSET_STATUS_LABEL, ASSET_CATEGORY_LABEL, formatCurrency } from '@/lib/utils'
import BulkUploadModal from './BulkUploadModal'

interface ApiAsset {
  id: string
  code: string
  name: string
  category: string
  department: string
  location: string
  status: string
  price: string | number
  acquiredDate: string
}

const STATUS_COLOR: Record<string, string> = {
  IN_USE:            'bg-blue-100 text-blue-800 border-blue-200',
  AVAILABLE:         'bg-emerald-100 text-emerald-800 border-emerald-200',
  UNDER_MAINTENANCE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  RETIRED:           'bg-slate-100 text-slate-600 border-slate-200',
  DISPOSED:          'bg-red-100 text-red-700 border-red-200',
}

export default function AssetLedger() {
  const { currentUser, canManageAssets, canManageSystem, isEmployee } = useUser()

  const [assets, setAssets] = useState<ApiAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isUploadOpen, setIsUploadOpen] = useState(false)

  const fetchAssets = () => {
    setLoading(true)
    fetch('/api/assets')
      .then((r) => r.json())
      .then((data: ApiAsset[]) => {
        let filtered = data
        if (currentUser.role === 'manager') {
          filtered = data.filter((a) => a.department === currentUser.department)
        }
        setAssets(filtered)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchAssets() }, [currentUser])

  const filteredAssets = assets.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const toggleAll = () => {
    setSelectedIds(selectedIds.length === filteredAssets.length ? [] : filteredAssets.map((a) => a.id))
  }

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const handleDownload = () => {
    const header = ['자산코드', '자산명', '품목', '부서', '위치', '상태', '취득가액', '취득일']
    const rows = filteredAssets.map((a) => [
      a.code, a.name,
      ASSET_CATEGORY_LABEL[a.category] ?? a.category,
      a.department, a.location,
      ASSET_STATUS_LABEL[a.status] ?? a.status,
      Number(a.price).toLocaleString(),
      a.acquiredDate?.split('T')[0] ?? '',
    ])
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = '자산원장.csv'; a.click()
    URL.revokeObjectURL(url)
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
    <div className="h-full flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

      {/* 툴바 */}
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 print:hidden">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            className="bg-white border border-slate-300 text-sm rounded-lg w-full pl-10 p-2.5 outline-none focus:ring-2 focus:ring-blue-300 transition-all"
            placeholder="자산명, 코드 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageAssets && (
            <>
              <button
                onClick={() => setIsUploadOpen(true)}
                className="flex items-center px-4 py-2.5 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors shadow-sm"
              >
                <Upload className="w-4 h-4 mr-2" /> 엑셀 업로드
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
              >
                <Download className="w-4 h-4 mr-2 text-slate-500" /> 엑셀 다운
              </button>
            </>
          )}
          <button className="flex items-center px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
            <FileSignature className="w-4 h-4 mr-2 text-slate-500" />
            결재 기안
            {selectedIds.length > 0 && <span className="ml-1 text-blue-600 font-bold">({selectedIds.length})</span>}
          </button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-sm text-left text-slate-600 whitespace-nowrap">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-4 w-10 print:hidden">
                <input type="checkbox" onChange={toggleAll} checked={filteredAssets.length > 0 && selectedIds.length === filteredAssets.length} className="w-4 h-4 cursor-pointer" />
              </th>
              <th className="px-6 py-4 font-semibold">상태</th>
              <th className="px-6 py-4 font-semibold">자산코드</th>
              <th className="px-6 py-4 font-semibold">품목</th>
              <th className="px-6 py-4 font-semibold">자산명칭</th>
              <th className="px-6 py-4 font-semibold">부서 / 위치</th>
              {!isEmployee && <th className="px-6 py-4 font-semibold text-right">취득가액</th>}
            </tr>
          </thead>
          <tbody>
            {filteredAssets.map((asset) => (
              <tr key={asset.id} className={`border-b border-slate-100 transition-colors ${selectedIds.includes(asset.id) ? 'bg-blue-50/60' : 'bg-white hover:bg-slate-50/80'}`}>
                <td className="px-4 py-3 print:hidden">
                  <input type="checkbox" checked={selectedIds.includes(asset.id)} onChange={() => toggleOne(asset.id)} className="w-4 h-4 cursor-pointer" />
                </td>
                <td className="px-6 py-3">
                  <span className={`px-2.5 py-1 text-[11px] font-bold rounded-md border ${STATUS_COLOR[asset.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {ASSET_STATUS_LABEL[asset.status] ?? asset.status}
                  </span>
                </td>
                <td className="px-6 py-3 font-mono text-xs text-slate-500">{asset.code}</td>
                <td className="px-6 py-3">
                  <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md text-xs font-medium border border-slate-200">
                    {ASSET_CATEGORY_LABEL[asset.category] ?? asset.category}
                  </span>
                </td>
                <td className="px-6 py-3 font-semibold text-slate-900">{asset.name}</td>
                <td className="px-6 py-3 text-xs">
                  <span className="font-medium text-slate-700">{asset.department}</span>
                  <br />
                  <span className="text-slate-400">{asset.location}</span>
                </td>
                {!isEmployee && (
                  <td className="px-6 py-3 text-right font-bold text-slate-800">
                    {formatCurrency(Number(asset.price))}
                  </td>
                )}
              </tr>
            ))}
            {filteredAssets.length === 0 && (
              <tr>
                <td colSpan={isEmployee ? 6 : 7} className="text-center py-16 text-slate-400">
                  {assets.length === 0 ? '등록된 자산이 없습니다. 엑셀 업로드로 자산을 추가해보세요.' : '검색 조건에 맞는 자산이 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-400">
        총 {filteredAssets.length}건 {selectedIds.length > 0 && `· ${selectedIds.length}건 선택됨`}
      </div>

      {isUploadOpen && (
        <BulkUploadModal
          onClose={() => setIsUploadOpen(false)}
          onSuccess={(count) => { fetchAssets(); alert(`${count}건이 등록되었습니다.`) }}
        />
      )}
    </div>
  )
}
