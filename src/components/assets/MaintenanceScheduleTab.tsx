'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, CalendarClock, RefreshCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { Skeleton } from '@/components/ui'

interface Schedule {
  id:           string
  description:  string
  intervalDays: number
  lastDoneAt:   string | null
  nextDueAt:    string
}

interface Props {
  assetId:       string
  canManage:     boolean
}

const TODAY = new Date().toISOString().split('T')[0]

const daysUntil = (dateStr: string) => {
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
  return diff
}

const urgencyClass = (days: number) => {
  if (days < 0)  return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
  if (days <= 7) return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
  return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
}

const urgencyLabel = (days: number) => {
  if (days < 0)  return `${Math.abs(days)}일 초과`
  if (days === 0) return '오늘'
  return `D-${days}`
}

export default function MaintenanceScheduleTab({ assetId, canManage }: Props) {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading,   setLoading]   = useState(true)
  const [form, setForm] = useState({ description: '', intervalDays: '90', nextDueAt: TODAY })
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/assets/${assetId}/maintenance-schedules`)
      .then((r) => r.json())
      .then((d) => setSchedules(Array.isArray(d?.data) ? d.data : []))
      .catch(() => toast.error('스케줄을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [assetId])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    if (!form.description || !form.nextDueAt) {
      toast.error('점검 내용과 예정일을 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/assets/${assetId}/maintenance-schedules`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...form, intervalDays: Number(form.intervalDays) }),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? '저장 실패'); return }
      toast.success('정기점검 일정이 추가되었습니다.')
      setForm({ description: '', intervalDays: '90', nextDueAt: TODAY })
      load()
    } catch { toast.error('서버 오류가 발생했습니다.') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 점검 일정을 삭제하시겠습니까?')) return
    try {
      const res = await fetch(`/api/assets/${assetId}/maintenance-schedules/${id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('삭제 실패'); return }
      toast.success('삭제되었습니다.')
      load()
    } catch { toast.error('서버 오류가 발생했습니다.') }
  }

  const INPUT = 'border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-300 dark:placeholder-slate-500 w-full'

  return (
    <div className="space-y-5">

      {/* 추가 폼 */}
      {canManage && (
        <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-blue-500" /> 정기점검 일정 추가
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">점검 내용</label>
              <input
                type="text"
                placeholder="예: 에어컨 필터 교체"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                maxLength={200}
                className={INPUT}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">다음 점검 예정일</label>
              <input
                type="date"
                value={form.nextDueAt}
                min={TODAY}
                onChange={(e) => setForm((f) => ({ ...f, nextDueAt: e.target.value }))}
                className={INPUT}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">점검 주기 (일)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={form.intervalDays}
                  onChange={(e) => setForm((f) => ({ ...f, intervalDays: e.target.value }))}
                  className={`${INPUT} w-24`}
                />
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { label: '30일', val: '30' },
                    { label: '90일', val: '90' },
                    { label: '180일', val: '180' },
                    { label: '1년', val: '365' },
                  ].map((b) => (
                    <button
                      key={b.val}
                      onClick={() => setForm((f) => ({ ...f, intervalDays: b.val }))}
                      className={`text-[11px] font-semibold px-2 py-1 rounded-md border transition-colors ${
                        form.intervalDays === b.val
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-blue-300'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={handleAdd}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors self-end"
            >
              {saving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              추가
            </button>
          </div>
        </div>
      )}

      {/* 스케줄 목록 */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-sm">
          등록된 정기점검 일정이 없습니다.
        </div>
      ) : (
        <ul className="space-y-2">
          {schedules.map((s) => {
            const days = daysUntil(s.nextDueAt)
            return (
              <li key={s.id} className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3">
                <CalendarClock className="w-5 h-5 text-blue-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{s.description}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    매 {s.intervalDays}일마다
                    {s.lastDoneAt && ` · 마지막 완료: ${new Date(s.lastDoneAt).toLocaleDateString('ko-KR')}`}
                  </p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {new Date(s.nextDueAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                  </p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${urgencyClass(days)}`}>
                    {urgencyLabel(days)}
                  </span>
                </div>
                {canManage && (
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="text-slate-300 hover:text-red-400 dark:text-slate-600 dark:hover:text-red-500 transition-colors shrink-0 p-1"
                    aria-label="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
