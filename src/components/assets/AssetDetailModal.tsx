'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCcw, Wrench, History, Info, CheckCircle, Pencil, X, ShieldAlert, QrCode, FileText, CalendarClock, UserCheck, CornerDownLeft, ArrowRight, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useUser } from '@/context/user-context'
import { ASSET_CATEGORY_LABEL, ASSET_STATUS_LABEL, formatCurrency, getWarrantyStatus, getActiveLabel } from '@/lib/utils'
import { Modal } from '@/components/ui'
import AssetFilesTab from './AssetFilesTab'
import MaintenanceScheduleTab from './MaintenanceScheduleTab'
import QrTagModal from './QrTagModal'
import AssetReportCard from './AssetReportCard'
import type { ApiAsset, ApiHistoryLog, ApiMaintenanceLog } from '@/types'

type AssetDetail = Omit<ApiAsset, 'historyLogs' | 'maintenanceLogs' | 'warrantyDate' | 'barcode' | 'remarks' | 'assignedTo'> & {
  warrantyDate:    string | null
  barcode:         string | null
  remarks:         string | null
  assignedTo:      string | null
  historyLogs:     (Omit<ApiHistoryLog, 'user'> & { user?: { id: string; name: string } })[]
  maintenanceLogs: ApiMaintenanceLog[]
}

interface AssetDetailModalProps {
  assetId:   string
  onClose:   () => void
  onUpdated: () => void
}

const STATUS_OPTIONS = [
  { value: 'AVAILABLE',         label: '사용가능' },
  { value: 'IN_USE',            label: '사용중' },
  { value: 'UNDER_MAINTENANCE', label: '수리중' },
  { value: 'RETIRED',           label: '보관중' },
  { value: 'DISPOSED',          label: '처분' },
]

const HISTORY_TYPE_LABEL: Record<string, string> = {
  ASSIGNED: '배정', RETURNED: '반납', TRANSFERRED: '이관',
  MAINTAINED: '수리', DISPOSED: '폐기', STATUS_CHANGED: '상태변경',
}

const HISTORY_TYPE_CONFIG: Record<string, { icon: React.ReactNode; dot: string; badge: string }> = {
  ASSIGNED:       { icon: <UserCheck      className="w-3 h-3" />, dot: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700' },
  RETURNED:       { icon: <CornerDownLeft  className="w-3 h-3" />, dot: 'bg-slate-400',   badge: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600' },
  TRANSFERRED:    { icon: <ArrowRight     className="w-3 h-3" />, dot: 'bg-violet-500',  badge: 'bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700' },
  MAINTAINED:     { icon: <Wrench         className="w-3 h-3" />, dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700' },
  DISPOSED:       { icon: <Trash2         className="w-3 h-3" />, dot: 'bg-red-500',     badge: 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700' },
  STATUS_CHANGED: { icon: <RefreshCcw     className="w-3 h-3" />, dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700' },
}
const DEFAULT_HISTORY_CONFIG = { icon: <Info className="w-3 h-3" />, dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-600 border-blue-100' }

function historyTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60000)
  if (min < 1)  return '방금 전'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24)  return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7)  return `${day}일 전`
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

const TODAY = new Date().toISOString().split('T')[0]

type Tab = 'info' | 'maintenance' | 'schedule' | 'history'

export default function AssetDetailModal({ assetId, onClose, onUpdated }: AssetDetailModalProps) {
  const { canManageAssets, canManageSystem } = useUser()
  const [asset,   setAsset]   = useState<AssetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState<Tab>('info')

  // ── 기본정보 편집 ─────────────────────────────────────────────────────────────
  const [isQrOpen,       setIsQrOpen]       = useState(false)
  const [isReportOpen,   setIsReportOpen]   = useState(false)
  const [isEditing,      setIsEditing]      = useState(false)
  const [editForm,    setEditForm]    = useState({ name: '', department: '', location: '', barcode: '', remarks: '', subCategory: '', description: '', size: '', color: '', assignedTo: '' })
  const [editLoading, setEditLoading] = useState(false)

  const startEdit = () => {
    if (!asset) return
    setEditForm({ name: asset.name, department: asset.department, location: asset.location, barcode: asset.barcode ?? '', remarks: asset.remarks ?? '', subCategory: asset.subCategory ?? '', description: asset.description ?? '', size: asset.size ?? '', color: asset.color ?? '', assignedTo: asset.assignedTo ?? '' })
    setIsEditing(true)
  }

  const saveEdit = async () => {
    if (!asset) return
    setEditLoading(true)
    try {
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editForm.name || undefined, department: editForm.department || undefined, location: editForm.location || undefined, barcode: editForm.barcode, remarks: editForm.remarks, subCategory: editForm.subCategory, description: editForm.description, size: editForm.size, color: editForm.color, assignedTo: editForm.assignedTo }),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? '저장 실패'); return }
      toast.success('자산 정보가 업데이트됐습니다.')
      setIsEditing(false)
      fetchAsset()
      onUpdated()
    } catch { toast.error('서버 오류가 발생했습니다.') }
    finally { setEditLoading(false) }
  }

  // ── 유지보수 ─────────────────────────────────────────────────────────────────
  const [mForm,    setMForm]    = useState({ date: TODAY, vendor: '', cost: '', detail: '' })
  const [mLoading, setMLoading] = useState(false)
  const [mError,   setMError]   = useState('')

  // ── 상태변경 ─────────────────────────────────────────────────────────────────
  const [newStatus,     setNewStatus]     = useState('')
  const [statusLoading, setStatusLoading] = useState(false)

  // ── 이력 탭 ──────────────────────────────────────────────────────────────────
  const [historyShowAll, setHistoryShowAll] = useState(false)
  const HISTORY_SHOW_DEFAULT = 10

  const fetchAsset = useCallback(() => {
    setLoading(true)
    fetch(`/api/assets/${assetId}`)
      .then((r) => r.json())
      .then((data: AssetDetail) => { setAsset(data); setNewStatus(data.status) })
      .catch(() => toast.error('자산 정보를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [assetId])

  useEffect(() => { fetchAsset() }, [fetchAsset])

  const handleAddMaintenance = async () => {
    if (!mForm.vendor || !mForm.cost || !mForm.detail) { setMError('모든 항목을 입력해주세요.'); return }
    setMLoading(true); setMError('')
    try {
      const res = await fetch(`/api/assets/${assetId}/maintenance`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...mForm, cost: Number(mForm.cost) }) })
      if (!res.ok) { const d = await res.json(); setMError(d.error ?? '등록 실패'); toast.error(d.error ?? '유지보수 등록에 실패했습니다.'); return }
      toast.success('유지보수 이력이 등록되었습니다.')
      setMForm({ date: TODAY, vendor: '', cost: '', detail: '' })
      fetchAsset()
    } catch { setMError('서버 오류가 발생했습니다.') }
    finally { setMLoading(false) }
  }

  const handleStatusChange = async () => {
    if (!newStatus || newStatus === asset?.status) return
    setStatusLoading(true)
    try {
      const res = await fetch(`/api/assets/${assetId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) })
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? '상태 변경에 실패했습니다.'); return }
      toast.success('자산 상태가 변경되었습니다.')
      fetchAsset(); onUpdated()
    } catch { toast.error('서버 오류가 발생했습니다.') }
    finally { setStatusLoading(false) }
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode; show: boolean }[] = [
    { key: 'info',        label: '기본정보',   icon: <Info className="w-4 h-4" />,         show: true },
    { key: 'maintenance', label: '유지보수',   icon: <Wrench className="w-4 h-4" />,       show: canManageAssets },
    { key: 'schedule',    label: '정기점검',   icon: <CalendarClock className="w-4 h-4" />, show: true },
    { key: 'history',     label: '이력',       icon: <History className="w-4 h-4" />,      show: true },
  ]

  return (
  <>
    <Modal
      title={loading ? '불러오는 중...' : (asset?.name ?? '')}
      onClose={onClose}
      size="2xl"
      footer={
        <div className="px-6 py-4 flex items-center justify-between">
          {asset ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsReportOpen(true)}
                className="flex items-center px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600"
              >
                <FileText className="w-3.5 h-3.5 mr-1.5" /> 관리카드
              </button>
              <button
                onClick={() => setIsQrOpen(true)}
                className="flex items-center px-3 py-2 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-700"
              >
                <QrCode className="w-3.5 h-3.5 mr-1.5" /> QR 태그
              </button>
            </div>
          ) : <span />}
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
            닫기
          </button>
        </div>
      }
    >
      {/* 자산관리번호 + 활성 배지 */}
      {asset && (
        <div className="flex items-center gap-2 px-6 pt-3">
          <span className="text-xs font-mono bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600 select-all">
            {asset.code}
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
            getActiveLabel(asset.status) === '활성'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700'
              : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600'
          }`}>
            {getActiveLabel(asset.status)}
          </span>
        </div>
      )}

      {/* 탭 */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 px-6 bg-slate-50/50 dark:bg-slate-800/30">
        {tabs.filter((t) => t.show).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* 콘텐츠 */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <RefreshCcw className="w-5 h-5 animate-spin text-blue-500 mr-2" />
            <span className="text-slate-500">불러오는 중...</span>
          </div>
        ) : !asset ? (
          <p className="text-center text-slate-400 py-16">자산 정보를 불러올 수 없습니다.</p>
        ) : (
          <>
            {/* ── 기본정보 탭 ── */}
            {tab === 'info' && (
              <div className="space-y-4">

                {/* 액션 바: 수정 버튼 (좌) + 상태변경 (우) */}
                <div className="flex items-center justify-between gap-3">

                  {/* 수정 버튼 */}
                  <div className="flex gap-2">
                    {canManageAssets && !isEditing && (
                      <button onClick={startEdit} className="flex items-center px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 transition-colors">
                        <Pencil className="w-3.5 h-3.5 mr-1" />수정
                      </button>
                    )}
                    {isEditing && (
                      <>
                        <button onClick={() => setIsEditing(false)} className="flex items-center px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                          <X className="w-3.5 h-3.5 mr-1" />취소
                        </button>
                        <button onClick={saveEdit} disabled={editLoading} className="flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                          {editLoading ? <RefreshCcw className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5 mr-1" />}저장
                        </button>
                      </>
                    )}
                  </div>

                  {/* 상태변경 — admin/manager 전용, view 모드에서만 */}
                  {canManageSystem && !isEditing && (
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                        className="text-xs border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-300 bg-white dark:bg-slate-700 dark:text-slate-200"
                      >
                        {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <button
                        onClick={handleStatusChange}
                        disabled={statusLoading || newStatus === asset.status}
                        className="flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {statusLoading ? <RefreshCcw className="w-3 h-3 animate-spin" /> : '변경'}
                      </button>
                    </div>
                  )}
                </div>

                {/* 2컬럼: 좌(자산정보) + 우(첨부파일) */}
                <div className="flex gap-5 items-start">

                  {/* 좌측 — 자산 정보 */}
                  <div className="flex-1 min-w-0 space-y-3">

                    {/* 품명 */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
                      <p className="text-xs text-blue-500 dark:text-blue-400 font-medium mb-1">품명 (모델명)</p>
                      {isEditing ? (
                        <input
                          value={editForm.name}
                          onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                          className="w-full text-base font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 border border-blue-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-300"
                        />
                      ) : (
                        <p className="text-base font-bold text-slate-900 dark:text-slate-100">{asset.name}</p>
                      )}
                    </div>

                    {/* 조회 모드 */}
                    {!isEditing && (
                      <div className="grid grid-cols-2 gap-2.5">
                        {[
                          { label: '분류코드',    value: ASSET_CATEGORY_LABEL[asset.category] ?? asset.category },
                          { label: '상태',        value: ASSET_STATUS_LABEL[asset.status] ?? asset.status },
                          { label: '사업장',      value: asset.department },
                          { label: '상세위치/층', value: asset.location },
                          { label: '취득가액',    value: formatCurrency(Number(asset.price)) },
                          { label: '취득일',      value: asset.acquiredDate?.split('T')[0] ?? '-' },
                          { label: '담당자',      value: asset.assignedTo ?? '-' },
                          { label: '시리얼번호',  value: asset.barcode ?? '-' },
                          { label: '중분류',      value: asset.subCategory ?? '-' },
                          { label: '사이즈',      value: asset.size ?? '-' },
                          { label: '색상',        value: asset.color ?? '-' },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 border border-slate-100 dark:border-slate-600">
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-0.5">{label}</p>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</p>
                          </div>
                        ))}
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 border border-slate-100 dark:border-slate-600">
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-0.5">보증기간</p>
                          {(() => { const ws = getWarrantyStatus(asset.warrantyDate); return <span className={`text-xs font-bold px-2 py-0.5 rounded border ${ws.color}`}>{ws.text}</span> })()}
                        </div>
                        {asset.description && (
                          <div className="col-span-2 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 border border-slate-100 dark:border-slate-600">
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-0.5">세부정보</p>
                            <p className="text-sm text-slate-700 dark:text-slate-200">{asset.description}</p>
                          </div>
                        )}
                        {asset.remarks && (
                          <div className="col-span-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-100 dark:border-amber-800">
                            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-0.5">비고</p>
                            <p className="text-sm text-slate-700 dark:text-slate-200">{asset.remarks}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 수정 모드 */}
                    {isEditing && (
                      <div className="grid grid-cols-2 gap-2.5">
                        {([
                          { label: '사업장',      key: 'department'  as const, placeholder: '본사 / 3공장 / 수원연구소' },
                          { label: '상세위치/층', key: 'location'    as const, placeholder: '3층 / A동 창고' },
                          { label: '담당자',      key: 'assignedTo'  as const, placeholder: '홍길동 / 총무팀' },
                          { label: '시리얼번호',  key: 'barcode'     as const, placeholder: '제품 시리얼번호' },
                          { label: '중분류',      key: 'subCategory' as const, placeholder: 'FR / IT-NB / CHAIR' },
                          { label: '사이즈',      key: 'size'        as const, placeholder: '1600x800x720' },
                          { label: '색상',        key: 'color'       as const, placeholder: 'white / 원목 / 블랙' },
                        ]).map(({ label, key, placeholder }) => (
                          <div key={key} className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 border border-slate-200 dark:border-slate-600">
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-0.5">{label}</p>
                            <input
                              value={editForm[key]}
                              onChange={(e) => setEditForm((p) => ({ ...p, [key]: e.target.value }))}
                              placeholder={placeholder}
                              className="w-full text-sm font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-600 border border-slate-300 dark:border-slate-500 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-300"
                            />
                          </div>
                        ))}
                        <div className="col-span-2 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 border border-slate-200 dark:border-slate-600">
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-0.5">세부정보</p>
                          <input
                            value={editForm.description}
                            onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                            placeholder="믹스 일자 사무용책상 (Black leg)"
                            className="w-full text-sm font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-600 border border-slate-300 dark:border-slate-500 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-300"
                          />
                        </div>
                        <div className="col-span-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-200 dark:border-amber-800">
                          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-0.5">비고</p>
                          <textarea
                            value={editForm.remarks}
                            onChange={(e) => setEditForm((p) => ({ ...p, remarks: e.target.value }))}
                            placeholder="특이사항, 메모 등"
                            rows={2}
                            className="w-full text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-600 border border-amber-300 dark:border-amber-700 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-amber-300 resize-none"
                          />
                        </div>
                        {[
                          { label: '분류코드', value: ASSET_CATEGORY_LABEL[asset.category] ?? asset.category },
                          { label: '상태',     value: ASSET_STATUS_LABEL[asset.status] ?? asset.status },
                          { label: '취득가액', value: formatCurrency(Number(asset.price)) },
                          { label: '취득일',   value: asset.acquiredDate?.split('T')[0] ?? '-' },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 opacity-60">
                            <p className="text-xs text-slate-400 font-medium mb-0.5">{label} <span className="text-[10px]">(읽기전용)</span></p>
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{value}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 우측 — 첨부파일 */}
                  <div className="w-52 shrink-0">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">첨부파일</p>
                    <div className="max-h-80 overflow-y-auto pr-0.5 custom-scrollbar">
                      <AssetFilesTab assetId={asset.id} />
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ── 유지보수 탭 ── */}
            {tab === 'maintenance' && canManageAssets && (
              <div className="space-y-5">
                <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-4 border border-slate-200 dark:border-slate-600 space-y-3">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">유지보수 이력 추가</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">날짜</label>
                      <input type="date" value={mForm.date} onChange={(e) => setMForm((p) => ({ ...p, date: e.target.value }))}
                        className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">업체명</label>
                      <input type="text" value={mForm.vendor} placeholder="삼성서비스센터" onChange={(e) => setMForm((p) => ({ ...p, vendor: e.target.value }))}
                        className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">비용 (원)</label>
                      <input type="number" value={mForm.cost} placeholder="150000" onChange={(e) => setMForm((p) => ({ ...p, cost: e.target.value }))}
                        className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">내용</label>
                      <input type="text" value={mForm.detail} placeholder="배터리 교체" onChange={(e) => setMForm((p) => ({ ...p, detail: e.target.value }))}
                        className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                  </div>
                  {mError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{mError}</p>}
                  <button onClick={handleAddMaintenance} disabled={mLoading}
                    className="flex items-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    {mLoading ? <RefreshCcw className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}추가
                  </button>
                </div>
                {asset.maintenanceLogs.length === 0 ? (
                  <p className="text-center text-slate-400 py-8">유지보수 이력이 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {asset.maintenanceLogs.map((log) => (
                      <div key={log.id} className="flex items-start justify-between bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl p-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{log.detail}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{log.date?.split('T')[0]} · {log.vendor}</p>
                        </div>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatCurrency(Number(log.cost))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── 정기점검 탭 ── */}
            {tab === 'schedule' && (
              <MaintenanceScheduleTab assetId={asset.id} canManage={canManageAssets} />
            )}

            {/* ── 이력 탭 ── */}
            {tab === 'history' && (
              <div>
                {asset.historyLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
                    <History className="w-8 h-8 opacity-30" />
                    <p className="text-sm">이력이 없습니다.</p>
                  </div>
                ) : (
                  <>
                    {/* 건수 요약 */}
                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
                      총 {asset.historyLogs.length}건
                      {!historyShowAll && asset.historyLogs.length > HISTORY_SHOW_DEFAULT && ` · 최신 ${HISTORY_SHOW_DEFAULT}건 표시`}
                    </p>

                    <div className="relative pl-7">
                      {/* 세로 그라데이션 선 */}
                      <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-gradient-to-b from-slate-300 via-slate-200 to-transparent dark:from-slate-600 dark:via-slate-700" />

                      {(historyShowAll ? asset.historyLogs : asset.historyLogs.slice(0, HISTORY_SHOW_DEFAULT)).map((log, idx) => {
                        const cfg = HISTORY_TYPE_CONFIG[log.type] ?? DEFAULT_HISTORY_CONFIG
                        return (
                          <div key={log.id} className={`relative ${idx > 0 ? 'pt-4' : ''} pb-1 last:pb-0`}>
                            {/* 타입별 색상 아이콘 dot */}
                            <div className={`absolute -left-4 top-${idx > 0 ? '4' : '0'} w-6 h-6 rounded-full ${cfg.dot} flex items-center justify-center text-white shadow-sm ring-2 ring-white dark:ring-slate-800`}>
                              {cfg.icon}
                            </div>

                            <div className="bg-white dark:bg-slate-700/60 border border-slate-100 dark:border-slate-600 rounded-xl p-3.5 shadow-sm">
                              {/* 상단: 타입 배지 + 시간 */}
                              <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${cfg.badge}`}>
                                  {HISTORY_TYPE_LABEL[log.type] ?? log.type}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-400 dark:text-slate-500">
                                    {historyTimeAgo(log.date)}
                                  </span>
                                  <span className="text-[10px] text-slate-300 dark:text-slate-600 font-mono hidden sm:inline">
                                    {log.date?.split('T')[0]}
                                  </span>
                                </div>
                              </div>
                              {/* 내용 */}
                              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{log.detail}</p>
                              {/* 처리자 */}
                              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 flex items-center gap-1">
                                <span className="inline-block w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                                처리자: {log.user?.name ?? '-'}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* 더보기 / 접기 */}
                    {asset.historyLogs.length > HISTORY_SHOW_DEFAULT && (
                      <div className="mt-5 text-center">
                        <button
                          onClick={() => setHistoryShowAll((p) => !p)}
                          className="text-xs font-semibold text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors px-5 py-2 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-blue-100 dark:border-blue-800"
                        >
                          {historyShowAll
                            ? `최신 ${HISTORY_SHOW_DEFAULT}건만 보기 ↑`
                            : `전체 ${asset.historyLogs.length}건 보기 ↓`}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>

    {isQrOpen && asset && (
      <QrTagModal
        assets={[{
          id:         asset.id,
          code:       asset.code,
          name:       asset.name,
          category:   asset.category,
          department: asset.department,
          location:   asset.location,
          status:     asset.status,
          price:      asset.price,
          acquiredDate: asset.acquiredDate ?? '',
        } as ApiAsset]}
        onClose={() => setIsQrOpen(false)}
      />
    )}
    {isReportOpen && asset && (
      <AssetReportCard
        asset={{
          id:             asset.id,
          code:           asset.code,
          name:           asset.name,
          category:       asset.category,
          department:     asset.department,
          location:       asset.location,
          status:         asset.status,
          price:          asset.price,
          acquiredDate:   asset.acquiredDate ?? null,
          warrantyDate:   asset.warrantyDate ?? null,
          barcode:        asset.barcode ?? null,
          remarks:        asset.remarks ?? null,
          subCategory:    asset.subCategory ?? null,
          description:    asset.description ?? null,
          size:           asset.size ?? null,
          color:          asset.color ?? null,
          assignedTo:     asset.assignedTo ?? null,
          maintenanceLogs: asset.maintenanceLogs.map((l) => ({
            id:     l.id,
            date:   l.date,
            vendor: l.vendor,
            cost:   l.cost,
            detail: l.detail,
          })),
        }}
        onClose={() => setIsReportOpen(false)}
      />
    )}
  </>
  )
}
