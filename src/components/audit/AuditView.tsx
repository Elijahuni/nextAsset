'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ScanLine, Plus, Lock, RefreshCcw, CheckCircle, AlertCircle,
  PackagePlus, Clock, ChevronRight, Printer, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useUser } from '@/context/user-context'
import { ASSET_CATEGORY_LABEL } from '@/lib/utils'
import { Skeleton } from '@/components/ui'

// ── 타입 ──────────────────────────────────────────────────────────────────────

type AuditItemResult = 'PENDING' | 'CONFIRMED' | 'MISSING' | 'SURPLUS'

interface AuditSummary {
  id: string; name: string; startDate: string; endDate: string | null
  status: string; createdBy: string; total: number
  confirmed: number; missing: number; surplus: number; pending: number; rate: number
}

interface AuditItem {
  id: string; assetId: string; result: AuditItemResult
  auditedBy: string | null; auditedAt: string | null; note: string | null
  asset: { id: string; code: string; name: string; department: string; location: string; category: string }
}

interface AuditDetail extends AuditSummary { items: AuditItem[] }

// ── 상수 ──────────────────────────────────────────────────────────────────────

const RESULT_CONFIG: Record<AuditItemResult, { label: string; cls: string; icon: React.ReactNode }> = {
  PENDING:   { label: '미확인', cls: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600', icon: <Clock className="w-3.5 h-3.5" /> },
  CONFIRMED: { label: '정상',   cls: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700',    icon: <CheckCircle className="w-3.5 h-3.5" /> },
  MISSING:   { label: '분실',   cls: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700',           icon: <AlertCircle className="w-3.5 h-3.5" /> },
  SURPLUS:   { label: '잉여',   cls: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700', icon: <PackagePlus className="w-3.5 h-3.5" /> },
}

// ── 진행률 바 ─────────────────────────────────────────────────────────────────

function ProgressBar({ total, confirmed, missing, surplus }: { total: number; confirmed: number; missing: number; surplus: number }) {
  const checked = confirmed + missing + surplus
  const rate    = total > 0 ? Math.round((checked / total) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-500 dark:text-slate-400">실사율 {rate}%</span>
        <span className="text-slate-500 dark:text-slate-400">{checked}/{total}건</span>
      </div>
      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
        <div className="bg-blue-500 h-full transition-all"    style={{ width: `${total > 0 ? (confirmed / total) * 100 : 0}%` }} />
        <div className="bg-red-400 h-full transition-all"     style={{ width: `${total > 0 ? (missing  / total) * 100 : 0}%` }} />
        <div className="bg-emerald-400 h-full transition-all" style={{ width: `${total > 0 ? (surplus  / total) * 100 : 0}%` }} />
      </div>
    </div>
  )
}

// ── 실사 목록 뷰 ──────────────────────────────────────────────────────────────

function AuditList({ onSelect }: { onSelect: (id: string) => void }) {
  const { canManageAssets } = useUser()
  const [audits,  setAudits]  = useState<AuditSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName,  setNewName]  = useState('')
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/audits')
      .then((r) => r.json())
      .then((d) => setAudits(Array.isArray(d?.data) ? d.data : []))
      .catch(() => toast.error('실사 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    const name = newName.trim() || `실사 ${new Date().toLocaleDateString('ko-KR')}`
    setCreating(true)
    try {
      const res = await fetch('/api/audits', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? '생성 실패'); return }
      const d = await res.json()
      toast.success('실사가 시작되었습니다.')
      setNewName(''); setShowForm(false)
      load()
      onSelect(d.data.id)
    } catch { toast.error('서버 오류가 발생했습니다.') }
    finally { setCreating(false) }
  }

  return (
    <div className="h-full flex flex-col">
      {/* 헤더 */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <ScanLine className="w-6 h-6 text-indigo-600" /> 재물조사 (실사)
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">자산 실사를 생성하고 현황을 관리합니다.</p>
        </div>
        {canManageAssets && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> 새 실사
          </button>
        )}
      </div>

      {/* 새 실사 폼 */}
      {showForm && canManageAssets && (
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-indigo-50/50 dark:bg-indigo-900/20 flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">실사명</label>
            <input
              type="text"
              placeholder="예: 2025년 2분기 자산 실사"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              maxLength={100}
              autoFocus
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {creating ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} 시작
          </button>
          <button onClick={() => setShowForm(false)} className="p-2 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 목록 */}
      <div className="flex-1 overflow-auto custom-scrollbar p-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : audits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 dark:text-slate-500">
            <ScanLine className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-semibold">등록된 실사가 없습니다.</p>
            {canManageAssets && <p className="text-sm mt-1">상단의 &apos;새 실사&apos; 버튼으로 시작하세요.</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {audits.map((a) => (
              <button
                key={a.id}
                onClick={() => onSelect(a.id)}
                className="w-full text-left bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${a.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600'}`}>
                        {a.status === 'ACTIVE' ? '진행중' : '완료'}
                      </span>
                      <h3 className="font-bold text-slate-800 dark:text-slate-100">{a.name}</h3>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      담당: {a.createdBy} · {new Date(a.startDate).toLocaleDateString('ko-KR')}
                      {a.endDate && ` ~ ${new Date(a.endDate).toLocaleDateString('ko-KR')}`}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 shrink-0 group-hover:text-indigo-400 transition-colors" />
                </div>
                <ProgressBar total={a.total} confirmed={a.confirmed} missing={a.missing} surplus={a.surplus} />
                <div className="flex gap-3 mt-3 text-xs">
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">정상 {a.confirmed}</span>
                  <span className="text-red-500 dark:text-red-400 font-semibold">분실 {a.missing}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">잉여 {a.surplus}</span>
                  <span className="text-slate-400 dark:text-slate-500">미확인 {a.pending}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 실사 상세 뷰 ──────────────────────────────────────────────────────────────

function AuditDetail({ auditId, onBack }: { auditId: string; onBack: () => void }) {
  const { canManageAssets } = useUser()
  const [audit,   setAudit]   = useState<AuditDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterResult, setFilterResult] = useState<AuditItemResult | ''>('')
  const [scanCode,  setScanCode]  = useState('')
  const [completing, setCompleting] = useState(false)
  const scanRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/audits/${auditId}`)
      .then((r) => r.json())
      .then((d) => setAudit(d?.data ?? null))
      .catch(() => toast.error('실사 정보를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [auditId])

  useEffect(() => { load() }, [load])

  const markItem = async (assetId: string, result: AuditItemResult) => {
    try {
      const res = await fetch(`/api/audits/${auditId}/items/${assetId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result }),
      })
      if (!res.ok) { toast.error('처리 실패'); return }
      setAudit((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          items: prev.items.map((it) =>
            it.assetId === assetId ? { ...it, result } : it
          ),
        }
      })
    } catch { toast.error('서버 오류가 발생했습니다.') }
  }

  // 코드 스캔 → 자산 확인 처리
  const handleScan = (e: React.FormEvent) => {
    e.preventDefault()
    if (!audit || !scanCode.trim()) return
    const code = scanCode.trim().toUpperCase()
    const item = audit.items.find((it) => it.asset.code.toUpperCase() === code)
    if (!item) {
      toast.error(`자산코드 "${code}"를 실사 목록에서 찾을 수 없습니다.`)
    } else if (item.result !== 'PENDING') {
      toast(`"${item.asset.name}"은 이미 ${RESULT_CONFIG[item.result].label} 처리되었습니다.`, { icon: 'ℹ️' })
    } else {
      markItem(item.assetId, 'CONFIRMED')
      toast.success(`"${item.asset.name}" 정상 확인`)
    }
    setScanCode('')
    scanRef.current?.focus()
  }

  const handleComplete = async () => {
    if (!audit) return
    if (!confirm('실사를 완료 처리하시겠습니까? 이후에는 수정할 수 없습니다.')) return
    setCompleting(true)
    try {
      const res = await fetch(`/api/audits/${auditId}`, { method: 'PATCH' })
      if (!res.ok) { toast.error('완료 처리 실패'); return }
      toast.success('실사가 완료되었습니다.')
      load()
    } catch { toast.error('서버 오류가 발생했습니다.') }
    finally { setCompleting(false) }
  }

  const filteredItems = audit?.items.filter((it) => !filterResult || it.result === filterResult) ?? []
  const isActive = audit?.status === 'ACTIVE'

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex-1 p-6 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (!audit) return null

  const confirmed = audit.items.filter((i) => i.result === 'CONFIRMED').length
  const missing   = audit.items.filter((i) => i.result === 'MISSING').length
  const surplus   = audit.items.filter((i) => i.result === 'SURPLUS').length

  return (
    <div className="h-full flex flex-col print:block">
      {/* 헤더 */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 print:bg-white print:border-0 shrink-0">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <button onClick={onBack} className="text-xs text-slate-400 hover:text-indigo-600 mb-2 flex items-center gap-1 print:hidden">
              ← 실사 목록
            </button>
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">{audit.name}</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              담당: {audit.createdBy} · 시작: {new Date(audit.startDate).toLocaleDateString('ko-KR')}
              {audit.endDate && ` · 완료: ${new Date(audit.endDate).toLocaleDateString('ko-KR')}`}
            </p>
          </div>
          <div className="flex gap-2 print:hidden shrink-0">
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
              <Printer className="w-4 h-4" /> 인쇄
            </button>
            {canManageAssets && isActive && (
              <button
                onClick={handleComplete}
                disabled={completing}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {completing ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                실사 완료
              </button>
            )}
          </div>
        </div>
        <ProgressBar total={audit.total} confirmed={confirmed} missing={missing} surplus={surplus} />
        <div className="flex gap-4 mt-3 text-xs">
          {(['CONFIRMED', 'MISSING', 'SURPLUS', 'PENDING'] as AuditItemResult[]).map((r) => (
            <button
              key={r}
              onClick={() => setFilterResult(filterResult === r ? '' : r)}
              className={`font-semibold transition-colors ${RESULT_CONFIG[r].cls} px-2 py-0.5 rounded border ${filterResult === r ? 'ring-2 ring-indigo-400' : ''}`}
            >
              {RESULT_CONFIG[r].label} {audit.items.filter((i) => i.result === r).length}
            </button>
          ))}
        </div>
      </div>

      {/* 코드 스캔 입력 */}
      {canManageAssets && isActive && (
        <form onSubmit={handleScan} className="px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-indigo-50/50 dark:bg-indigo-900/20 flex gap-3 items-center print:hidden">
          <ScanLine className="w-5 h-5 text-indigo-500 shrink-0" />
          <input
            ref={scanRef}
            type="text"
            placeholder="자산코드 입력 또는 QR 스캔 (Enter)"
            value={scanCode}
            onChange={(e) => setScanCode(e.target.value)}
            className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-300 font-mono uppercase"
          />
          <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">확인</button>
        </form>
      )}

      {/* 아이템 목록 */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">자산코드</th>
              <th className="px-4 py-3">품명</th>
              <th className="px-4 py-3">분류</th>
              <th className="px-4 py-3">위치</th>
              <th className="px-4 py-3 print:hidden">처리자</th>
              {canManageAssets && isActive && <th className="px-4 py-3 print:hidden">조작</th>}
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => {
              const cfg = RESULT_CONFIG[item.result]
              return (
                <tr key={item.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border ${cfg.cls}`}>
                      {cfg.icon}{cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{item.asset.code}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{item.asset.name}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {ASSET_CATEGORY_LABEL[item.asset.category] ?? item.asset.category}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {item.asset.department}<br />
                    <span className="text-slate-400">{item.asset.location}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500 print:hidden">
                    {item.auditedBy ?? '-'}
                  </td>
                  {canManageAssets && isActive && (
                    <td className="px-4 py-3 print:hidden">
                      <div className="flex gap-1">
                        {(['CONFIRMED', 'MISSING', 'SURPLUS'] as AuditItemResult[]).map((r) => (
                          <button
                            key={r}
                            onClick={() => markItem(item.assetId, r)}
                            disabled={item.result === r}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${
                              item.result === r
                                ? RESULT_CONFIG[r].cls + ' opacity-70 cursor-default'
                                : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-indigo-300'
                            }`}
                          >
                            {RESULT_CONFIG[r].label}
                          </button>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={canManageAssets && isActive ? 7 : 6} className="text-center py-12 text-slate-400 dark:text-slate-500">
                  해당 조건의 항목이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 하단 요약 */}
      <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 text-xs text-slate-400 dark:text-slate-500 print:hidden shrink-0">
        총 {audit.total}건 · 정상 {confirmed} · 분실 {missing} · 잉여 {surplus} · 미확인 {audit.total - confirmed - missing - surplus}
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function AuditView() {
  const { isEmployee } = useUser()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (isEmployee) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Lock className="w-10 h-10 mb-3 opacity-30" />
        <p className="font-semibold">접근 권한이 없습니다.</p>
        <p className="text-sm mt-1">관리자 또는 부서장만 재물조사를 실시할 수 있습니다.</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      {selectedId
        ? <AuditDetail auditId={selectedId} onBack={() => setSelectedId(null)} />
        : <AuditList onSelect={setSelectedId} />
      }
    </div>
  )
}
