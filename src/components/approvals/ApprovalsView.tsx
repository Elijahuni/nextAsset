'use client'

import { useEffect, useState } from 'react'
import { FileText, RefreshCcw, CheckCircle, XCircle, Clock } from 'lucide-react'
import { useUser } from '@/context/user-context'

interface ApiApproval {
  id: string
  title: string
  type: string
  status: string
  reason: string | null
  applicantId: string
  approverId: string | null
  createdAt: string
  updatedAt: string
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
  PURCHASE: '구매', DISPOSAL: '폐기', TRANSFER: '이관', MAINTENANCE_REQUEST: '유지보수', RENTAL: '대여',
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING:   <Clock className="w-3.5 h-3.5 mr-1" />,
  APPROVED:  <CheckCircle className="w-3.5 h-3.5 mr-1" />,
  REJECTED:  <XCircle className="w-3.5 h-3.5 mr-1" />,
  CANCELLED: <XCircle className="w-3.5 h-3.5 mr-1" />,
}

export default function ApprovalsView() {
  const { isEmployee } = useUser()
  const [approvals, setApprovals] = useState<ApiApproval[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/approvals')
      .then((r) => r.json())
      .then((data: ApiApproval[]) => setApprovals(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCcw className="w-5 h-5 animate-spin text-blue-500 mr-2" />
        <span className="text-slate-500">불러오는 중...</span>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
        <h2 className="text-lg font-bold text-slate-800 flex items-center">
          <FileText className="w-5 h-5 mr-2 text-blue-600" />
          {isEmployee ? '나의 결재 진행 현황' : '결재 진행 문서함'}
        </h2>
        <span className="text-sm text-slate-400">{approvals.length}건</span>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-sm text-left text-slate-600">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10">
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
            {approvals.map((approval) => (
              <tr key={approval.id} className="bg-white border-b border-slate-100 hover:bg-slate-50/80 cursor-pointer transition-colors">
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-md border ${STATUS_COLOR[approval.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {STATUS_ICONS[approval.status]}
                    {STATUS_LABEL[approval.status] ?? approval.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                  {approval.createdAt?.split('T')[0] ?? '-'}
                </td>
                <td className="px-6 py-4 font-medium text-slate-700">
                  {TYPE_LABEL[approval.type] ?? approval.type}
                </td>
                <td className="px-6 py-4 font-bold text-slate-900">{approval.title}</td>
                <td className="px-6 py-4 text-slate-600">{approval.applicantId}</td>
                <td className="px-6 py-4 text-slate-600">{approval.approverId ?? '-'}</td>
              </tr>
            ))}
            {approvals.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-16 text-slate-400">
                  결재 문서가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
