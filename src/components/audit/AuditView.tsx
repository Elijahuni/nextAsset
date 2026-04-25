'use client'

import { useEffect, useState } from 'react'
import { ScanLine, Camera, RefreshCcw, CheckCircle, AlertCircle, Lock } from 'lucide-react'
import { useUser } from '@/context/user-context'

interface ApiAsset {
  id: string
  code: string
  name: string
  department: string
  location: string
}

type AuditStatus = 'ready' | 'scanning' | 'done'

export default function AuditView() {
  const { isEmployee } = useUser()
  const [assets, setAssets] = useState<ApiAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [auditStatus, setAuditStatus] = useState<AuditStatus>('ready')
  const [scannedIds, setScannedIds] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/assets')
      .then((r) => r.json())
      .then((data: ApiAsset[]) => setAssets(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (isEmployee) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Lock className="w-10 h-10 mb-3 opacity-30" />
        <p className="font-semibold">접근 권한이 없습니다.</p>
        <p className="text-sm mt-1">관리자 또는 부서장만 재물조사를 실시할 수 있습니다.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCcw className="w-5 h-5 animate-spin text-blue-500 mr-2" />
        <span className="text-slate-500">불러오는 중...</span>
      </div>
    )
  }

  const handleSimulateScan = () => {
    setAuditStatus('scanning')
    setScannedIds([])
    // 약 70% 자산을 랜덤 스캔하는 시뮬레이션
    setTimeout(() => {
      const shuffled = [...assets].sort(() => Math.random() - 0.3)
      const count = Math.ceil(assets.length * 0.7)
      setScannedIds(shuffled.slice(0, count).map((a) => a.id))
      setAuditStatus('done')
    }, 2000)
  }

  const scannedCount = scannedIds.length
  const missedCount = assets.length - scannedCount
  const rate = assets.length > 0 ? Math.round((scannedCount / assets.length) * 100) : 0

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/50">
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center mb-1">
            <ScanLine className="w-6 h-6 mr-2 text-indigo-600" /> 재물조사 (모바일 실사 연동)
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">가상 바코드 스캐너로 자산 실사를 시뮬레이션합니다.</p>
        </div>
        <div className="flex gap-2">
          {auditStatus === 'ready' && (
            <button
              onClick={handleSimulateScan}
              disabled={assets.length === 0}
              className="flex items-center px-6 py-3 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Camera className="w-5 h-5 mr-2" /> 가상 스캐너 가동
            </button>
          )}
          {auditStatus === 'done' && (
            <button
              onClick={() => { setAuditStatus('ready'); setScannedIds([]) }}
              className="flex items-center px-4 py-2 text-sm font-bold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              <RefreshCcw className="w-4 h-4 mr-2" /> 다시 시작
            </button>
          )}
        </div>
      </div>

      {/* 요약 */}
      {auditStatus === 'done' && (
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex gap-4">
          <div className="flex-1 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl p-4 text-center border border-emerald-100 dark:border-emerald-800">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mb-1">정상 확인</p>
            <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{scannedCount}건</p>
          </div>
          <div className="flex-1 bg-red-50 dark:bg-red-900/30 rounded-xl p-4 text-center border border-red-100 dark:border-red-800">
            <p className="text-xs text-red-600 dark:text-red-400 font-bold mb-1">미스캔 (누락)</p>
            <p className="text-2xl font-black text-red-600 dark:text-red-300">{missedCount}건</p>
          </div>
          <div className="flex-1 bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 text-center border border-blue-100 dark:border-blue-800">
            <p className="text-xs text-blue-600 dark:text-blue-400 font-bold mb-1">실사율</p>
            <p className="text-2xl font-black text-blue-700 dark:text-blue-300">{rate}%</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto custom-scrollbar bg-slate-50/30 dark:bg-slate-900/20 p-6">
        {auditStatus === 'ready' && (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600">
            <ScanLine className="w-20 h-20 mb-4 opacity-30" />
            <p className="font-semibold text-slate-400 dark:text-slate-500">스캐너를 가동하여 실사를 시작하세요</p>
            {assets.length === 0 && <p className="text-sm mt-2 text-slate-400 dark:text-slate-500">먼저 자산을 등록해주세요.</p>}
          </div>
        )}
        {auditStatus === 'scanning' && (
          <div className="h-full flex flex-col items-center justify-center text-indigo-500">
            <ScanLine className="w-10 h-10 animate-spin mb-4" />
            <p className="font-semibold">바코드 스캔 중...</p>
          </div>
        )}
        {auditStatus === 'done' && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300 whitespace-nowrap">
              <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-4">실사 결과</th>
                  <th className="px-6 py-4">자산코드</th>
                  <th className="px-6 py-4">자산명칭</th>
                  <th className="px-6 py-4">장부상 위치</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => {
                  const ok = scannedIds.includes(asset.id)
                  return (
                    <tr key={asset.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-6 py-4">
                        {ok ? (
                          <span className="inline-flex items-center px-2.5 py-1 text-xs font-black rounded-md border bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-700">
                            <CheckCircle className="w-3.5 h-3.5 mr-1" /> 정상 일치
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 text-xs font-black rounded-md border bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-700">
                            <AlertCircle className="w-3.5 h-3.5 mr-1" /> 미스캔 (누락)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">{asset.code}</td>
                      <td className="px-6 py-4 font-bold dark:text-slate-200">{asset.name}</td>
                      <td className="px-6 py-4">{asset.department} / {asset.location}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
