'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FileSignature, Sparkles, RefreshCcw, CheckCircle } from 'lucide-react'
import { useUser, MOCK_USERS } from '@/context/user-context'
import { Modal } from '@/components/ui'
import type { ApiAsset } from '@/types'

// ─── Zod 스키마 ───────────────────────────────────────────────────────────────
const schema = z.object({
  title:      z.string().min(1, '결재 제목을 입력해주세요.'),
  type:       z.string().min(1),
  approverId: z.string().optional(),
  reason:     z.string().optional(),
})

type FormValues = z.infer<typeof schema>

// ─── 상수 ─────────────────────────────────────────────────────────────────────
const APPROVAL_TYPE_OPTIONS = [
  { value: 'PURCHASE',            label: '구매' },
  { value: 'DISPOSAL',            label: '폐기' },
  { value: 'TRANSFER',            label: '이관' },
  { value: 'MAINTENANCE_REQUEST', label: '유지보수' },
  { value: 'RENTAL',              label: '대여' },
]

const INPUT_CLS = 'w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300 transition-colors dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600'

interface Props {
  selectedAssets: ApiAsset[]
  onClose:        () => void
  onSuccess:      () => void
}

export default function ApprovalDraftModal({ selectedAssets, onClose, onSuccess }: Props) {
  const { currentUser } = useUser()
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError,   setAiError]   = useState('')

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title:      '',
      type:       'PURCHASE',
      approverId: '',
      reason:     '',
    },
  })

  const watchedType   = watch('type')
  const watchedReason = watch('reason')

  const approverOptions = MOCK_USERS.filter((u) => u.id !== currentUser.id)

  // ── AI 자동완성 ──────────────────────────────────────────────────────────────
  const handleAiDraft = async () => {
    const currentReason = watchedReason ?? ''
    if (!currentReason.trim()) {
      setAiError('사유 초안을 먼저 입력해주세요.')
      return
    }
    setAiLoading(true)
    setAiError('')
    try {
      const targetAssets = selectedAssets.map((a) => a.name).join(', ')
      const typLabel     = APPROVAL_TYPE_OPTIONS.find((o) => o.value === watchedType)?.label ?? watchedType
      const res = await fetch('/api/ai/draft', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalType: typLabel, targetAssets, draftReason: currentReason }),
      })
      const data = await res.json()
      if (!res.ok) { setAiError(data.error ?? 'AI 생성 실패'); return }
      setValue('reason', data.text ?? currentReason)
    } catch {
      setAiError('AI 서비스에 연결할 수 없습니다.')
    } finally {
      setAiLoading(false)
    }
  }

  // ── 폼 제출 ──────────────────────────────────────────────────────────────────
  const onSubmit = async (data: FormValues) => {
    const res = await fetch('/api/approvals', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:       data.title,
        type:        data.type,
        applicantId: currentUser.id,
        assetIds:    selectedAssets.map((a) => a.id),
        ...(data.reason     && { reason:     data.reason }),
        ...(data.approverId && { approverId: data.approverId }),
      }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? '기안 실패')
    onSuccess()
    onClose()
  }

  return (
    <Modal
      title={<><FileSignature className="w-5 h-5 mr-2 text-blue-600" />결재 기안</>}
      onClose={onClose}
      size="xl"
      footer={
        <div className="p-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
          >
            {isSubmitting
              ? <><RefreshCcw className="w-4 h-4 mr-2 animate-spin" />기안 중...</>
              : <><CheckCircle className="w-4 h-4 mr-2" />기안 제출</>
            }
          </button>
        </div>
      }
    >
      <form className="p-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>

        {/* 대상 자산 */}
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
            대상 자산 ({selectedAssets.length}건)
          </p>
          {selectedAssets.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {selectedAssets.map((a) => (
                <span key={a.id} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg font-medium dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700">
                  {a.code} · {a.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700">
              자산을 선택하지 않은 단독 기안입니다. 사유란에 상세 내용을 작성해주세요.
            </p>
          )}
        </div>

        {/* 결재 제목 */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
            결재 제목 <span className="text-red-500">*</span>
          </label>
          <input
            {...register('title')}
            type="text"
            placeholder="예: IT장비 구매 결재의 건"
            className={`${INPUT_CLS} ${errors.title ? 'border-red-400' : 'border-slate-300'}`}
          />
          {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>}
        </div>

        {/* 결재 유형 / 결재자 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              결재 유형 <span className="text-red-500">*</span>
            </label>
            <select
              {...register('type')}
              className={`${INPUT_CLS} border-slate-300 bg-white dark:bg-slate-700`}
            >
              {APPROVAL_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              결재자
            </label>
            <select
              {...register('approverId')}
              className={`${INPUT_CLS} border-slate-300 bg-white dark:bg-slate-700`}
            >
              <option value="">결재자 선택 (선택사항)</option>
              {approverOptions.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.department})</option>
              ))}
            </select>
          </div>
        </div>

        {/* 결재 사유 + AI 자동완성 */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">결재 사유</label>
            <button
              type="button"
              onClick={handleAiDraft}
              disabled={aiLoading}
              className="flex items-center px-3 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 disabled:opacity-50 transition-colors dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-700"
            >
              {aiLoading
                ? <><RefreshCcw className="w-3.5 h-3.5 mr-1.5 animate-spin" />AI 작성 중...</>
                : <><Sparkles className="w-3.5 h-3.5 mr-1.5" />AI 자동완성</>
              }
            </button>
          </div>
          <textarea
            {...register('reason')}
            placeholder="간단한 키워드나 내용을 입력하면 AI가 격식있는 사유서를 작성해드립니다."
            rows={5}
            className={`${INPUT_CLS} border-slate-300 resize-none`}
          />
          {aiError && <p className="mt-1 text-xs text-red-500">{aiError}</p>}
        </div>

      </form>
    </Modal>
  )
}
