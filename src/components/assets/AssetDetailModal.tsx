'use client'

import { useEffect, useState } from 'react'
import { RefreshCcw, Wrench, History, Info, ShieldAlert, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useUser } from '@/context/user-context'
import { ASSET_CATEGORY_LABEL, ASSET_STATUS_LABEL, formatCurrency, getWarrantyStatus } from '@/lib/utils'
import { Modal } from '@/components/ui'

interface HistoryLog {
  id: string
  type: string
  detail: string
  date: string
  user: { id: string; name: string }
}

interface MaintenanceLog {
  id: string
  date: string
  vendor: string
  cost: string | number
  detail: string
}

interface AssetDetail {
  id: string
  code: string
  barcode: string | null
  name: string
  category: string
  department: string
  location: string
  status: string
  price: string | number
  acquiredDate: string
  warrantyDate: string | null
  historyLogs: HistoryLog[]
  maintenanceLogs: MaintenanceLog[]
}

interface AssetDetailModalProps {
  assetId: string
  onClose: () => void
  onUpdated: () => void
}

const STATUS_OPTIONS = [
  { value: 'AVAILABLE', label: '사용가능' },
  { value: 'IN_USE', label: '사용중' },
  { value: 'UNDER_MAINTENANCE', label: '수리중' },
  { value: 'RETIRED', label: '보관중' },
  { value: 'DISPOSED', label: '처분' },
]

const HISTORY_TYPE_LABEL: Record<string, string> = {
  ASSIGNED: '배정', RETURNED: '반납', TRANSFERRED: '이관',
  MAINTAINED: '수리', DISPOSED: '폐기', STATUS_CHANGED: '상태변경',
}

const TODAY = new Date().toISOString().split('T')[0]

type Tab = 'info' | 'maintenance' | 'history' | 'status'

export default function AssetDetailModal({ assetId, onClose, onUpdated }: AssetDetailModalProps) {
  const { canManageAssets, canManageSystem } = useUser()
  const [asset, setAsset] = useState<AssetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('info')

  // 유지보수 폼
  const [mForm, setMForm] = useState({ date: TODAY, vendor: '', cost: '', detail: '' })
  const [mLoading, setMLoading] = useState(false)
  const [mError, setMError] = useState('')

  // 상태변경 폼
  const [newStatus, setNewStatus] = useState('')
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  const fetchAsset = () => {
    setLoading(true)
    fetch(`/api/assets/${assetId}`)
      .then((r) => r.json())
      .then((data: AssetDetail) => {
        setAsset(data)
        setNewStatus(data.status)
      })
      .catch(() => toast.error('자산 정보를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchAsset() }, [assetId])

  const handleAddMaintenance = async () => {
    if (!mForm.vendor || !mForm.cost || !mForm.detail) {
      setMError('모든 항목을 입력해주세요.')
      return
    }
    setMLoading(true)
    setMError('')
    try {
      const res = await fetch(`/api/assets/${assetId}/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...mForm, cost: Number(mForm.cost) }),
      })
      if (!res.ok) {
        const d = await res.json()
        setMError(d.error ?? '등록 실패')
        toast.error(d.error ?? '유지보수 등록에 실패했습니다.')
        return
      }
      toast.success('유지보수 이력이 등록되었습니다.')
      setMForm({ date: TODAY, vendor: '', cost: '', detail: '' })
      fetchAsset()
    } catch {
      setMError('서버 오류가 발생했습니다.')
    } finally {
      setMLoading(false)
    }
  }

  const handleStatusChange = async () => {
    if (!newStatus || newStatus === asset?.status) return
    setStatusLoading(true)
    setStatusMsg('')
    try {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const d = await res.json()
        setStatusMsg(d.error ?? '변경 실패')
        toast.error(d.error ?? '상태 변경에 실패했습니다.')
        return
      }
      toast.success('자산 상태가 변경되었습니다.')
      setStatusMsg('상태가 변경되었습니다.')
      fetchAsset()
      onUpdated()
    } catch {
      setStatusMsg('서버 오류가 발생했습니다.')
    } finally {
      setStatusLoading(false)
    }
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode; show: boolean }[] = [
    { key: 'info',        label: '기본정보',  icon: <Info className="w-4 h-4" />,       show: true },
    { key: 'maintenance', label: '유지보수',  icon: <Wrench className="w-4 h-4" />,     show: canManageAssets },
    { key: 'history',     label: '이력',      icon: <History className="w-4 h-4" />,    show: true },
    { key: 'status',      label: '상태변경',  icon: <ShieldAlert className="w-4 h-4" />, show: canManageSystem },
  ]

  return (
    <Modal
      title={loading ? '불러오는 중...' : (asset?.name ?? '')}
      onClose={onClose}
      size="2xl"
      footer={
        <div className="px-6 py-4 flex justify-end">
          <button onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
            닫기
          </button>
        </div>
      }
    >
      {/* 자산코드 서브텍스트 */}
      {asset && (
        <p className="text-xs font-mono text-slate-400 px-6 pt-3">{asset.code}</p>
      )}

      {/* 탭 */}
      <div className="flex border-b border-slate-200 px-6 bg-slate-50/50">
        {tabs.filter((t) => t.show).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
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
            {/* 기본정보 탭 */}
            {tab === 'info' && (
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: '자산코드', value: asset.code },
                  { label: '품목', value: ASSET_CATEGORY_LABEL[asset.category] ?? asset.category },
                  { label: '부서', value: asset.department },
                  { label: '위치', value: asset.location },
                  { label: '상태', value: ASSET_STATUS_LABEL[asset.status] ?? asset.status },
                  { label: '취득가액', value: formatCurrency(Number(asset.price)) },
                  { label: '취득일', value: asset.acquiredDate?.split('T')[0] ?? '-' },
                  { label: '바코드', value: asset.barcode ?? '미설정' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <p className="text-xs text-slate-400 font-medium mb-1">{label}</p>
                    <p className="text-sm font-semibold text-slate-800">{value}</p>
                  </div>
                ))}
                <div className="col-span-2 bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs text-slate-400 font-medium mb-1">보증기간</p>
                  {(() => {
                    const ws = getWarrantyStatus(asset.warrantyDate)
                    return (
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${ws.color}`}>
                        {ws.text}
                      </span>
                    )
                  })()}
                </div>
              </div>
            )}

            {/* 유지보수 탭 */}
            {tab === 'maintenance' && canManageAssets && (
              <div className="space-y-5">
                {/* 추가 폼 */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                  <p className="text-sm font-bold text-slate-700">유지보수 이력 추가</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">날짜</label>
                      <input type="date" value={mForm.date}
                        onChange={(e) => setMForm((p) => ({ ...p, date: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">업체명</label>
                      <input type="text" value={mForm.vendor} placeholder="삼성서비스센터"
                        onChange={(e) => setMForm((p) => ({ ...p, vendor: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">비용 (원)</label>
                      <input type="number" value={mForm.cost} placeholder="150000"
                        onChange={(e) => setMForm((p) => ({ ...p, cost: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">내용</label>
                      <input type="text" value={mForm.detail} placeholder="배터리 교체"
                        onChange={(e) => setMForm((p) => ({ ...p, detail: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                  </div>
                  {mError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{mError}</p>}
                  <button onClick={handleAddMaintenance} disabled={mLoading}
                    className="flex items-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    {mLoading ? <RefreshCcw className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                    추가
                  </button>
                </div>

                {/* 목록 */}
                {asset.maintenanceLogs.length === 0 ? (
                  <p className="text-center text-slate-400 py-8">유지보수 이력이 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {asset.maintenanceLogs.map((log) => (
                      <div key={log.id} className="flex items-start justify-between bg-white border border-slate-200 rounded-xl p-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{log.detail}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{log.date?.split('T')[0]} · {log.vendor}</p>
                        </div>
                        <span className="text-sm font-bold text-slate-700">{formatCurrency(Number(log.cost))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 이력 탭 */}
            {tab === 'history' && (
              <div>
                {asset.historyLogs.length === 0 ? (
                  <p className="text-center text-slate-400 py-16">이력이 없습니다.</p>
                ) : (
                  <div className="relative pl-5 space-y-0">
                    <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-slate-200" />
                    {asset.historyLogs.map((log) => (
                      <div key={log.id} className="relative pb-5">
                        <div className="absolute -left-3 top-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow" />
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 ml-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                              {HISTORY_TYPE_LABEL[log.type] ?? log.type}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">{log.date?.split('T')[0]}</span>
                          </div>
                          <p className="text-sm text-slate-700">{log.detail}</p>
                          <p className="text-xs text-slate-400 mt-0.5">처리자: {log.user?.name ?? '-'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 상태변경 탭 (admin only) */}
            {tab === 'status' && canManageSystem && (
              <div className="space-y-4">
                <p className="text-sm text-slate-500">현재 상태: <span className="font-bold text-slate-800">{ASSET_STATUS_LABEL[asset.status] ?? asset.status}</span></p>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-2">새 상태 선택</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                {statusMsg && (
                  <p className={`text-sm px-3 py-2 rounded-lg border ${statusMsg.includes('변경') ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'}`}>
                    {statusMsg}
                  </p>
                )}
                <button
                  onClick={handleStatusChange}
                  disabled={statusLoading || newStatus === asset.status}
                  className="flex items-center px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {statusLoading ? <RefreshCcw className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                  상태 변경
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
