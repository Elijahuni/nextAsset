'use client'

import { useState } from 'react'
import { Save, RotateCcw } from 'lucide-react'
import { DEFAULT_DEPRECIATION_RULES } from '@/lib/depreciation'
import { ASSET_CATEGORY_LABEL } from '@/lib/utils'
import { Modal } from '@/components/ui'

export type DepreciationRules = Record<string, { years: number; method: '정액법' | '정률법' }>

interface DepreciationRuleModalProps {
  rules: DepreciationRules
  onSave: (rules: DepreciationRules) => void
  onClose: () => void
}

const STORAGE_KEY = 'depreciation_custom_rules'

export function loadRules(): DepreciationRules {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved) as DepreciationRules
  } catch { /* ignore */ }
  return { ...DEFAULT_DEPRECIATION_RULES }
}

export function saveRules(rules: DepreciationRules) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
}

export default function DepreciationRuleModal({ rules, onSave, onClose }: DepreciationRuleModalProps) {
  const [draft, setDraft] = useState<DepreciationRules>(() =>
    Object.fromEntries(Object.entries(rules).map(([k, v]) => [k, { ...v }]))
  )

  const setYears = (category: string, years: number) => {
    setDraft((p) => ({ ...p, [category]: { ...p[category], years } }))
  }

  const setMethod = (category: string, method: '정액법' | '정률법') => {
    setDraft((p) => ({ ...p, [category]: { ...p[category], method } }))
  }

  const handleReset = () => {
    setDraft(Object.fromEntries(Object.entries(DEFAULT_DEPRECIATION_RULES).map(([k, v]) => [k, { ...v }])))
  }

  const handleSave = () => {
    saveRules(draft)
    onSave(draft)
    onClose()
  }

  return (
    <Modal
      title="감가상각 규칙 편집"
      onClose={onClose}
      size="lg"
      footer={
        <div className="p-6 flex justify-between items-center">
          <button
            onClick={handleReset}
            className="flex items-center px-4 py-2 text-sm font-semibold text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" /> 기본값 복원
          </button>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
              취소
            </button>
            <button onClick={handleSave}
              className="flex items-center px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors">
              <Save className="w-4 h-4 mr-2" /> 저장
            </button>
          </div>
        </div>
      }
    >
      <div className="p-6 space-y-3">
        <p className="text-xs text-slate-400 mb-4">품목별 상각방법과 내용연수를 설정합니다. 변경사항은 브라우저에 저장됩니다.</p>

        {Object.keys(DEFAULT_DEPRECIATION_RULES).map((category) => (
          <div key={category} className="flex items-center gap-4 bg-slate-50 rounded-xl p-4 border border-slate-100">
            <div className="w-24 shrink-0">
              <span className="text-sm font-bold text-slate-800">
                {ASSET_CATEGORY_LABEL[category] ?? category}
              </span>
            </div>

            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">내용연수 (년)</label>
              <select
                value={draft[category]?.years ?? 5}
                onChange={(e) => setYears(category, Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-300 bg-white"
              >
                {[3, 4, 5, 6, 8, 10].map((y) => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">상각방법</label>
              <select
                value={draft[category]?.method ?? '정액법'}
                onChange={(e) => setMethod(category, e.target.value as '정액법' | '정률법')}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-300 bg-white"
              >
                <option value="정액법">정액법</option>
                <option value="정률법">정률법</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
