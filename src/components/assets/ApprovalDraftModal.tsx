'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FileSignature, Sparkles, RefreshCcw, CheckCircle, Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { useUser } from '@/context/user-context'
import { Modal } from '@/components/ui'
import type { ApiAsset } from '@/types'

interface UserOption {
  id:         string
  name:       string
  department: string
}

// ─── Zod 스키마 ───────────────────────────────────────────────────────────────
const schema = z.object({
  title:              z.string().min(1, '결재 제목을 입력해주세요.'),
  type:               z.string().min(1),
  reason:             z.string().optional(),
  targetDepartment:   z.string().optional(),
  targetLocation:     z.string().optional(),
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

interface PendingFile {
  file:     File
  id:       string   // 임시 고유키
  uploading: boolean
  error?:   string
}

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])
const MAX_FILES     = 5
const MAX_FILE_SIZE = 10 * 1024 * 1024

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function FileIcon({ mimeType }: { mimeType: string }) {
  return mimeType.startsWith('image/')
    ? <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />
    : <FileText className="w-4 h-4 text-slate-500 shrink-0" />
}

export default function ApprovalDraftModal({ selectedAssets, onClose, onSuccess }: Props) {
  const { currentUser } = useUser()
  const [aiLoading,    setAiLoading]    = useState(false)
  const [aiError,      setAiError]      = useState('')
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  // 다단계 결재선: 최대 3명 (빈 문자열 = 미선택)
  const [approverIds, setApproverIds] = useState<[string, string, string]>(['', '', ''])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title:            '',
      type:             'PURCHASE',
      reason:           '',
      targetDepartment: '',
      targetLocation:   '',
    },
  })

  const setApproverAt = (index: number, value: string) => {
    setApproverIds((prev) => {
      const next = [...prev] as [string, string, string]
      next[index] = value
      // 중간 슬롯이 비면 뒤 슬롯도 초기화
      for (let i = index + 1; i < 3; i++) {
        if (!next[i - 1]) next[i] = ''
      }
      return next
    })
  }

  const watchedType   = watch('type')
  const watchedReason = watch('reason')

  // /api/users로부터 결재자 목록 동적 로드 (자기 자신 제외)
  const [approverOptions, setApproverOptions] = useState<UserOption[]>([])
  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.ok ? r.json() : [])
      .then((data: UserOption[]) => {
        const list = Array.isArray(data) ? data : []
        setApproverOptions(list.filter((u) => u.id !== currentUser.id))
      })
      .catch(() => setApproverOptions([]))
  }, [currentUser.id])

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

  // ── 파일 선택 처리 ──────────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    e.target.value = ''

    const total = pendingFiles.length + selected.length
    if (total > MAX_FILES) {
      toast.error(`첨부파일은 최대 ${MAX_FILES}개까지 추가할 수 있습니다.`)
      return
    }

    const newFiles: PendingFile[] = []
    for (const file of selected) {
      if (!ALLOWED_MIME.has(file.type)) {
        toast.error(`${file.name}: 지원하지 않는 파일 형식입니다.`)
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: 파일 크기는 10MB 이하여야 합니다.`)
        continue
      }
      newFiles.push({ file, id: `${Date.now()}-${Math.random()}`, uploading: false })
    }
    setPendingFiles((prev) => [...prev, ...newFiles])
  }

  const removeFile = (id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id))
  }

  // ── 단일 파일 업로드 ─────────────────────────────────────────────────────────
  const uploadFile = async (approvalId: string, pf: PendingFile): Promise<boolean> => {
    // 1. presigned URL 요청
    const presignRes = await fetch(`/api/approvals/${approvalId}/files/presign`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: pf.file.name, mimeType: pf.file.type, size: pf.file.size }),
    })
    const presignData = await presignRes.json()
    if (!presignRes.ok) {
      toast.error(`${pf.file.name} 업로드 실패: ${presignData.error ?? ''}`)
      return false
    }
    const { signedUrl, path } = presignData

    // 2. Supabase Storage에 직접 PUT
    const putRes = await fetch(signedUrl, {
      method:  'PUT',
      headers: { 'Content-Type': pf.file.type, 'x-upsert': 'true' },
      body:    pf.file,
    })
    if (!putRes.ok) {
      toast.error(`${pf.file.name} 스토리지 업로드 실패`)
      return false
    }

    // 3. 메타데이터 저장
    const confirmRes = await fetch(`/api/approvals/${approvalId}/files`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: pf.file.name, storagePath: path, mimeType: pf.file.type, size: pf.file.size }),
    })
    if (!confirmRes.ok) {
      const d = await confirmRes.json()
      toast.error(`${pf.file.name} 등록 실패: ${d.error ?? ''}`)
      return false
    }
    return true
  }

  // ── 폼 제출 ──────────────────────────────────────────────────────────────────
  const onSubmit = async (data: FormValues) => {
    try {
      // TRANSFER 유형: 이관 목적지 정보를 reason 앞에 메타블록으로 주입
      let reasonPayload = data.reason ?? ''
      if (data.type === 'TRANSFER' && (data.targetDepartment || data.targetLocation)) {
        const meta = JSON.stringify({ dept: data.targetDepartment ?? '', loc: data.targetLocation ?? '' })
        reasonPayload = `__TRANSFER_META__${meta}__END__\n${reasonPayload}`
      }

      const filledApproverIds = approverIds.filter(Boolean)

      const res = await fetch('/api/approvals', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:       data.title,
          type:        data.type,
          applicantId: currentUser.id,
          assetIds:    selectedAssets.map((a) => a.id),
          ...(reasonPayload           && { reason:      reasonPayload }),
          ...(filledApproverIds.length > 0 && { approverIds: filledApproverIds }),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? '기안에 실패했습니다.')
        return
      }

      const approvalId: string = json.data?.id ?? json.id
      // 첨부파일 업로드 (순차 처리)
      if (pendingFiles.length > 0 && approvalId) {
        setPendingFiles((prev) => prev.map((f) => ({ ...f, uploading: true })))
        let failCount = 0
        for (const pf of pendingFiles) {
          const ok = await uploadFile(approvalId, pf)
          if (!ok) failCount++
        }
        if (failCount > 0) {
          toast.error(`${failCount}개 파일 업로드에 실패했습니다. 결재 상세에서 다시 시도해주세요.`)
        }
      }

      toast.success('결재가 기안되었습니다.')
      onSuccess()
      onClose()
    } catch {
      toast.error('서버 오류가 발생했습니다.')
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

        {/* 결재 유형 */}
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

        {/* 다단계 결재선 (최대 3명) */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            결재선 <span className="font-normal text-slate-400">(최대 3단계, 순서대로 결재)</span>
          </p>
          {([0, 1, 2] as const).map((idx) => {
            const isDisabled = idx > 0 && !approverIds[idx - 1]
            // 이미 앞 슬롯에서 선택된 ID는 제외
            const usedIds = new Set(approverIds.slice(0, idx).filter(Boolean))
            return (
              <div key={idx} className="flex items-center gap-2">
                <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold dark:bg-blue-900/40 dark:text-blue-300">
                  {idx + 1}
                </span>
                <select
                  value={approverIds[idx]}
                  onChange={(e) => setApproverAt(idx, e.target.value)}
                  disabled={isDisabled}
                  className={`${INPUT_CLS} border-slate-300 bg-white dark:bg-slate-700 ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <option value="">{idx === 0 ? '1순위 결재자 선택 (선택사항)' : `${idx + 1}순위 결재자 추가`}</option>
                  {approverOptions
                    .filter((u) => !usedIds.has(u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.department})</option>
                    ))
                  }
                </select>
              </div>
            )
          })}
        </div>

        {/* TRANSFER 전용: 이관 목적지 */}
        {watchedType === 'TRANSFER' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3 dark:bg-amber-900/20 dark:border-amber-700">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">이관 목적지 정보</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                  이관 대상 부서 <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('targetDepartment')}
                  type="text"
                  placeholder="예: 본사 영업팀"
                  className={INPUT_CLS + ' border-slate-300'}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                  이관 위치 <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('targetLocation')}
                  type="text"
                  placeholder="예: 서울 본사 3층"
                  className={INPUT_CLS + ' border-slate-300'}
                />
              </div>
            </div>
          </div>
        )}

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

        {/* 첨부파일 */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              첨부파일 <span className="text-slate-400 font-normal">({pendingFiles.length}/{MAX_FILES})</span>
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={pendingFiles.length >= MAX_FILES}
              className="flex items-center px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 transition-colors dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600"
            >
              <Paperclip className="w-3.5 h-3.5 mr-1.5" />
              파일 추가
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {pendingFiles.length === 0 ? (
            <p className="text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-lg px-3 py-3 text-center dark:bg-slate-800 dark:border-slate-700">
              이미지, PDF, Word, Excel (최대 {MAX_FILES}개 / 파일당 10MB)
            </p>
          ) : (
            <ul className="space-y-1.5">
              {pendingFiles.map((pf) => (
                <li key={pf.id} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2">
                  <FileIcon mimeType={pf.file.type} />
                  <span className="flex-1 text-xs text-slate-700 dark:text-slate-300 truncate">{pf.file.name}</span>
                  <span className="text-[10px] text-slate-400 shrink-0">{formatBytes(pf.file.size)}</span>
                  {!pf.uploading && (
                    <button type="button" onClick={() => removeFile(pf.id)} className="ml-1 text-slate-400 hover:text-red-500 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {pf.uploading && <RefreshCcw className="w-3.5 h-3.5 animate-spin text-blue-500 shrink-0" />}
                </li>
              ))}
            </ul>
          )}
        </div>

      </form>
    </Modal>
  )
}
