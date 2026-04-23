'use client'

import { useState } from 'react'
import { Upload, RefreshCcw, CheckCircle } from 'lucide-react'
import { Modal } from '@/components/ui'

interface BulkUploadModalProps {
  onClose: () => void
  onSuccess: (count: number) => void
}

// 원본 handleMassUpload의 파싱/미리보기 로직을 클라이언트 컴포넌트로 이식

function parseRows(text: string): string[][] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((line) => line.split(/[,\t]/).map((c) => c.trim().replace(/^"|"$/g, '')))
}

const COLUMN_LABELS = ['자산명', '품목', '취득가액', '부서', '위치']

export default function BulkUploadModal({ onClose, onSuccess }: BulkUploadModalProps) {
  const [uploadText, setUploadText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const preview = uploadText.trim() ? parseRows(uploadText) : []

  const handleSubmit = async () => {
    if (!uploadText.trim()) {
      setError('데이터를 입력해주세요.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/assets/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: uploadText }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '업로드 실패')
        return
      }
      onSuccess(data.count)
      onClose()
    } catch {
      setError('서버 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={<><Upload className="w-5 h-5 mr-2 text-emerald-600" />엑셀 일괄 업로드</>}
      onClose={onClose}
      size="2xl"
      footer={
        <div className="p-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || preview.length === 0}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
          >
            {loading
              ? <><RefreshCcw className="w-4 h-4 mr-2 animate-spin" />업로드 중...</>
              : <><CheckCircle className="w-4 h-4 mr-2" />{preview.length}건 등록</>
            }
          </button>
        </div>
      }
    >
      <div className="p-6 space-y-4">

        {/* 헤더 서브텍스트 */}
        <p className="text-xs text-slate-500">엑셀에서 셀을 복사한 후 아래에 붙여넣으세요</p>

        {/* 가이드 */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">컬럼 순서 (탭/콤마 구분)</p>
          <div className="flex space-x-2">
            {COLUMN_LABELS.map((label, i) => (
              <span key={label} className="flex items-center text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-medium text-slate-700 shadow-sm">
                <span className="text-slate-400 mr-1.5">{i + 1}.</span>
                {label}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            예시: <code className="bg-slate-200 px-1 rounded">LG 그램 15인치	노트북	1500000	IT개발팀	본사 4층</code>
          </p>
        </div>

        {/* 텍스트 입력 */}
        <textarea
          className="w-full min-h-[120px] max-h-[200px] p-3 text-sm font-mono border border-slate-300 rounded-xl resize-none outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-all"
          placeholder={`자산명\t품목\t취득가액\t부서\t위치\nLG 그램\t노트북\t1500000\tIT개발팀\t본사 4층`}
          value={uploadText}
          onChange={(e) => { setUploadText(e.target.value); setError('') }}
        />

        {/* 미리보기 */}
        {preview.length > 0 && (
          <div>
            <p className="text-xs font-bold text-slate-500 mb-2">미리보기 ({preview.length}건)</p>
            <div className="overflow-auto max-h-[140px] rounded-xl border border-slate-200 custom-scrollbar">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {COLUMN_LABELS.map((label) => (
                      <th key={label} className="px-3 py-2 font-semibold text-slate-500 whitespace-nowrap">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 10).map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      {COLUMN_LABELS.map((_, j) => (
                        <td key={j} className="px-3 py-1.5 text-slate-700 whitespace-nowrap">{row[j] ?? '-'}</td>
                      ))}
                    </tr>
                  ))}
                  {preview.length > 10 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-2 text-center text-slate-400">
                        ... 외 {preview.length - 10}건
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 에러 */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

      </div>
    </Modal>
  )
}
