'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle, XCircle, Ban, RefreshCcw, FileText, Paperclip, Image as ImageIcon, ExternalLink, Trash2 } from 'lucide-react'
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

interface ApprovalStep {
  id:         string
  order:      number
  status:     string  // WAITING | PENDING | APPROVED | REJECTED
  actedAt:    string | null
  comment:    string | null
  approver:   { id: string; name: string; role: string }
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
  steps: ApprovalStep[]
}

interface ApprovalFile {
  id:          string
  name:        string
  storagePath: string
  mimeType:    string
  size:        number
  createdAt:   string
  url:         string
}

interface ApprovalDetailModalProps {
  approvalId: string
  onClose: () => void
  onUpdated: () => void
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

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  return mimeType.startsWith('image/')
    ? <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />
    : <FileText className="w-4 h-4 text-slate-400 shrink-0" />
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
  const [approval,      setApproval]      = useState<ApprovalDetail | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error,         setError]         = useState('')
  const [files,         setFiles]         = useState<ApprovalFile[]>([])
  const [fileUploading, setFileUploading] = useState(false)
  const [deletingFileId,setDeletingFileId]= useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/approvals/${approvalId}`).then((r) => r.json()),
      fetch(`/api/approvals/${approvalId}/files`).then((r) => r.json()),
    ])
      .then(([approvalData, filesData]: [ApprovalDetail, unknown]) => {
        setApproval(approvalData)
        setFiles(Array.isArray(filesData) ? filesData as ApprovalFile[] : [])
      })
      .catch(() => toast.error('결재 정보를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [approvalId])

  // 파일 추가
  const handleFileAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!selected.length) return

    if (files.length + selected.length > MAX_FILES) {
      toast.error(`첨부파일은 최대 ${MAX_FILES}개까지 등록할 수 있습니다.`)
      return
    }

    const file = selected[0]
    if (!ALLOWED_MIME.has(file.type)) { toast.error('지원하지 않는 파일 형식입니다.'); return }
    if (file.size > MAX_FILE_SIZE)    { toast.error('파일 크기는 10MB 이하여야 합니다.'); return }

    setFileUploading(true)
    try {
      // presign
      const presignRes = await fetch(`/api/approvals/${approvalId}/files/presign`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, mimeType: file.type, size: file.size }),
      })
      const presignData = await presignRes.json()
      if (!presignRes.ok) { toast.error(presignData.error ?? '업로드 실패'); return }

      // PUT to storage
      const putRes = await fetch(presignData.signedUrl, {
        method:  'PUT',
        headers: { 'Content-Type': file.type, 'x-upsert': 'true' },
        body:    file,
      })
      if (!putRes.ok) { toast.error('스토리지 업로드 실패'); return }

      // confirm
      const confirmRes = await fetch(`/api/approvals/${approvalId}/files`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, storagePath: presignData.path, mimeType: file.type, size: file.size }),
      })
      const confirmData = await confirmRes.json()
      if (!confirmRes.ok) { toast.error(confirmData.error ?? '파일 등록 실패'); return }

      setFiles((prev) => [...prev, confirmData.data ?? confirmData])
      toast.success('파일이 추가되었습니다.')
    } catch {
      toast.error('파일 업로드 중 오류가 발생했습니다.')
    } finally {
      setFileUploading(false)
    }
  }

  // 파일 삭제
  const handleFileDelete = async (fileId: string, fileName: string) => {
    if (!confirm(`"${fileName}" 파일을 삭제하시겠습니까?`)) return
    setDeletingFileId(fileId)
    try {
      const res = await fetch(`/api/approvals/${approvalId}/files?fileId=${fileId}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? '삭제 실패'); return }
      setFiles((prev) => prev.filter((f) => f.id !== fileId))
      toast.success('파일이 삭제되었습니다.')
    } catch {
      toast.error('파일 삭제 중 오류가 발생했습니다.')
    } finally {
      setDeletingFileId(null)
    }
  }

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
        <div className="p-6 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
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
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{approval.title}</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-mono">{approval.createdAt?.split('T')[0]}</p>
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
                ...(!approval.steps?.length
                  ? [{ label: '결재자', value: approval.approver ? approval.approver.name : '미지정' }]
                  : []
                ),
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 border border-slate-100 dark:border-slate-600">
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{label}</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {/* 다단계 결재선 */}
            {approval.steps?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">결재선</p>
                <div className="space-y-2">
                  {approval.steps.map((step, idx) => {
                    const isActive = step.status === 'PENDING'
                    const isDone   = step.status === 'APPROVED' || step.status === 'REJECTED'
                    const stepStatusColor: Record<string, string> = {
                      WAITING:  'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600',
                      PENDING:  'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700',
                      APPROVED: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700',
                      REJECTED: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',
                    }
                    const stepLabel: Record<string, string> = { WAITING: '대기', PENDING: '검토중', APPROVED: '승인', REJECTED: '반려' }
                    return (
                      <div
                        key={step.id}
                        className={`flex items-start gap-3 px-4 py-3 rounded-xl border transition-colors ${
                          isActive
                            ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700'
                            : 'bg-white dark:bg-slate-700/50 border-slate-200 dark:border-slate-600'
                        }`}
                      >
                        <span className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                          isActive ? 'bg-amber-200 text-amber-800' :
                          step.status === 'APPROVED' ? 'bg-emerald-200 text-emerald-800' :
                          step.status === 'REJECTED' ? 'bg-red-200 text-red-700' :
                          'bg-slate-200 text-slate-500'
                        }`}>
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{step.approver.name}</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${stepStatusColor[step.status] ?? stepStatusColor.WAITING}`}>
                              {stepLabel[step.status] ?? step.status}
                            </span>
                            {isDone && step.actedAt && (
                              <span className="text-[10px] text-slate-400">{step.actedAt.split('T')[0]}</span>
                            )}
                          </div>
                          {step.comment && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">{step.comment}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* TRANSFER 이관 목적지 (메타블록 파싱) */}
            {approval.type === 'TRANSFER' && (() => {
              const metaMatch = approval.reason?.match(/__TRANSFER_META__(.+?)__END__/)
              if (!metaMatch) return null
              try {
                const meta: { dept: string; loc: string } = JSON.parse(metaMatch[1])
                return (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">이관 목적지</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-amber-500 dark:text-amber-400 font-medium mb-0.5">이관 대상 부서</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{meta.dept || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-amber-500 dark:text-amber-400 font-medium mb-0.5">이관 위치</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{meta.loc || '-'}</p>
                      </div>
                    </div>
                  </div>
                )
              } catch { return null }
            })()}

            {/* 사유 (메타블록 제거 후 순수 텍스트만 표시) */}
            {approval.reason && (() => {
              const cleanReason = approval.reason.replace(/__TRANSFER_META__[\s\S]+?__END__\n?/, '').trim()
              if (!cleanReason) return null
              return (
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">결재 사유</p>
                  <div className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl p-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {cleanReason}
                  </div>
                </div>
              )
            })()}

            {/* 연결 자산 */}
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">대상 자산 ({approval.assets.length}건)</p>
              {approval.assets.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500">연결된 자산이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {approval.assets.map(({ asset }) => (
                    <div key={asset.id} className="flex items-center justify-between bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{asset.name}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-mono">{asset.code} · {ASSET_CATEGORY_LABEL[asset.category] ?? asset.category} · {asset.location}</p>
                      </div>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-600 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-500">
                        {ASSET_STATUS_LABEL[asset.status] ?? asset.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 첨부파일 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  첨부파일 ({files.length}/{MAX_FILES})
                </p>
                {isPending && (
                  <>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={fileUploading || files.length >= MAX_FILES}
                      className="flex items-center px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 transition-colors dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600"
                    >
                      {fileUploading
                        ? <><RefreshCcw className="w-3 h-3 mr-1 animate-spin" />업로드 중...</>
                        : <><Paperclip className="w-3 h-3 mr-1" />파일 추가</>
                      }
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx"
                      className="hidden"
                      onChange={handleFileAdd}
                    />
                  </>
                )}
              </div>

              {files.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500">첨부된 파일이 없습니다.</p>
              ) : (
                <ul className="space-y-1.5">
                  {files.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5">
                      <FileTypeIcon mimeType={f.mimeType} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{f.name}</p>
                        <p className="text-[10px] text-slate-400">{formatBytes(f.size)}</p>
                      </div>
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-700 transition-colors"
                        title="열기"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      {isPending && (
                        <button
                          type="button"
                          onClick={() => handleFileDelete(f.id, f.name)}
                          disabled={deletingFileId === f.id}
                          className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                          title="삭제"
                        >
                          {deletingFileId === f.id
                            ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />
                          }
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
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
