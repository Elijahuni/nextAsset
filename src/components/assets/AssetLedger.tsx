'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Search, Upload, Download, FileSignature, PlusCircle,
  Printer, Filter, ChevronLeft, ChevronRight, Image as ImageIcon, QrCode,
  SlidersHorizontal, X, CheckSquare, RefreshCcw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useUser } from '@/context/user-context'
import { ASSET_STATUS_LABEL, ASSET_CATEGORY_LABEL, formatCurrency, getActiveLabel } from '@/lib/utils'
import { Skeleton, Badge, EmptyTableRow } from '@/components/ui'
import AdvancedFilterPanel, { AdvancedFilters, ADVANCED_FILTER_DEFAULTS } from './AdvancedFilterPanel'
import type { ApiAsset, PaginatedAssets } from '@/types'

// 무거운 모달은 lazy load — 초기 번들에서 제외
const BulkUploadModal    = dynamic(() => import('./BulkUploadModal'))
const AssetCreateModal   = dynamic(() => import('./AssetCreateModal'))
const AssetDetailModal   = dynamic(() => import('./AssetDetailModal'))
const ApprovalDraftModal = dynamic(() => import('./ApprovalDraftModal'))
const QrTagModal         = dynamic(() => import('./QrTagModal'))

const LIMIT = 50

const STATUS_COLOR: Record<string, string> = {
  IN_USE:            'bg-blue-100 text-blue-800 border-blue-200',
  AVAILABLE:         'bg-emerald-100 text-emerald-800 border-emerald-200',
  UNDER_MAINTENANCE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  RETIRED:           'bg-slate-100 text-slate-600 border-slate-200',
  DISPOSED:          'bg-red-100 text-red-700 border-red-200',
}

const SELECT_CLS = 'border border-slate-300 dark:border-slate-600 text-sm rounded-lg px-3 py-2 bg-white dark:bg-slate-700 outline-none focus:ring-2 focus:ring-blue-300 text-slate-700 dark:text-slate-200'

export default function AssetLedger() {
  const { currentUser, canManageAssets, isEmployee } = useUser()

  // ── 데이터 상태 ──────────────────────────────────────────────────────────────
  const [assets, setAssets]         = useState<ApiAsset[]>([])
  const [loading, setLoading]       = useState(true)
  const [page, setPage]             = useState(1)
  const [total, setTotal]           = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [deptOptions, setDeptOptions] = useState<string[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // ── 검색 / 필터 상태 ─────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery]         = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterStatus, setFilterStatus]       = useState('')
  const [filterActive, setFilterActive]       = useState('') // 'active' | 'inactive' | ''
  const [filterCategory, setFilterCategory]   = useState('')
  const [filterDept, setFilterDept]           = useState('')

  // ── 고급 필터 상태 ───────────────────────────────────────────────────────────
  const [advFilters,      setAdvFilters]      = useState<AdvancedFilters>(ADVANCED_FILTER_DEFAULTS)
  const [isAdvFilterOpen, setIsAdvFilterOpen] = useState(false)

  // ── 모달 상태 ────────────────────────────────────────────────────────────────
  const [isUploadOpen, setIsUploadOpen]     = useState(false)
  const [isCreateOpen, setIsCreateOpen]     = useState(false)
  const [detailAssetId, setDetailAssetId]   = useState<string | null>(null)
  const [isDraftOpen, setIsDraftOpen]       = useState(false)
  const [isQrOpen,    setIsQrOpen]          = useState(false)

  // ── 일괄 상태 변경 ───────────────────────────────────────────────────────────
  const [bulkStatus,   setBulkStatus]   = useState('AVAILABLE')
  const [bulkChanging, setBulkChanging] = useState(false)

  // ── 검색 debounce (400ms) ────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400)
    return () => clearTimeout(t)
  }, [searchQuery])

  // ── URL에서 초기 필터 복원 (마운트 1회) ─────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const q = params.get('q') ?? ''
    if (q) setSearchQuery(q)
    const adv: AdvancedFilters = {
      dateFrom:             params.get('dateFrom') ?? '',
      dateTo:               params.get('dateTo')   ?? '',
      priceMin:             params.get('priceMin') ?? '',
      priceMax:             params.get('priceMax') ?? '',
      warrantyExpiringSoon: params.get('warranty') === '1',
    }
    if (Object.values(adv).some(Boolean)) setAdvFilters(adv)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 필터 → URL 동기화 ───────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams()
    if (debouncedSearch)              params.set('q',          debouncedSearch)
    if (filterStatus)                 params.set('status',     filterStatus)
    else if (filterActive)            params.set('active',     filterActive)
    if (filterCategory)               params.set('category',   filterCategory)
    if (filterDept)                   params.set('department', filterDept)
    if (advFilters.dateFrom)          params.set('dateFrom',   advFilters.dateFrom)
    if (advFilters.dateTo)            params.set('dateTo',     advFilters.dateTo)
    if (advFilters.priceMin)          params.set('priceMin',   advFilters.priceMin)
    if (advFilters.priceMax)          params.set('priceMax',   advFilters.priceMax)
    if (advFilters.warrantyExpiringSoon) params.set('warranty', '1')
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [debouncedSearch, filterStatus, filterActive, filterCategory, filterDept, advFilters])

  // ── 쿼리 파라미터 빌더 ───────────────────────────────────────────────────────
  const buildParams = useCallback((pageNum: number, overrideLimit?: number) => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('q', debouncedSearch)
    // 개별 상태 필터와 active/inactive 그룹 필터는 상호 배타적
    if (filterStatus)    params.set('status', filterStatus)
    else if (filterActive) params.set('active', filterActive)
    if (filterCategory)  params.set('category', filterCategory)
    // manager: 서버에서 본인 부서만 반환
    const dept = currentUser.role === 'manager' ? currentUser.department : filterDept
    if (dept) params.set('department', dept)
    // 고급 필터
    if (advFilters.dateFrom)             params.set('dateFrom', advFilters.dateFrom)
    if (advFilters.dateTo)               params.set('dateTo',   advFilters.dateTo)
    if (advFilters.priceMin)             params.set('priceMin', advFilters.priceMin)
    if (advFilters.priceMax)             params.set('priceMax', advFilters.priceMax)
    if (advFilters.warrantyExpiringSoon) params.set('warranty', '1')
    params.set('page',  String(pageNum))
    params.set('limit', String(overrideLimit ?? LIMIT))
    return params
  }, [debouncedSearch, filterStatus, filterActive, filterCategory, filterDept, currentUser, advFilters])

  // ── 자산 목록 패치 ───────────────────────────────────────────────────────────
  const fetchAssets = useCallback((pageNum = 1) => {
    setLoading(true)
    fetch(`/api/assets?${buildParams(pageNum)}`)
      .then((r) => r.json())
      .then((res: PaginatedAssets) => {
        setAssets(Array.isArray(res.data) ? res.data : [])
        setTotal(res.total ?? 0)
        setTotalPages(res.totalPages ?? 1)
        setPage(pageNum)
        if (res.departments?.length) setDeptOptions(res.departments)
      })
      .catch(() => toast.error('자산 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [buildParams])

  // 필터 변경 시 1페이지로 리셋
  useEffect(() => {
    setSelectedIds([])
    fetchAssets(1)
  }, [fetchAssets])

  // ── 페이지 이동 ──────────────────────────────────────────────────────────────
  const goToPage = (pageNum: number) => {
    if (pageNum < 1 || pageNum > totalPages || loading) return
    setSelectedIds([])
    fetchAssets(pageNum)
  }

  // ── 체크박스 ─────────────────────────────────────────────────────────────────
  const toggleAll = () =>
    setSelectedIds(selectedIds.length === assets.length ? [] : assets.map((a) => a.id))
  const toggleOne = (id: string) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  // ── Excel 다운로드 (현재 필터 그대로 export API에 전달) ───────────────────
  const [xlsxLoading, setXlsxLoading] = useState(false)
  const handleDownload = async () => {
    setXlsxLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch)   params.set('q', debouncedSearch)
      if (filterStatus)      params.set('status', filterStatus)
      else if (filterActive) params.set('active', filterActive)
      if (filterCategory)    params.set('category', filterCategory)
      const dept = currentUser.role === 'manager' ? currentUser.department : filterDept
      if (dept) params.set('department', dept)
      if (advFilters.dateFrom)             params.set('dateFrom', advFilters.dateFrom)
      if (advFilters.dateTo)               params.set('dateTo',   advFilters.dateTo)
      if (advFilters.priceMin)             params.set('priceMin', advFilters.priceMin)
      if (advFilters.priceMax)             params.set('priceMax', advFilters.priceMax)
      if (advFilters.warrantyExpiringSoon) params.set('warranty', '1')

      const res = await fetch(`/api/export/assets?${params}`)
      if (!res.ok) { toast.error('Excel 생성에 실패했습니다.'); return }

      const blob    = await res.blob()
      const url     = URL.createObjectURL(blob)
      const dateStr = new Date().toISOString().split('T')[0]
      const anchor  = document.createElement('a')
      anchor.href     = url
      anchor.download = `자산보고서_${dateStr}.xlsx`
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success('Excel 파일이 다운로드되었습니다.')
    } catch {
      toast.error('다운로드에 실패했습니다.')
    } finally {
      setXlsxLoading(false)
    }
  }

  const handleBulkStatusChange = async () => {
    if (selectedIds.length === 0 || !bulkStatus) return
    setBulkChanging(true)
    try {
      const res = await fetch('/api/assets/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, status: bulkStatus }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? '상태 변경에 실패했습니다.'); return }
      toast.success(`${data.updated}건의 상태가 변경되었습니다.`)
      setSelectedIds([])
      fetchAssets(page)
    } catch {
      toast.error('서버 오류가 발생했습니다.')
    } finally {
      setBulkChanging(false)
    }
  }

  const selectedAssets   = assets.filter((a) => selectedIds.includes(a.id))
  const advActiveCount    = [advFilters.dateFrom, advFilters.dateTo, advFilters.priceMin, advFilters.priceMax].filter(Boolean).length + (advFilters.warrantyExpiringSoon ? 1 : 0)
  const activeFilterCount = [filterStatus, filterActive, filterCategory, filterDept].filter(Boolean).length + advActiveCount
  const isManager         = currentUser.role === 'manager'

  // ── Skeleton 행 ─────────────────────────────────────────────────────────────
  const skeletonRows = Array.from({ length: 7 }).map((_, i) => (
    <tr key={i} className="border-b border-slate-100">
      <td className="px-4 py-3.5"><Skeleton className="w-4 h-4" /></td>
      <td className="px-6 py-3.5"><Skeleton className="h-6 w-16 rounded-md" /></td>
      <td className="px-6 py-3.5"><Skeleton className="h-4 w-28" /></td>
      <td className="px-6 py-3.5"><Skeleton className="h-6 w-14 rounded-md" /></td>
      <td className="px-6 py-3.5"><Skeleton className="h-4 w-36" /></td>
      <td className="px-6 py-3.5 space-y-1.5">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-3 w-14" />
      </td>
      {!isEmployee && <td className="px-6 py-3.5"><Skeleton className="h-4 w-20 ml-auto" /></td>}
    </tr>
  ))

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">

      {/* ── 툴바 ────────────────────────────────────────────────────────────── */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col gap-3 bg-slate-50/50 dark:bg-slate-900/50 print:hidden">
        {/* 1행: 검색 + 버튼들 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              aria-label="자산명 또는 코드 검색"
              className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-sm rounded-lg w-full pl-10 p-2.5 outline-none focus:ring-2 focus:ring-blue-300 transition-all dark:text-slate-200 dark:placeholder-slate-400"
              placeholder="자산명, 코드 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {canManageAssets && (
              <>
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="flex items-center px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <PlusCircle className="w-4 h-4 mr-2" /> 자산 등록
                </button>
                <button
                  onClick={() => setIsUploadOpen(true)}
                  className="flex items-center px-4 py-2.5 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors shadow-sm"
                >
                  <Upload className="w-4 h-4 mr-2" /> 엑셀 업로드
                </button>
                <button
                  onClick={handleDownload}
                  disabled={xlsxLoading}
                  className="flex items-center px-4 py-2.5 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  <Download className={`w-4 h-4 mr-2 ${xlsxLoading ? 'animate-pulse' : ''}`} />
                  {xlsxLoading ? '생성 중...' : 'Excel 다운'}
                </button>
              </>
            )}
            <button
              onClick={() => { if (selectedIds.length > 0) setIsDraftOpen(true) }}
              disabled={selectedIds.length === 0}
              className="flex items-center px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <FileSignature className="w-4 h-4 mr-2 text-slate-500" />
              결재 기안
              {selectedIds.length > 0 && <span className="ml-1 text-blue-600 font-bold">({selectedIds.length})</span>}
            </button>
            <button
              onClick={() => { if (selectedIds.length > 0) setIsQrOpen(true) }}
              disabled={selectedIds.length === 0}
              className="flex items-center px-4 py-2.5 text-sm font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <QrCode className="w-4 h-4 mr-2" />
              QR 태그
              {selectedIds.length > 0 && <span className="ml-1 font-bold">({selectedIds.length})</span>}
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Printer className="w-4 h-4 mr-2 text-slate-500" /> 인쇄
            </button>
          </div>
        </div>

        {/* 2행: 필터 드롭다운 */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          {/* 활성/비활성 그룹 필터 (TW-AMS active/inactive 호환) */}
          <select
            value={filterActive}
            onChange={(e) => { setFilterActive(e.target.value); setFilterStatus('') }}
            className={SELECT_CLS}
          >
            <option value="">활성/비활성 전체</option>
            <option value="active">활성 (운용 중)</option>
            <option value="inactive">비활성 (운용 종료)</option>
          </select>
          {/* 세부 상태 필터 */}
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setFilterActive('') }}
            className={SELECT_CLS}
          >
            <option value="">세부 상태 전체</option>
            {Object.entries(ASSET_STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className={SELECT_CLS}>
            <option value="">전체 품목</option>
            {Object.entries(ASSET_CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          {/* manager는 본인 부서만 조회 → 드롭다운 숨김 */}
          {!isManager && (
            <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className={SELECT_CLS}>
              <option value="">전체 부서</option>
              {deptOptions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}
          {/* 고급 필터 버튼 */}
          <button
            onClick={() => setIsAdvFilterOpen(true)}
            className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border transition-colors ${
              advActiveCount > 0
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700 hover:bg-blue-100'
                : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            고급 필터
            {advActiveCount > 0 && (
              <span className="text-[10px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded-full">{advActiveCount}</span>
            )}
          </button>
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setFilterStatus(''); setFilterActive(''); setFilterCategory(''); setFilterDept(''); setAdvFilters(ADVANCED_FILTER_DEFAULTS) }}
              className="text-xs font-semibold text-red-500 hover:text-red-700 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              필터 초기화 ({activeFilterCount})
            </button>
          )}
        </div>

        {/* 활성 고급 필터 태그 */}
        {advActiveCount > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {advFilters.dateFrom && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded-md px-2 py-0.5">
                시작일: {advFilters.dateFrom}
                <button onClick={() => setAdvFilters((f) => ({ ...f, dateFrom: '' }))} aria-label="시작일 필터 제거"><X className="w-3 h-3" /></button>
              </span>
            )}
            {advFilters.dateTo && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded-md px-2 py-0.5">
                종료일: {advFilters.dateTo}
                <button onClick={() => setAdvFilters((f) => ({ ...f, dateTo: '' }))} aria-label="종료일 필터 제거"><X className="w-3 h-3" /></button>
              </span>
            )}
            {advFilters.priceMin && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded-md px-2 py-0.5">
                최소가: {Number(advFilters.priceMin).toLocaleString()}원
                <button onClick={() => setAdvFilters((f) => ({ ...f, priceMin: '' }))} aria-label="최소가 필터 제거"><X className="w-3 h-3" /></button>
              </span>
            )}
            {advFilters.priceMax && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded-md px-2 py-0.5">
                최대가: {Number(advFilters.priceMax).toLocaleString()}원
                <button onClick={() => setAdvFilters((f) => ({ ...f, priceMax: '' }))} aria-label="최대가 필터 제거"><X className="w-3 h-3" /></button>
              </span>
            )}
            {advFilters.warrantyExpiringSoon && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700 rounded-md px-2 py-0.5">
                보증 만료 임박
                <button onClick={() => setAdvFilters((f) => ({ ...f, warrantyExpiringSoon: false }))} aria-label="보증만료 필터 제거"><X className="w-3 h-3" /></button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── 모바일 카드 뷰 (lg 미만) ────────────────────────────────────────── */}
      <div className="lg:hidden flex-1 overflow-auto custom-scrollbar">
        {loading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-6 w-16 rounded-md" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        ) : assets.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
            {total === 0 && !debouncedSearch && activeFilterCount === 0
              ? '등록된 자산이 없습니다.'
              : '검색/필터 조건에 맞는 자산이 없습니다.'}
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {assets.map((asset) => (
              <div
                key={asset.id}
                onClick={() => setDetailAssetId(asset.id)}
                className={`rounded-xl border p-4 cursor-pointer transition-colors ${
                  selectedIds.includes(asset.id)
                    ? 'bg-blue-50/60 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 active:bg-slate-50 dark:active:bg-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label={`${asset.name} 선택`}
                      checked={selectedIds.includes(asset.id)}
                      onChange={() => toggleOne(asset.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 cursor-pointer shrink-0"
                    />
                    <Badge
                      colorClass={STATUS_COLOR[asset.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}
                      label={ASSET_STATUS_LABEL[asset.status] ?? asset.status}
                    />
                  </div>
                  <span className="font-mono text-xs text-slate-400 dark:text-slate-500 shrink-0">{asset.code}</span>
                </div>
                <p className="font-semibold text-slate-900 dark:text-slate-100 mb-2 truncate">{asset.name}</p>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge
                      colorClass="bg-slate-100 text-slate-600 border-slate-200"
                      label={ASSET_CATEGORY_LABEL[asset.category] ?? asset.category}
                    />
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {asset.department} · {asset.location ?? '-'}
                    </span>
                  </div>
                  {!isEmployee && (
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
                      {formatCurrency(Number(asset.price))}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 데스크탑 테이블 (lg 이상) ─────────────────────────────────────── */}
      <div className="hidden lg:block flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300 whitespace-nowrap">
          <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-4 w-10 print:hidden">
                <input
                  type="checkbox"
                  aria-label="현재 페이지 전체 선택"
                  onChange={toggleAll}
                  checked={assets.length > 0 && selectedIds.length === assets.length}
                  className="w-4 h-4 cursor-pointer"
                />
              </th>
              <th className="px-3 py-4 w-14 print:hidden">이미지</th>
              <th className="px-6 py-4 font-semibold">상태</th>
              <th className="px-6 py-4 font-semibold">자산관리번호</th>
              <th className="px-6 py-4 font-semibold">분류</th>
              <th className="px-6 py-4 font-semibold">품명</th>
              <th className="px-6 py-4 font-semibold">사업장 / 상세위치</th>
              <th className="px-6 py-4 font-semibold">담당자</th>
              {!isEmployee && <th className="px-6 py-4 font-semibold text-right">취득가액</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? skeletonRows : assets.map((asset) => (
              <tr
                key={asset.id}
                onClick={() => setDetailAssetId(asset.id)}
                className={`border-b border-slate-100 dark:border-slate-700 transition-colors cursor-pointer ${
                  selectedIds.includes(asset.id)
                    ? 'bg-blue-50/60 dark:bg-blue-900/20'
                    : 'bg-white dark:bg-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-700/50'
                }`}
              >
                <td className="px-4 py-3 print:hidden" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" aria-label={`${asset.name} 선택`} checked={selectedIds.includes(asset.id)} onChange={() => toggleOne(asset.id)} className="w-4 h-4 cursor-pointer" />
                </td>
                <td className="px-3 py-3 print:hidden" onClick={(e) => e.stopPropagation()}>
                  {asset.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={asset.thumbnail}
                      alt={asset.name}
                      className="w-10 h-10 object-cover rounded-lg border border-slate-200 dark:border-slate-600"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                      <ImageIcon className="w-4 h-4 text-slate-300 dark:text-slate-500" />
                    </div>
                  )}
                </td>
                <td className="px-6 py-3">
                  <Badge
                    colorClass={STATUS_COLOR[asset.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}
                    label={ASSET_STATUS_LABEL[asset.status] ?? asset.status}
                  />
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                    getActiveLabel(asset.status) === '활성'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    {getActiveLabel(asset.status)}
                  </span>
                </td>
                <td className="px-6 py-3 font-mono text-xs text-slate-500">{asset.code}</td>
                <td className="px-6 py-3">
                  <Badge
                    colorClass="bg-slate-100 text-slate-600 border-slate-200"
                    label={ASSET_CATEGORY_LABEL[asset.category] ?? asset.category}
                    size="md"
                  />
                </td>
                <td className="px-6 py-3 font-semibold text-slate-900 dark:text-slate-100">{asset.name}</td>
                <td className="px-6 py-3 text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{asset.department}</span>
                  <br />
                  <span className="text-slate-400">{asset.location ?? '-'}</span>
                </td>
                <td className="px-6 py-3 text-xs text-slate-500 dark:text-slate-400">
                  {asset.assignedTo ?? <span className="text-slate-300 dark:text-slate-600">-</span>}
                </td>
                {!isEmployee && (
                  <td className="px-6 py-3 text-right font-bold text-slate-800 dark:text-slate-100">
                    {formatCurrency(Number(asset.price))}
                  </td>
                )}
              </tr>
            ))}
            {!loading && assets.length === 0 && (
              <EmptyTableRow
                colSpan={isEmployee ? 8 : 9}
                message={
                  total === 0 && !debouncedSearch && activeFilterCount === 0
                    ? '등록된 자산이 없습니다. 자산 등록 또는 엑셀 업로드로 추가해보세요.'
                    : '검색/필터 조건에 맞는 자산이 없습니다.'
                }
              />
            )}
          </tbody>
        </table>
      </div>

      {/* ── 하단 바: 총 건수 + 페이지네이션 ──────────────────────────────────── */}
      <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-4 print:hidden">
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {loading ? (
            <Skeleton className="h-3 w-32" />
          ) : (
            <>
              총 {total.toLocaleString()}건
              {selectedIds.length > 0 && ` · ${selectedIds.length}건 선택됨`}
            </>
          )}
        </span>

        {/* 페이지네이션 컨트롤 */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(1)}
              disabled={page <= 1 || loading}
              className="px-2 py-1 text-xs rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-600 dark:text-slate-400"
            >
              처음
            </button>
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1 || loading}
              aria-label="이전 페이지"
              className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </button>
            <span className="text-xs font-mono text-slate-600 dark:text-slate-400 px-2 min-w-[4rem] text-center">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages || loading}
              aria-label="다음 페이지"
              className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </button>
            <button
              onClick={() => goToPage(totalPages)}
              disabled={page >= totalPages || loading}
              className="px-2 py-1 text-xs rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-600 dark:text-slate-400"
            >
              마지막
            </button>
          </div>
        )}
      </div>

      {/* ── 모달 ────────────────────────────────────────────────────────────── */}
      {isUploadOpen && (
        <BulkUploadModal
          onClose={() => setIsUploadOpen(false)}
          onSuccess={(count) => { fetchAssets(1); toast.success(`${count}건이 등록되었습니다.`) }}
        />
      )}
      {isCreateOpen && (
        <AssetCreateModal
          onClose={() => setIsCreateOpen(false)}
          onSuccess={() => { fetchAssets(1) }}
        />
      )}
      {detailAssetId && (
        <AssetDetailModal
          assetId={detailAssetId}
          onClose={() => setDetailAssetId(null)}
          onUpdated={() => fetchAssets(page)}
        />
      )}
      {isDraftOpen && (
        <ApprovalDraftModal
          selectedAssets={selectedAssets}
          onClose={() => setIsDraftOpen(false)}
          onSuccess={() => { setSelectedIds([]); toast.success('결재가 기안되었습니다.') }}
        />
      )}
      {isQrOpen && (
        <QrTagModal
          assets={selectedAssets}
          onClose={() => setIsQrOpen(false)}
        />
      )}
      <AdvancedFilterPanel
        open={isAdvFilterOpen}
        filters={advFilters}
        onChange={setAdvFilters}
        onReset={() => setAdvFilters(ADVANCED_FILTER_DEFAULTS)}
        onClose={() => setIsAdvFilterOpen(false)}
        activeCount={advActiveCount}
      />

      {/* ── 일괄 상태 변경 플로팅 액션바 ───────────────────────────────────────── */}
      {selectedIds.length > 0 && canManageAssets && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-slate-900 text-white rounded-2xl shadow-2xl px-5 py-3 border border-slate-700">
          <CheckSquare className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="text-sm font-semibold text-slate-200 whitespace-nowrap">
            {selectedIds.length}건 선택됨
          </span>
          <div className="w-px h-5 bg-slate-700" />
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
            className="bg-slate-800 border border-slate-600 text-sm text-white rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="AVAILABLE">사용가능</option>
            <option value="IN_USE">사용중</option>
            <option value="UNDER_MAINTENANCE">수리중</option>
            <option value="RETIRED">보관중</option>
            <option value="DISPOSED">처분</option>
          </select>
          <button
            onClick={handleBulkStatusChange}
            disabled={bulkChanging}
            className="flex items-center px-4 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {bulkChanging
              ? <><RefreshCcw className="w-3.5 h-3.5 mr-1.5 animate-spin" />변경 중...</>
              : '일괄 변경'}
          </button>
          <button
            onClick={() => setSelectedIds([])}
            className="p-1.5 text-slate-400 hover:text-white transition-colors"
            title="선택 해제"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
