'use client'

import { useState } from 'react'
import { X, SlidersHorizontal, BookmarkPlus, Bookmark, Trash2, RotateCcw } from 'lucide-react'

export interface AdvancedFilters {
  dateFrom:             string
  dateTo:               string
  priceMin:             string
  priceMax:             string
  warrantyExpiringSoon: boolean
}

export const ADVANCED_FILTER_DEFAULTS: AdvancedFilters = {
  dateFrom: '', dateTo: '', priceMin: '', priceMax: '', warrantyExpiringSoon: false,
}

interface Preset {
  id:      string
  name:    string
  filters: AdvancedFilters
  savedAt: string
}

const PRESET_KEY = 'nextasset-adv-filter-presets'
const MAX_PRESETS = 5

function loadPresets(): Preset[] {
  try {
    return JSON.parse(localStorage.getItem(PRESET_KEY) ?? '[]')
  } catch { return [] }
}

function savePresets(presets: Preset[]) {
  localStorage.setItem(PRESET_KEY, JSON.stringify(presets))
}

interface Props {
  open:       boolean
  filters:    AdvancedFilters
  onChange:   (f: AdvancedFilters) => void
  onReset:    () => void
  onClose:    () => void
  activeCount: number
}

const INPUT_CLS = 'w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-300 dark:placeholder-slate-500'

export default function AdvancedFilterPanel({ open, filters, onChange, onReset, onClose, activeCount }: Props) {
  const [presets,     setPresets]     = useState<Preset[]>(() => loadPresets())
  const [presetName,  setPresetName]  = useState('')
  const [showPresets, setShowPresets] = useState(false)

  if (!open) return null

  const set = <K extends keyof AdvancedFilters>(key: K, val: AdvancedFilters[K]) =>
    onChange({ ...filters, [key]: val })

  const handleSavePreset = () => {
    const name = presetName.trim() || `필터 ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
    const next = [
      { id: Date.now().toString(), name, filters: { ...filters }, savedAt: new Date().toISOString() },
      ...presets,
    ].slice(0, MAX_PRESETS)
    setPresets(next)
    savePresets(next)
    setPresetName('')
  }

  const handleDeletePreset = (id: string) => {
    const next = presets.filter((p) => p.id !== id)
    setPresets(next)
    savePresets(next)
  }

  const handleApplyPreset = (preset: Preset) => {
    onChange(preset.filters)
    setShowPresets(false)
  }

  const hasActiveFilter =
    filters.dateFrom || filters.dateTo ||
    filters.priceMin || filters.priceMax ||
    filters.warrantyExpiringSoon

  return (
    <>
      {/* 오버레이 */}
      <div
        className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* 패널 */}
      <aside className="fixed top-0 right-0 h-full w-80 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 shadow-2xl z-50 flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">고급 필터</h2>
            {activeCount > 0 && (
              <span className="text-[10px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded-full">{activeCount}</span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* 필터 내용 */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-6">

          {/* 취득일 범위 */}
          <section>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">취득일 범위</p>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">시작일</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  max={filters.dateTo || undefined}
                  onChange={(e) => set('dateFrom', e.target.value)}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">종료일</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  min={filters.dateFrom || undefined}
                  onChange={(e) => set('dateTo', e.target.value)}
                  className={INPUT_CLS}
                />
              </div>
              {(filters.dateFrom || filters.dateTo) && (
                <button
                  onClick={() => onChange({ ...filters, dateFrom: '', dateTo: '' })}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  날짜 초기화
                </button>
              )}
            </div>
          </section>

          {/* 취득가액 범위 */}
          <section>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">취득가액 범위 (원)</p>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">최소 금액</label>
                <input
                  type="number"
                  min={0}
                  step={10000}
                  placeholder="예: 100000"
                  value={filters.priceMin}
                  onChange={(e) => set('priceMin', e.target.value)}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">최대 금액</label>
                <input
                  type="number"
                  min={0}
                  step={10000}
                  placeholder="예: 1000000"
                  value={filters.priceMax}
                  onChange={(e) => set('priceMax', e.target.value)}
                  className={INPUT_CLS}
                />
              </div>
              {/* 빠른 선택 버튼 */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  { label: '~10만', max: '100000' },
                  { label: '~100만', max: '1000000' },
                  { label: '100만~', min: '1000000' },
                  { label: '500만~', min: '5000000' },
                ].map((b) => (
                  <button
                    key={b.label}
                    onClick={() => onChange({ ...filters, priceMin: b.min ?? '', priceMax: b.max ?? '' })}
                    className={`text-[10px] font-semibold px-2 py-1 rounded-md border transition-colors ${
                      filters.priceMin === (b.min ?? '') && filters.priceMax === (b.max ?? '')
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-blue-300'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              {(filters.priceMin || filters.priceMax) && (
                <button
                  onClick={() => onChange({ ...filters, priceMin: '', priceMax: '' })}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  가격 초기화
                </button>
              )}
            </div>
          </section>

          {/* 보증 만료 임박 */}
          <section>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">기타 조건</p>
            <label className="flex items-center gap-3 cursor-pointer select-none group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={filters.warrantyExpiringSoon}
                  onChange={(e) => set('warrantyExpiringSoon', e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-10 h-6 rounded-full transition-colors ${filters.warrantyExpiringSoon ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-600'}`} />
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${filters.warrantyExpiringSoon ? 'left-5' : 'left-1'}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">보증 만료 임박</p>
                <p className="text-[10px] text-slate-400">30일 이내 보증 만료 자산만 표시</p>
              </div>
            </label>
          </section>

          {/* 필터 프리셋 */}
          <section className="border-t border-slate-100 dark:border-slate-700 pt-4">
            <button
              onClick={() => setShowPresets((v) => !v)}
              className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide hover:text-slate-700 dark:hover:text-slate-200 transition-colors w-full"
            >
              <Bookmark className="w-3.5 h-3.5" />
              필터 프리셋 ({presets.length}/{MAX_PRESETS})
              <span className="ml-auto">{showPresets ? '▲' : '▼'}</span>
            </button>

            {showPresets && (
              <div className="mt-3 space-y-3">
                {/* 저장 */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="프리셋 이름 (선택)"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSavePreset() }}
                    className={`${INPUT_CLS} flex-1`}
                    maxLength={20}
                  />
                  <button
                    onClick={handleSavePreset}
                    disabled={!hasActiveFilter || presets.length >= MAX_PRESETS}
                    title={!hasActiveFilter ? '활성 필터가 없습니다' : presets.length >= MAX_PRESETS ? '최대 5개' : '현재 필터 저장'}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" /> 저장
                  </button>
                </div>

                {/* 프리셋 목록 */}
                {presets.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-2">저장된 프리셋이 없습니다.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {presets.map((p) => (
                      <li key={p.id} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2">
                        <button
                          onClick={() => handleApplyPreset(p)}
                          className="flex-1 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate"
                        >
                          {p.name}
                        </button>
                        <span className="text-[9px] text-slate-400 shrink-0">
                          {new Date(p.savedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                        </span>
                        <button
                          onClick={() => handleDeletePreset(p.id)}
                          className="text-slate-300 hover:text-red-400 transition-colors shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>

        {/* 하단 버튼 */}
        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700 shrink-0 flex gap-2">
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex-1"
          >
            <RotateCcw className="w-3.5 h-3.5" /> 전체 초기화
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            적용
          </button>
        </div>
      </aside>
    </>
  )
}
