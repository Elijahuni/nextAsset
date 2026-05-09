'use client'

import { Printer, X, FileText } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { ASSET_CATEGORY_LABEL, ASSET_STATUS_LABEL, formatCurrency, getWarrantyStatus } from '@/lib/utils'
import { calculateDepreciation } from '@/lib/depreciation'

interface MaintenanceLog {
  id:     string
  date:   string
  vendor: string
  cost:   string | number
  detail: string
}

interface AssetForReport {
  id:           string
  code:         string
  name:         string
  category:     string
  department:   string
  location:     string
  status:       string
  price:        string | number
  acquiredDate: string | null
  warrantyDate: string | null
  barcode:      string | null
  remarks:      string | null
  subCategory?: string | null
  description?: string | null
  size?:        string | null
  color?:       string | null
  assignedTo?:  string | null
  maintenanceLogs: MaintenanceLog[]
}

interface Props {
  asset:   AssetForReport
  onClose: () => void
}

export default function AssetReportCard({ asset, onClose }: Props) {
  const qrValue = typeof window !== 'undefined'
    ? `${window.location.origin}/assets?code=${encodeURIComponent(asset.code)}`
    : asset.code

  const price = Number(asset.price)
  const { accumulated, bookValue, monthsElapsed, totalMonths } = calculateDepreciation(
    asset.acquiredDate ?? '', price, asset.category
  )
  const deprRate = price > 0 ? Math.round((accumulated / price) * 100) : 0
  const ws = getWarrantyStatus(asset.warrantyDate)
  const today = new Date().toLocaleDateString('ko-KR')

  const totalMaintCost = asset.maintenanceLogs.reduce((s, l) => s + Number(l.cost), 0)

  return (
    <>
      {/* 인쇄 전용 스타일 */}
      <style>{`
        @media print {
          body > *:not(#report-card-root) { display: none !important; }
          #report-card-root { display: block !important; position: static !important; padding: 15mm !important; }
          .no-print { display: none !important; }
          @page { margin: 10mm; size: A4; }
        }
      `}</style>

      {/* 화면 오버레이 */}
      <div className="no-print fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl my-8">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">자산 관리카드</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
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
          <div className="p-6 overflow-y-auto max-h-[80vh]">
            <ReportCardContent
              asset={asset}
              qrValue={qrValue}
              price={price}
              accumulated={accumulated}
              bookValue={bookValue}
              monthsElapsed={monthsElapsed}
              totalMonths={totalMonths}
              deprRate={deprRate}
              ws={ws}
              today={today}
              totalMaintCost={totalMaintCost}
            />
          </div>
        </div>
      </div>

      {/* 인쇄 전용 DOM */}
      <div id="report-card-root" style={{ display: 'none' }}>
        <ReportCardContent
          asset={asset}
          qrValue={qrValue}
          price={price}
          accumulated={accumulated}
          bookValue={bookValue}
          monthsElapsed={monthsElapsed}
          totalMonths={totalMonths}
          deprRate={deprRate}
          ws={ws}
          today={today}
          totalMaintCost={totalMaintCost}
        />
      </div>
    </>
  )
}

function ReportCardContent({
  asset, qrValue, price, accumulated, bookValue,
  monthsElapsed, totalMonths, deprRate, ws, today, totalMaintCost,
}: {
  asset:           AssetForReport
  qrValue:         string
  price:           number
  accumulated:     number
  bookValue:       number
  monthsElapsed:   number
  totalMonths:     number
  deprRate:        number
  ws:              { text: string; color: string }
  today:           string
  totalMaintCost:  number
}) {
  return (
    <div className="bg-white text-slate-900 font-sans" style={{ fontFamily: 'sans-serif' }}>

      {/* 헤더 */}
      <div className="flex items-start justify-between mb-5 pb-4 border-b-2 border-blue-800">
        <div>
          <p className="text-[10px] font-bold text-blue-800 tracking-widest uppercase mb-1">자산 관리카드 · Asset Management Card</p>
          <h1 className="text-xl font-extrabold text-slate-900 leading-tight">{asset.name}</h1>
          <p className="font-mono text-sm text-blue-700 font-bold mt-0.5">{asset.code}</p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="border border-slate-200 p-1 rounded bg-white">
            <QRCodeSVG value={qrValue} size={72} level="M" includeMargin={false} />
          </div>
          <p className="text-[8px] text-slate-400 text-center">QR 스캔 → 자산 조회</p>
        </div>
      </div>

      {/* 기본정보 그리드 */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
        {[
          { label: '분류',       value: ASSET_CATEGORY_LABEL[asset.category] ?? asset.category },
          { label: '중분류',     value: asset.subCategory ?? '-' },
          { label: '상태',       value: ASSET_STATUS_LABEL[asset.status] ?? asset.status },
          { label: '사업장',     value: asset.department },
          { label: '위치',       value: asset.location },
          { label: '시리얼번호', value: asset.barcode ?? '-' },
          { label: '취득일',     value: asset.acquiredDate?.split('T')[0] ?? '-' },
          { label: '보증기간',   value: ws.text },
          { label: '사이즈',     value: asset.size ?? '-' },
          { label: '색상',       value: asset.color ?? '-' },
          { label: '담당자',     value: asset.assignedTo ?? '-' },
          { label: '세부정보',   value: asset.description ?? '-' },
          { label: '조회일자',   value: today },
        ].map(({ label, value }) => (
          <div key={label} className="border border-slate-200 rounded-lg p-2">
            <p className="text-[9px] text-slate-400 font-semibold uppercase mb-0.5">{label}</p>
            <p className="font-semibold text-slate-800 truncate">{value}</p>
          </div>
        ))}
      </div>

      {/* 취득가액 & 감가상각 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
        <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-3">취득가액 및 감가상각 현황</p>
        <div className="grid grid-cols-4 gap-3 text-xs">
          {[
            { label: '취득가액',   value: formatCurrency(price),       sub: '원' },
            { label: '감가상각액', value: formatCurrency(accumulated),  sub: `${deprRate}% 상각` },
            { label: '장부가액',   value: formatCurrency(bookValue),    sub: '현재 가치' },
            { label: '경과/내용',  value: `${monthsElapsed}개월`,       sub: `/ ${totalMonths}개월` },
          ].map(({ label, value, sub }) => (
            <div key={label} className="text-center">
              <p className="text-[9px] text-blue-500 font-semibold mb-1">{label}</p>
              <p className="font-extrabold text-blue-900 text-sm leading-tight">{value}</p>
              <p className="text-[9px] text-slate-500 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
        {/* 상각 진행 바 */}
        <div className="mt-3">
          <div className="flex justify-between text-[9px] text-slate-400 mb-1">
            <span>상각 진행률</span><span>{deprRate}%</span>
          </div>
          <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
            <div className="h-2 bg-blue-600 rounded-full" style={{ width: `${Math.min(100, deprRate)}%` }} />
          </div>
        </div>
      </div>

      {/* 유지보수 이력 */}
      {asset.maintenanceLogs.length > 0 && (
        <div className="border border-slate-200 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">유지보수 이력</p>
            <span className="text-xs font-bold text-slate-700">총 {formatCurrency(totalMaintCost)}</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-1.5 text-[9px] text-slate-400 font-semibold">날짜</th>
                <th className="text-left py-1.5 text-[9px] text-slate-400 font-semibold">업체</th>
                <th className="text-left py-1.5 text-[9px] text-slate-400 font-semibold">내용</th>
                <th className="text-right py-1.5 text-[9px] text-slate-400 font-semibold">비용</th>
              </tr>
            </thead>
            <tbody>
              {asset.maintenanceLogs.map((log) => (
                <tr key={log.id} className="border-b border-slate-50">
                  <td className="py-1.5 text-slate-600 font-mono">{log.date?.split('T')[0]}</td>
                  <td className="py-1.5 text-slate-600">{log.vendor}</td>
                  <td className="py-1.5 text-slate-700 font-medium">{log.detail}</td>
                  <td className="py-1.5 text-right text-slate-700 font-semibold">{formatCurrency(Number(log.cost))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 비고 */}
      {asset.remarks && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4">
          <p className="text-[9px] font-bold text-amber-600 uppercase tracking-wider mb-1">비고</p>
          <p className="text-xs text-slate-700">{asset.remarks}</p>
        </div>
      )}

      {/* 서명란 */}
      <div className="mt-6 pt-4 border-t border-slate-200">
        <div className="grid grid-cols-3 gap-4 text-center text-xs">
          {['담당자', '부서장', '확인자'].map((role) => (
            <div key={role} className="border border-slate-200 rounded-lg p-3">
              <p className="text-[9px] text-slate-400 font-semibold mb-6">{role}</p>
              <div className="border-b border-slate-300 mt-2" />
              <p className="text-[9px] text-slate-400 mt-1">(서명)</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] text-slate-300 text-center mt-3">TW_AMS 자산관리시스템 · {today} 출력</p>
      </div>
    </div>
  )
}
