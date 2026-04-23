'use client'

import { useState } from 'react'
import { PlusCircle, RefreshCcw, Wand2 } from 'lucide-react'
import { ASSET_CATEGORY_LABEL } from '@/lib/utils'
import { Modal } from '@/components/ui'

interface AssetCreateModalProps {
  onClose: () => void
  onSuccess: () => void
}

const TODAY = new Date().toISOString().split('T')[0]

function generateCode() {
  const d = new Date()
  const yyyymmdd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const rand = String(Math.floor(Math.random() * 9000) + 1000)
  return `ASSET-${yyyymmdd}-${rand}`
}

const INITIAL_FORM = {
  code: '',
  name: '',
  category: 'IT_EQUIPMENT',
  price: '',
  department: '',
  location: '',
  acquiredDate: TODAY,
  warrantyDate: '',
  barcode: '',
}

export default function AssetCreateModal({ onClose, onSuccess }: AssetCreateModalProps) {
  const [form, setForm] = useState(INITIAL_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }))

  const handleSubmit = async () => {
    if (!form.code || !form.name || !form.department || !form.location || !form.price || !form.acquiredDate) {
      setError('필수 항목을 모두 입력해주세요.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code,
          name: form.name,
          category: form.category,
          price: Number(form.price),
          department: form.department,
          location: form.location,
          acquiredDate: form.acquiredDate,
          ...(form.warrantyDate && { warrantyDate: form.warrantyDate }),
          ...(form.barcode && { barcode: form.barcode }),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '등록 실패')
        return
      }
      onSuccess()
      onClose()
    } catch {
      setError('서버 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={<><PlusCircle className="w-5 h-5 mr-2 text-blue-600" />자산 신규 등록</>}
      onClose={onClose}
      size="lg"
      footer={
        <div className="p-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
          >
            {loading
              ? <><RefreshCcw className="w-4 h-4 mr-2 animate-spin" />등록 중...</>
              : <><PlusCircle className="w-4 h-4 mr-2" />등록</>
            }
          </button>
        </div>
      }
    >
      <div className="p-6 space-y-4">

        {/* 자산코드 */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">자산코드 <span className="text-red-500">*</span></label>
          <div className="flex gap-2">
            <input
              type="text"
              value={form.code}
              onChange={(e) => set('code', e.target.value)}
              placeholder="ASSET-20240101-1234"
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"
            />
            <button
              type="button"
              onClick={() => set('code', generateCode())}
              className="flex items-center px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
            >
              <Wand2 className="w-3.5 h-3.5 mr-1" />
              자동생성
            </button>
          </div>
        </div>

        {/* 자산명 */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">자산명 <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="예: LG 그램 15인치"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        {/* 품목 */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">품목 <span className="text-red-500">*</span></label>
          <select
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300 bg-white"
          >
            {Object.entries(ASSET_CATEGORY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* 취득가액 */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">취득가액 (원) <span className="text-red-500">*</span></label>
          <input
            type="number"
            min="0"
            value={form.price}
            onChange={(e) => set('price', e.target.value)}
            placeholder="1500000"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        {/* 부서 / 위치 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">부서 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.department}
              onChange={(e) => set('department', e.target.value)}
              placeholder="IT개발팀"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">위치 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="본사 4층"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>

        {/* 취득일 / 보증기간 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">취득일 <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={form.acquiredDate}
              onChange={(e) => set('acquiredDate', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">보증기간 만료일</label>
            <input
              type="date"
              value={form.warrantyDate}
              onChange={(e) => set('warrantyDate', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>

        {/* 바코드 */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">바코드 (선택)</label>
          <input
            type="text"
            value={form.barcode}
            onChange={(e) => set('barcode', e.target.value)}
            placeholder="바코드 번호"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}
      </div>
    </Modal>
  )
}
