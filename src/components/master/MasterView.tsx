'use client'

import { useCallback, useEffect, useState } from 'react'
import { Tags, FolderTree, MapPin, Building2, Trash2, Plus, Lock, RefreshCcw } from 'lucide-react'
import { useUser } from '@/context/user-context'

type MasterType = 'categories' | 'departments' | 'locations' | 'vendors'

interface MasterData {
  categories: string[]
  departments: string[]
  locations: string[]
  vendors: string[]
}

const PANELS: { type: MasterType; title: string; icon: React.ElementType; color: string; bg: string }[] = [
  { type: 'categories',  title: '품목 관리',      icon: Tags,       color: 'text-pink-600',    bg: 'bg-pink-50'    },
  { type: 'departments', title: '부서 관리',       icon: FolderTree, color: 'text-blue-600',    bg: 'bg-blue-50'    },
  { type: 'locations',   title: '위치 / 배치',    icon: MapPin,     color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { type: 'vendors',     title: '유지보수 업체',  icon: Building2,  color: 'text-amber-600',   bg: 'bg-amber-50'   },
]

export default function MasterView() {
  const { canManageSystem } = useUser()
  const [data, setData] = useState<MasterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [newItem, setNewItem] = useState({ type: 'categories' as MasterType, value: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchData = useCallback(() => {
    setLoading(true)
    fetch('/api/master')
      .then((r) => r.json())
      .then((d: MasterData) => setData(d))
      .catch(() => setError('데이터를 불러올 수 없습니다.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (!canManageSystem) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Lock className="w-10 h-10 mb-3 opacity-30" />
        <p className="font-semibold">접근 권한이 없습니다.</p>
        <p className="text-sm mt-1">시스템 관리자만 기초 정보를 관리할 수 있습니다.</p>
      </div>
    )
  }

  const handleAdd = async () => {
    const val = newItem.value.trim()
    if (!val) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: newItem.type, value: val }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? '추가 실패'); return }
      setData(d)
      setNewItem((prev) => ({ ...prev, value: '' }))
    } catch {
      setError('서버 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (type: MasterType, item: string) => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/master', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, value: item }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? '삭제 실패'); return }
      setData(d)
    } catch {
      setError('서버 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCcw className="w-5 h-5 animate-spin text-blue-500 mr-2" />
        <span className="text-slate-500">불러오는 중...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 신규 항목 추가 폼 */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="flex-1">
          <label className="block mb-2 text-sm font-bold text-slate-700">관리 대상 선택</label>
          <select
            value={newItem.type}
            onChange={(e) => setNewItem({ ...newItem, type: e.target.value as MasterType })}
            className="bg-slate-50 border border-slate-300 text-sm rounded-lg block w-full p-2.5 outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="categories">품목 (Category)</option>
            <option value="departments">부서 (Department)</option>
            <option value="locations">위치 (Location)</option>
            <option value="vendors">업체 (Vendor)</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block mb-2 text-sm font-bold text-slate-700">신규 항목명</label>
          <input
            type="text"
            value={newItem.value}
            onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && !saving && handleAdd()}
            className="bg-slate-50 border border-slate-300 text-sm rounded-lg block w-full p-2.5 outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="항목명 입력 후 Enter 또는 추가 클릭"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={saving || !newItem.value.trim()}
          className="flex items-center px-6 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
        >
          {saving ? <RefreshCcw className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
          항목 추가
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
      )}

      {/* 4개 패널 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {PANELS.map(({ type, title, icon: Icon, color, bg }) => (
          <div key={type} className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[50vh] min-h-[300px]">
            <div className={`p-4 border-b border-slate-100 flex items-center rounded-t-2xl ${bg}`}>
              <Icon className={`w-5 h-5 mr-2 ${color}`} />
              <h3 className="font-bold text-slate-800">{title}</h3>
              <span className="ml-auto text-xs font-bold text-slate-400">{data[type].length}개</span>
            </div>
            <ul className="p-3 overflow-y-auto flex-1 custom-scrollbar space-y-1">
              {data[type].map((item) => (
                <li key={item} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl group transition-colors">
                  <span className="text-sm font-bold text-slate-800">{item}</span>
                  <button
                    onClick={() => handleDelete(type, item)}
                    disabled={saving}
                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 disabled:opacity-30 transition-all bg-white p-1.5 rounded-md shadow-sm border"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
              {data[type].length === 0 && (
                <li className="text-center py-8 text-slate-400 text-sm">항목이 없습니다</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
