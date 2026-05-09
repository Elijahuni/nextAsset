'use client'

import { useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Printer, X, QrCode } from 'lucide-react'
import { ASSET_CATEGORY_LABEL } from '@/lib/utils'
import type { ApiAsset } from '@/types'

interface Props {
  assets:  ApiAsset[]
  onClose: () => void
}

// 태그 1장 크기: 85.6mm × 54mm (신용카드 규격 — 라벨 프린터 호환)
// A4 인쇄 시 2열 × n행으로 자동 배치

export default function QrTagModal({ assets, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => window.print()

  return (
    <>
      {/* ── 인쇄 전용 스타일 ────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          body > *:not(#qr-print-root) { display: none !important; }
          #qr-print-root { display: block !important; position: static !important; }
          .qr-tag-grid {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 4mm !important;
            padding: 10mm !important;
            background: white !important;
          }
          .qr-tag-card {
            break-inside: avoid;
            border: 1px solid #ccc !important;
            border-radius: 4px !important;
            width: 85.6mm !important;
            height: 54mm !important;
            display: flex !important;
            align-items: center !important;
            gap: 6mm !important;
            padding: 5mm !important;
            background: white !important;
            box-sizing: border-box !important;
          }
          .qr-tag-header-bar {
            display: block !important;
            background: #1e40af !important;
            color: white !important;
            font-size: 7pt !important;
            font-weight: bold !important;
            letter-spacing: 0.5pt !important;
            padding: 1.5mm 3mm !important;
            margin-bottom: 2mm !important;
          }
          .no-print { display: none !important; }
          @page { margin: 5mm; size: A4; }
        }
      `}</style>

      {/* ── 모달 오버레이 (화면 전용) ──────────────────────────────────────── */}
      <div className="no-print fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl my-8">

          {/* 헤더 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                QR 태그 발행 — {assets.length}건
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Printer className="w-4 h-4 mr-1.5" /> 인쇄 / PDF 저장
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 안내 */}
          <div className="px-6 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
            태그 크기: 85.6 × 54mm (신용카드 규격) · A4 용지에 2열 배치 · PDF 저장 후 라벨 프린터 출력 권장
          </div>

          {/* 태그 미리보기 */}
          <div className="p-6 overflow-y-auto max-h-[65vh]">
            <div ref={printRef} className="grid grid-cols-2 gap-3">
              {assets.map((asset) => (
                <TagCard key={asset.id} asset={asset} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 인쇄 전용 DOM (화면에서는 숨김) ───────────────────────────────── */}
      <div id="qr-print-root" style={{ display: 'none' }}>
        <div className="qr-tag-grid">
          {assets.map((asset) => (
            <PrintTagCard key={asset.id} asset={asset} />
          ))}
        </div>
      </div>
    </>
  )
}

// ── 화면 미리보기용 태그 ─────────────────────────────────────────────────────
function TagCard({ asset }: { asset: ApiAsset }) {
  const qrValue = typeof window !== 'undefined'
    ? `${window.location.origin}/assets?code=${encodeURIComponent(asset.code)}`
    : asset.code

  return (
    <div className="border-2 border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden bg-white dark:bg-white shadow-sm">
      {/* 헤더 바 */}
      <div className="bg-blue-800 text-white text-[10px] font-bold tracking-wider px-3 py-1">
        ASSET MANAGEMENT
      </div>
      {/* 태그 본문 */}
      <div className="flex items-center gap-3 p-3">
        {/* QR 코드 */}
        <div className="shrink-0 p-1 bg-white border border-slate-200 rounded-lg">
          <QRCodeSVG
            value={qrValue}
            size={72}
            level="M"
            includeMargin={false}
          />
        </div>
        {/* 텍스트 정보 */}
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-[11px] font-bold text-slate-900 leading-tight line-clamp-2">
            {asset.name}
          </p>
          <p className="font-mono text-[10px] text-blue-700 font-bold tracking-tight">
            {asset.code}
          </p>
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
              {ASSET_CATEGORY_LABEL[asset.category] ?? asset.category}
            </span>
          </div>
          <p className="text-[9px] text-slate-500 leading-tight">
            {asset.department}
            {asset.location ? ` · ${asset.location}` : ''}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── 인쇄 전용 태그 (인라인 스타일만 사용) ───────────────────────────────────
function PrintTagCard({ asset }: { asset: ApiAsset }) {
  const qrValue = typeof window !== 'undefined'
    ? `${window.location.origin}/assets?code=${encodeURIComponent(asset.code)}`
    : asset.code

  return (
    <div className="qr-tag-card">
      <div style={{ flexShrink: 0 }}>
        <div className="qr-tag-header-bar">ASSET MANAGEMENT</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6mm' }}>
          <div style={{ border: '1px solid #e2e8f0', padding: '2mm', borderRadius: '3px', background: 'white', flexShrink: 0 }}>
            <QRCodeSVG value={qrValue} size={80} level="M" includeMargin={false} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '9pt', fontWeight: 'bold', color: '#0f172a', lineHeight: 1.3, marginBottom: '1mm', wordBreak: 'break-word' }}>
              {asset.name}
            </p>
            <p style={{ fontFamily: 'monospace', fontSize: '7.5pt', fontWeight: 'bold', color: '#1d4ed8', marginBottom: '1.5mm', letterSpacing: '-0.3pt' }}>
              {asset.code}
            </p>
            <p style={{ fontSize: '7pt', color: '#475569', marginBottom: '1mm' }}>
              {ASSET_CATEGORY_LABEL[asset.category] ?? asset.category}
            </p>
            <p style={{ fontSize: '7pt', color: '#64748b' }}>
              {asset.department}{asset.location ? ` · ${asset.location}` : ''}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
