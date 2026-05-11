'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Paperclip, RefreshCcw, Trash2, Upload, X, ZoomIn } from 'lucide-react'
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
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const imageFiles = files.filter((f) => f.mimeType.startsWith('image/'))

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

  // 라이트박스 키보드 핸들러
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (lightboxIdx === null) return
    if (e.key === 'Escape') { setLightboxIdx(null); return }
    if (e.key === 'ArrowLeft')  setLightboxIdx((i) => i !== null && i > 0 ? i - 1 : i)
    if (e.key === 'ArrowRight') setLightboxIdx((i) => i !== null && i < imageFiles.length - 1 ? i + 1 : i)
  }, [lightboxIdx, imageFiles.length])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // 라이트박스 열 때 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = lightboxIdx !== null ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [lightboxIdx])

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
      const presignRes = await fetch(`/api/assets/${assetId}/files/presign`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ filename: file.name, mimeType: file.type, size: file.size }),
      })
      const presign = await presignRes.json()
      if (!presignRes.ok) { toast.error(presign.error ?? '업로드 준비 실패'); return }

      const supabase = createSupabaseBrowserClient()
      const { error: uploadErr } = await supabase.storage
        .from('asset-files')
        .uploadToSignedUrl(presign.path, presign.token, file, { contentType: file.type })
      if (uploadErr) { toast.error('파일 업로드 실패: ' + uploadErr.message); return }

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
      // 라이트박스가 열려있으면 닫기
      if (lightboxIdx !== null) setLightboxIdx(null)
    } catch {
      toast.error('서버 오류가 발생했습니다.')
    }
  }

  const openLightbox = (file: AssetFile) => {
    const idx = imageFiles.findIndex((f) => f.id === file.id)
    if (idx !== -1) setLightboxIdx(idx)
  }

  const docFiles = files.filter((f) => !f.mimeType.startsWith('image/'))

  return (
    <div className="space-y-4">

      {/* 업로드 버튼 */}
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
        <div className="space-y-4">

          {/* 이미지 갤러리 그리드 */}
          {imageFiles.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">이미지</p>
              <div className="grid grid-cols-2 gap-2">
                {imageFiles.map((file) => (
                  <div
                    key={file.id}
                    className="group relative bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden cursor-pointer border border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                    onClick={() => openLightbox(file)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={file.url}
                      alt={file.name}
                      className="w-full h-28 object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                    />
                    {/* 확대 오버레이 */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                    </div>
                    {/* 파일명 */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-[10px] text-white truncate">{file.name}</p>
                    </div>
                    {/* 삭제 버튼 */}
                    {canManageAssets && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(file) }}
                        className="absolute top-1.5 right-1.5 p-1 bg-white/90 dark:bg-slate-800/90 rounded-lg shadow opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 border border-red-200"
                        title="삭제"
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 문서 파일 리스트 */}
          {docFiles.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">문서</p>
              <div className="flex flex-col gap-2">
                {docFiles.map((file) => (
                  <div
                    key={file.id}
                    className="group relative bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden"
                  >
                    <div className="flex items-center gap-3 p-3">
                      <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-red-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{file.name}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                          {formatBytes(file.size)} · {file.createdAt.split('T')[0]}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <a href={file.url} download={file.name}
                          className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-100 transition-colors" title="다운로드">
                          <Download className="w-3.5 h-3.5 text-slate-500" />
                        </a>
                        <a href={file.url} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-100 transition-colors" title="새 탭에서 열기">
                          <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                        </a>
                        {canManageAssets && (
                          <button onClick={() => handleDelete(file)}
                            className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-red-200 hover:bg-red-50 transition-colors" title="삭제">
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 이미지 라이트박스 */}
      {lightboxIdx !== null && imageFiles[lightboxIdx] && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setLightboxIdx(null)}
        >
          {/* 닫기 */}
          <button
            onClick={() => setLightboxIdx(null)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* 카운터 */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm font-medium">
            {lightboxIdx + 1} / {imageFiles.length}
          </div>

          {/* 이전 */}
          {lightboxIdx > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => (i ?? 1) - 1) }}
              className="absolute left-4 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* 다음 */}
          {lightboxIdx < imageFiles.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => (i ?? 0) + 1) }}
              className="absolute right-4 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* 이미지 */}
          <div className="max-w-4xl max-h-[80vh] px-16" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageFiles[lightboxIdx].url}
              alt={imageFiles[lightboxIdx].name}
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
            />
            <div className="flex items-center justify-between mt-3 px-1">
              <p className="text-white/70 text-sm truncate">{imageFiles[lightboxIdx].name}</p>
              <div className="flex gap-2 shrink-0 ml-3">
                <a
                  href={imageFiles[lightboxIdx].url}
                  download={imageFiles[lightboxIdx].name}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />다운로드
                </a>
                <a
                  href={imageFiles[lightboxIdx].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />새 탭
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
