'use client'

import { useState } from 'react'
import { FileSignature, Sparkles, RefreshCcw, CheckCircle } from 'lucide-react'
import { useUser, MOCK_USERS } from '@/context/user-context'
import { Modal } from '@/components/ui'

interface ApiAsset {
  id: string
  code: string
  name: string
  category: string
  department: string
  location: string
  status: string
  price: string | number
  acquiredDate: string
}

interface ApprovalDraftModalProps {
  selectedAssets: ApiAsset[]
  onClose: () => void
  onSuccess: () => void
}

const APPROVAL_TYPE_OPTIONS = [
  { value: 'PURCHASE',            label: '구매' },
  { value: 'DISPOSAL',            label: '폐기' },
  { value: 'TRANSFER',            label: '이관' },
  { value: 'MAINTENANCE_REQUEST', label: '유지보수' },
  { value: 'RENTAL',              label: '대여' },
]

export default function ApprovalDraftModal({ selectedAssets, onClose, onSuccess }: ApprovalDraftModalProps) {
  const { currentUser } = useUser()

  const [title, setTitle] = useState('')
  const [type, setType] = useState('PURCHASE')
  const [approverId, setApproverId] = useState('')
  const [reason, setReason] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const approverOptions = MOCK_USERS.filter((u) => u.id !== currentUser.id)

  const handleAiDraft = async () => {
    if (!reason.trim()) {
      setAiError('사유 초안을 먼저 입력해주세요.')
      return
    }
    setAiLoading(true)
    setAiError('')
    try {
      const targetAssets = selectedAssets.map((a) => a.name).join(', ')
      const typLabel = APPROVAL_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type
      const res = await fetch('/api/ai/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalType: typLabel,
          targetAssets,
          draftReason: reason,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAiError(data.error ?? 'AI 생성 실패')
        return
      }
      setReason(data.text ?? reason)
    } catch {
      setAiError('AI 서비스에 연결할 수 없습니다.')
    } finally {
      setAiLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      setSubmitError('결재 제목을 입력해주세요.')
      return
    }
    setSubmitLoading(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          type,
          applicantId: currentUser.id,
          assetIds: selectedAssets.map((a) => a.id),
          ...(reason && { reason }),
          ...(approverId && { approverId }),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error ?? '기안 실패')
        return
      }
      onSuccess()
      onClose()
    } catch {
      setSubmitError('서버 오류가 발생했습니다.')
    } finally {
      setSubmitLoading(false)
    }
  }

  return (
    <Modal
      title={<><FileSignature className="w-5 h-5 mr-2 text-blue-600" />결재 기안</>}
      onClose={onClose}
      size="xl"
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
            disabled={submitLoading}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
          >
            {submitLoading
              ? <><RefreshCcw className="w-4 h-4 mr-2 animate-spin" />기안 중...</>
              : <><CheckCircle className="w-4 h-4 mr-2" />기안 제출</>
            }
          </button>
        </div>
      }
    >
      <div className="p-6 space-y-4">

        {/* 선택된 자산 */}
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2">
            대상 자산 ({selectedAssets.length}건)
          </p>
          {selectedAssets.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {selectedAssets.map((a) => (
                <span key={a.id} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg font-medium">
                  {a.code} · {a.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              자산을 선택하지 않은 단독 기안입니다. 사유란에 상세 내용을 작성해주세요.
            </p>
          )}
        </div>

        {/* 제목 */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">결재 제목 <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: IT장비 구매 결재의 건"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        {/* 유형 / 결재자 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">결재 유형 <span className="text-red-500">*</span></label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300 bg-white"
            >
              {APPROVAL_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">결재자</label>
            <select
              value={approverId}
              onChange={(e) => setApproverId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300 bg-white"
            >
              <option value="">결재자 선택 (선택사항)</option>
              {approverOptions.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.department})</option>
              ))}
            </select>
          </div>
        </div>

        {/* 사유 + AI 자동완성 */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-500">결재 사유</label>
            <button
              onClick={handleAiDraft}
              disabled={aiLoading}
              className="flex items-center px-3 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 disabled:opacity-50 transition-colors"
            >
              {aiLoading
                ? <><RefreshCcw className="w-3.5 h-3.5 mr-1.5 animate-spin" />AI 작성 중...</>
                : <><Sparkles className="w-3.5 h-3.5 mr-1.5" />AI 자동완성</>
              }
            </button>
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="간단한 키워드나 내용을 입력하면 AI가 격식있는 사유서를 작성해드립니다."
            rows={5}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300 resize-none"
          />
          {aiError && (
            <p className="text-xs text-red-600 mt-1">{aiError}</p>
          )}
        </div>

        {submitError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{submitError}</p>
        )}
      </div>
    </Modal>
  )
}
