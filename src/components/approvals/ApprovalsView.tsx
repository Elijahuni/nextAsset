'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileText, CheckCircle, XCircle, Clock, PlusCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useUser } from '@/context/user-context'
import ApprovalDetailModal from './ApprovalDetailModal'
import ApprovalDraftModal from '../assets/ApprovalDraftModal'
import { Skeleton, Badge, EmptyTableRow } from '@/components/ui'
import type { ApiApproval } from '@/types'

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
  PURCHASE: '구매', DISPOSAL: '폐기', TRANSFER: '이관', MAINTENANCE_REQUEST: '유지보수', RENTAL: '대여',
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING:   <Clock className="w-3.5 h-3.5 mr-1" />,
  APPROVED:  <CheckCircle className="w-3.5 h-3.5 mr-1" />,
  REJECTED:  <XCircle className="w-3.5 h-3.5 mr-1" />,
  CANCELLED: <XCircle className="w-3.5 h-3.5 mr-1" />,
}

export default function ApprovalsView() {
  const { isEmployee, currentUser } = useUser()
  const [approvals, setApprovals] = useState<ApiApproval[]>([])
  const [loading, setLoading] = useState(true)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [isDraftOpen, setIsDraftOpen] = useState(false)

  const fetchApprovals = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (isEmployee) {
      // employee: 본인 기안만
      params.set('applicantId', currentUser.id)
    } else if (currentUser.role === 'manager') {
      // manager: 본인 부서 기안 OR 본인이 결재자인 건
      params.set('department', currentUser.department)
      params.set('approverId', currentUser.id)
    }
    // admin: 전체 조회 (파라미터 없음)
    fetch(`/api/approvals?${params.toString()}`)
      .then((r) => r.json())
      .then((data: ApiApproval[]) => setApprovals(Array.isArray(data) ? data : []))
      .catch(() => toast.error('결재 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [isEmployee, currentUser.id])

  useEffect(() => { fetchApprovals() }, [fetchApprovals])

  const skeletonRows = Array.from({ length: 6 }).map((_, i) => (
    <tr key={i} className="border-b border-slate-100">
      <td className="px-6 py-4"><Skeleton className="h-6 w-16 rounded-md" /></td>
      <td className="px-6 py-4"><Skeleton className="h-4 w-20" /></td>
      <td className="px-6 py-4"><Skeleton className="h-4 w-12" /></td>
      <td className="px-6 py-4"><Skeleton className="h-4 w-48" /></td>
      <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
      <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
    </tr>
  ))

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center">
          <FileText className="w-5 h-5 mr-2 text-blue-600" />
          {isEmployee ? '나의 결재 진행 현황' : '결재 진행 문서함'}
        </h2>
        <div className="flex items-center gap-3">
          {loading
            ? <Skeleton className="h-4 w-10" />
            : <span className="text-sm text-slate-400">{approvals.length}건</span>
          }
          <button
            onClick={() => setIsDraftOpen(true)}
            className="flex items-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <PlusCircle className="w-4 h-4 mr-1.5" /> 기안하기
          </button>
        </div>
      </div>

      {/* ── 모바일 카드 뷰 (lg 미만) ────────────────────────────────────────── */}
      <div className="lg:hidden flex-1 overflow-auto custom-scrollbar">
        {loading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-6 w-16 rounded-md" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        ) : approvals.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
            결재 문서가 없습니다.
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {approvals.map((approval) => (
              <div
                key={approval.id}
                onClick={() => setDetailId(approval.id)}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 cursor-pointer active:bg-slate-50 dark:active:bg-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <Badge
                    colorClass={STATUS_COLOR[approval.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}
                    label={STATUS_LABEL[approval.status] ?? approval.status}
                    icon={STATUS_ICONS[approval.status]}
                    size="md"
                  />
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-mono shrink-0">
                    {approval.createdAt?.split('T')[0] ?? '-'}
                  </span>
                </div>
                <p className="font-bold text-slate-900 dark:text-slate-100 mb-1.5 truncate">{approval.title}</p>
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-[11px] font-medium mr-2">
                      {TYPE_LABEL[approval.type] ?? approval.type}
                    </span>
                    {approval.applicant?.name ?? approval.applicantId}
                    {approval.applicant?.department && ` (${approval.applicant.department})`}
                  </span>
                  {approval.approver && (
                    <span className="shrink-0">→ {approval.approver.name}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 데스크탑 테이블 (lg 이상) ─────────────────────────────────────── */}
      <div className="hidden lg:block flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
          <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-4 font-semibold">결재상태</th>
              <th className="px-6 py-4 font-semibold">신청일시</th>
              <th className="px-6 py-4 font-semibold">유형</th>
              <th className="px-6 py-4 font-semibold">결재명칭 (제목)</th>
              <th className="px-6 py-4 font-semibold">기안자</th>
              <th className="px-6 py-4 font-semibold">결재자</th>
            </tr>
          </thead>
          <tbody>
            {loading ? skeletonRows : approvals.map((approval) => (
              <tr
                key={approval.id}
                onClick={() => setDetailId(approval.id)}
                className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
              >
                <td className="px-6 py-4">
                  <Badge
                    colorClass={STATUS_COLOR[approval.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}
                    label={STATUS_LABEL[approval.status] ?? approval.status}
                    icon={STATUS_ICONS[approval.status]}
                    size="md"
                  />
                </td>
                <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                  {approval.createdAt?.split('T')[0] ?? '-'}
                </td>
                <td className="px-6 py-4 font-medium text-slate-700">
                  {TYPE_LABEL[approval.type] ?? approval.type}
                </td>
                <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">{approval.title}</td>
                <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                  {approval.applicant?.name ?? approval.applicantId}
                  {approval.applicant?.department && (
                    <span className="text-slate-400 dark:text-slate-500 text-xs ml-1">({approval.applicant.department})</span>
                  )}
                </td>
                <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                  {approval.approver?.name ?? '-'}
                </td>
              </tr>
            ))}
            {!loading && approvals.length === 0 && (
              <EmptyTableRow colSpan={6} message="결재 문서가 없습니다." />
            )}
          </tbody>
        </table>
      </div>

      {detailId && (
        <ApprovalDetailModal
          approvalId={detailId}
          onClose={() => setDetailId(null)}
          onUpdated={fetchApprovals}
        />
      )}

      {isDraftOpen && (
        <ApprovalDraftModal
          selectedAssets={[]}
          onClose={() => setIsDraftOpen(false)}
          onSuccess={() => { fetchApprovals(); toast.success('결재가 기안되었습니다.') }}
        />
      )}
    </div>
  )
}
