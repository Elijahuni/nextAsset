'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, ExternalLink, FileText, Paperclip, RefreshCcw, Trash2, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { useUser } from '@/context/user-context'

interface AssetFile {
  id:          string
  name:        string
  storagePath: string
  mimeType:    string
  size:        number
  createdAt:   string
  url:         string
}

const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_FILES     = 10
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
const ACCEPT        = 'image/jpeg,image/png,image/webp,image/gif,application/pdf'

function formatBytes(bytes: number) {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function AssetFilesTab({ assetId }: { assetId: string }) {
  const { canManageAssets } = useUser()
  const [files,     setFiles]     = useState<AssetFile[]>([])
  const [loading,   setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchFiles = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/assets/${assetId}/files`)
      const data = await res.json()
      setFiles(Array.isArray(data) ? data : [])
    } catch {
      toast.error('파일 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchFiles() }, [assetId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('JPG, PNG, WEBP, GIF, PDF만 업로드할 수 있습니다.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('파일 크기는 5MB 이하여야 합니다.')
      return
    }
    if (files.length >= MAX_FILES) {
      toast.error(`파일은 최대 ${MAX_FILES}개까지 등록할 수 있습니다.`)
      return
    }

    setUploading(true)
    try {
      // 1. Presigned URL 발급
      const presignRes = await fetch(`/api/assets/${assetId}/files/presign`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ filename: file.name, mimeType: file.type, size: file.size }),
      })
      const presign = await presignRes.json()
      if (!presignRes.ok) { toast.error(presign.error ?? '업로드 준비 실패'); return }

      // 2. Supabase Storage에 직접 업로드 (Vercel 라우트 우회 → 4.5MB 제한 없음)
      const supabase = createSupabaseBrowserClient()
      const { error: uploadErr } = await supabase.storage
        .from('asset-files')
        .uploadToSignedUrl(presign.path, presign.token, file, { contentType: file.type })
      if (uploadErr) { toast.error('파일 업로드 실패: ' + uploadErr.message); return }

      // 3. 메타데이터 저장
      const confirmRes = await fetch(`/api/assets/${assetId}/files`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: file.name, storagePath: presign.path, mimeType: file.type, size: file.size }),
      })
      const confirm = await confirmRes.json()
      if (!confirmRes.ok) { toast.error(confirm.error ?? '파일 정보 저장 실패'); return }

      toast.success('파일이 업로드됐습니다.')
      setFiles((prev) => [confirm, ...prev])
    } catch {
      toast.error('업로드 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (file: AssetFile) => {
    if (!confirm(`"${file.name}"을 삭제하시겠습니까?`)) return
    try {
      const res = await fetch(`/api/assets/${assetId}/files?fileId=${file.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? '삭제 실패'); return }
      toast.success('파일이 삭제됐습니다.')
      setFiles((prev) => prev.filter((f) => f.id !== file.id))
    } catch {
      toast.error('서버 오류가 발생했습니다.')
    }
  }

  return (
    <div className="space-y-4">

      {/* 헤더 */}
      <div className="flex flex-col gap-1.5">
        {canManageAssets && (
          <>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading || files.length >= MAX_FILES}
              className="w-full flex items-center justify-center px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700 dark:hover:bg-blue-900/30"
            >
              {uploading
                ? <><RefreshCcw className="w-3.5 h-3.5 mr-1.5 animate-spin" />업로드 중...</>
                : <><Upload className="w-3.5 h-3.5 mr-1.5" />파일 추가</>
              }
            </button>
            <input ref={inputRef} type="file" accept={ACCEPT} onChange={handleSelect} className="hidden" />
          </>
        )}
        <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
          {files.length}/{MAX_FILES}개 · 최대 5MB
        </p>
      </div>

      {/* 파일 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCcw className="w-4 h-4 animate-spin text-blue-500 mr-2" />
          <span className="text-sm text-slate-400">불러오는 중...</span>
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
          <Paperclip className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-sm">등록된 파일이 없습니다.</p>
          {canManageAssets && <p className="text-xs mt-1">위 버튼으로 파일을 추가하세요.</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {files.map((file) => {
            const isImg = file.mimeType.startsWith('image/')
            return (
              <div
                key={file.id}
                className="group relative bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden"
              >
                {/* 썸네일 / PDF 아이콘 */}
                {isImg ? (
                  <div className="h-24 bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={file.url}
                      alt={file.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                    />
                  </div>
                ) : (
                  <div className="h-16 bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                    <FileText className="w-8 h-8 text-red-400" />
                  </div>
                )}

                {/* 파일 정보 */}
                <div className="p-3">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {formatBytes(file.size)} · {file.createdAt.split('T')[0]}
                  </p>
                </div>

                {/* hover 액션 버튼 */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={file.url}
                    download={file.name}
                    className="p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    title="다운로드"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                  </a>
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    title="새 탭에서 열기"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                  </a>
                  {canManageAssets && (
                    <button
                      onClick={() => handleDelete(file)}
                      className="p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow border border-red-200 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
