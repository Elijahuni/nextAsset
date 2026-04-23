'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Ban, RefreshCcw, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { useUser } from '@/context/user-context'
import { ASSET_STATUS_LABEL, ASSET_CATEGORY_LABEL } from '@/lib/utils'
import { Modal } from '@/components/ui'

interface ApprovalAsset {
  asset: {
    id: string
    code: string
    name: string
    category: string
    department: string
    status: string
    location: string
  }
}

interface ApprovalDetail {
  id: string
  title: string
  type: string
  status: string
  reason: string | null
  createdAt: string
  applicant: { id: string; name: string; department: string; role: string }
  approver: { id: string; name: string; role: string } | null
  assets: ApprovalAsset[]
}

interface ApprovalDetailModalProps {
  approvalId: string
  onClose: () => void
  onUpdated: () => void
}

const STATUS_COLOR: Record<string, string> = {
  PENDING:   'bg-amber-100 text-amber-800 border-amber-200',
  APPROVED:  'bg-emerald-100 text-emerald-800 border-emerald-200',
  REJECTED:  'bg-red-100 text-red-700 border-red-200',
  CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: '검토중', APPROVED: '승인됨', REJECTED: '반려됨', CANCELLED: '취소됨',
}

const TYPE_LABEL: Record<string, string> = {
  PURCHASE: '구매', DISPOSAL: '폐기', TRANSFER: '이관',
  MAINTENANCE_REQUEST: '유지보수', RENTAL: '대여',
}

export default function ApprovalDetailModal({ approvalId, onClose, onUpdated }: ApprovalDetailModalProps) {
  const { currentUser, canManageAssets } = useUser()
  const [approval, setApproval] = useState<ApprovalDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/approvals/${approvalId}`)
      .then((r) => r.json())
      .then((data: ApprovalDetail) => setApproval(data))
      .catch(() => toast.error('결재 정보를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [approvalId])

  const handleAction = async (status: 'APPROVED' | 'REJECTED' | 'CANCELLED') => {
    setActionLoading(status)
    setError('')
    try {
      const body: Record<string, string> = { status }
      if (status === 'APPROVED') body.approverId = currentUser.id
      const res = await fetch(`/api/approvals/${approvalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '처리 실패')
        toast.error(data.error ?? '처리에 실패했습니다.')
        return
      }
      const labels: Record<string, string> = { APPROVED: '승인', REJECTED: '반려', CANCELLED: '취소' }
      toast.success(`결재가 ${labels[status] ?? '처리'}되었습니다.`)
      onUpdated()
      onClose()
    } catch {
      setError('서버 오류가 발생했습니다.')
    } finally {
      setActionLoading(null)
    }
  }

  const isPending = approval?.status === 'PENDING'
  const isApplicant = approval?.applicant?.id === currentUser.id

  return (
    <Modal
      title={<><FileText className="w-5 h-5 mr-2 text-blue-600" />결재 상세</>}
      onClose={onClose}
      size="xl"
      footer={
        <div className="p-6 border-t border-slate-100 flex justify-between items-center">
          {/* 취소 버튼 (기안자 본인 + PENDING) */}
          <div>
            {isPending && isApplicant && (
              <button
                onClick={() => handleAction('CANCELLED')}
                disabled={actionLoading !== null}
                className="flex items-center px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
              >
                {actionLoading === 'CANCELLED' ? <RefreshCcw className="w-4 h-4 mr-2 animate-spin" /> : <Ban className="w-4 h-4 mr-2" />}
                기안 취소
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={onClose}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
              닫기
            </button>

            {/* 승인/반려 (admin/manager + PENDING) */}
            {isPending && canManageAssets && (
              <>
                <button
                  onClick={() => handleAction('REJECTED')}
                  disabled={actionLoading !== null}
                  className="flex items-center px-4 py-2.5 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                >
                  {actionLoading === 'REJECTED' ? <RefreshCcw className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                  반려
                </button>
                <button
                  onClick={() => handleAction('APPROVED')}
                  disabled={actionLoading !== null}
                  className="flex items-center px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {actionLoading === 'APPROVED' ? <RefreshCcw className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                  승인
                </button>
              </>
            )}
          </div>
        </div>
      }
    >
      <div className="p-6 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <RefreshCcw className="w-5 h-5 animate-spin text-blue-500 mr-2" />
            <span className="text-slate-500">불러오는 중...</span>
          </div>
        ) : !approval ? (
          <p className="text-center text-slate-400 py-16">결재 정보를 불러올 수 없습니다.</p>
        ) : (
          <>
            {/* 제목 + 상태 */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{approval.title}</h3>
                <p className="text-xs text-slate-400 mt-1 font-mono">{approval.createdAt?.split('T')[0]}</p>
              </div>
              <span className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg border ${STATUS_COLOR[approval.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                {STATUS_LABEL[approval.status] ?? approval.status}
              </span>
            </div>

            {/* 메타 정보 */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: '결재 유형', value: TYPE_LABEL[approval.type] ?? approval.type },
                { label: '기안자', value: `${approval.applicant?.name} (${approval.applicant?.department})` },
                { label: '결재자', value: approval.approver ? approval.approver.name : '미지정' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-xs text-slate-400 font-medium">{label}</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {/* 사유 */}
            {approval.reason && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">결재 사유</p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {approval.reason}
                </div>
              </div>
            )}

            {/* 연결 자산 */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">대상 자산 ({approval.assets.length}건)</p>
              {approval.assets.length === 0 ? (
                <p className="text-sm text-slate-400">연결된 자산이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {approval.assets.map(({ asset }) => (
                    <div key={asset.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{asset.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5 font-mono">{asset.code} · {ASSET_CATEGORY_LABEL[asset.category] ?? asset.category} · {asset.location}</p>
                      </div>
                      <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                        {ASSET_STATUS_LABEL[asset.status] ?? asset.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
