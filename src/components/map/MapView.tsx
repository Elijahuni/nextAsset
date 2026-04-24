'use client'

import { useEffect, useState, useRef } from 'react'
import { MapPin, RefreshCcw, GripHorizontal, Lock } from 'lucide-react'
import { useUser } from '@/context/user-context'
import { ASSET_CATEGORY_LABEL } from '@/lib/utils'

interface ApiAsset {
  id: string
  code: string
  name: string
  category: string
  department: string
  location: string
  status: string
}

const DEFAULT_LOCATIONS = ['본사 1층', '본사 2층', '본사 3층', '본사 4층', '별관 A동', '창고']

export default function MapView() {
  const { isEmployee, canManageAssets } = useUser()
  const [assets, setAssets] = useState<ApiAsset[]>([])
  const [loading, setLoading] = useState(true)
  const dragId = useRef<string | null>(null)

  useEffect(() => {
    fetch('/api/assets')
      .then((r) => r.json())
      .then((data: ApiAsset[]) => setAssets(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (isEmployee) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Lock className="w-10 h-10 mb-3 opacity-30" />
        <p className="font-semibold">접근 권한이 없습니다.</p>
        <p className="text-sm mt-1">관리자 또는 부서장만 배치도를 조회할 수 있습니다.</p>
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

  // 사용중인 location들 + 기본 위치 합집합
  const usedLocations = Array.from(new Set(assets.map((a) => a.location).filter(Boolean)))
  const locations = Array.from(new Set([...DEFAULT_LOCATIONS, ...usedLocations]))

  const handleDragStart = (e: React.DragEvent, assetId: string) => {
    dragId.current = assetId
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, location: string) => {
    e.preventDefault()
    const id = dragId.current
    if (!id) return
    // 낙관적 업데이트
    setAssets((prev) => prev.map((a) => a.id === id ? { ...a, location } : a))
    dragId.current = null
    // API 업데이트
    await fetch(`/api/assets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location }),
    }).catch(() => {})
  }

  return (
    <div className="h-full flex flex-col bg-slate-100 rounded-2xl border border-slate-200 shadow-inner overflow-hidden">
      <div className="p-5 border-b border-slate-200 bg-white flex justify-between items-center shadow-sm z-10">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center mb-1">
            <MapPin className="w-6 h-6 mr-2 text-indigo-600" />
            오피스 자산 배치도
          </h2>
          <p className="text-sm text-slate-500">
            자산 카드를 <strong className="text-indigo-600">드래그(Drag & Drop)</strong>하여 다른 구역으로 이동하면 즉시 반영됩니다.
          </p>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto min-h-[600px]">
          {locations.map((loc) => {
            const locAssets = assets.filter((a) => a.location === loc)
            return (
              <div
                key={loc}
                className="bg-white rounded-2xl border-2 border-dashed border-slate-300 shadow-sm flex flex-col overflow-hidden transition-colors hover:border-indigo-400"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, loc)}
              >
                <div className="bg-slate-100/80 p-3 border-b border-slate-200 flex justify-between items-center">
                  <h3 className="font-bold text-slate-700 flex items-center">
                    <MapPin className="w-4 h-4 mr-1 text-slate-400" /> {loc}
                  </h3>
                  <span className="bg-white px-2 py-0.5 rounded text-xs font-black text-slate-500 border shadow-sm">
                    {locAssets.length}대
                  </span>
                </div>
                <div className="flex-1 p-4 flex flex-wrap gap-3 content-start bg-slate-50/50 overflow-y-auto custom-scrollbar min-h-[120px]">
                  {locAssets.map((asset) => (
                    <div
                      key={asset.id}
                      draggable={canManageAssets}
                      onDragStart={(e) => handleDragStart(e, asset.id)}
                      className={`flex flex-col bg-white border border-slate-200 p-3 rounded-xl shadow-sm w-full transition-all ${canManageAssets ? 'cursor-grab hover:shadow-md hover:border-indigo-300 active:cursor-grabbing' : 'cursor-default'}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200">
                          {ASSET_CATEGORY_LABEL[asset.category] ?? asset.category}
                        </span>
                        {canManageAssets && <GripHorizontal className="w-4 h-4 text-slate-300" />}
                      </div>
                      <p className="font-bold text-sm text-slate-800 truncate">{asset.name}</p>
                      <p className="text-xs text-slate-500 mt-1 font-mono">{asset.code}</p>
                    </div>
                  ))}
                  {locAssets.length === 0 && (
                    <div className="w-full flex items-center justify-center py-8 text-slate-300 text-xs">
                      드래그하여 자산을 이동하세요
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
