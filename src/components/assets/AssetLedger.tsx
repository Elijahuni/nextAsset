'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Search, Upload, Download, FileSignature, PlusCircle,
  Printer, Filter, ChevronLeft, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useUser } from '@/context/user-context'
import { ASSET_STATUS_LABEL, ASSET_CATEGORY_LABEL, formatCurrency, getActiveLabel } from '@/lib/utils'
import { Skeleton, Badge, EmptyTableRow } from '@/components/ui'
import BulkUploadModal from './BulkUploadModal'
import AssetCreateModal from './AssetCreateModal'
import AssetDetailModal from './AssetDetailModal'
import ApprovalDraftModal from './ApprovalDraftModal'
import type { ApiAsset, PaginatedAssets } from '@/types'

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

  // ── 모달 상태 ────────────────────────────────────────────────────────────────
  const [isUploadOpen, setIsUploadOpen]     = useState(false)
  const [isCreateOpen, setIsCreateOpen]     = useState(false)
  const [detailAssetId, setDetailAssetId]   = useState<string | null>(null)
  const [isDraftOpen, setIsDraftOpen]       = useState(false)

  // ── 검색 debounce (400ms) ────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400)
    return () => clearTimeout(t)
  }, [searchQuery])

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
    params.set('page',  String(pageNum))
    params.set('limit', String(overrideLimit ?? LIMIT))
    return params
  }, [debouncedSearch, filterStatus, filterActive, filterCategory, filterDept, currentUser])

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

  // ── CSV 다운로드 (현재 필터 기준 전체) ───────────────────────────────────────
  const handleDownload = async () => {
    try {
      const res  = await fetch(`/api/assets?${buildParams(1, 9999)}`)
      const json = await res.json() as PaginatedAssets
      const list = json.data ?? []
      const header = ['자산코드', '자산명', '품목', '부서', '위치', '상태', '취득가액', '취득일']
      const rows = list.map((a) => [
        a.code, a.name,
        ASSET_CATEGORY_LABEL[a.category] ?? a.category,
        a.department, a.location,
        ASSET_STATUS_LABEL[a.status] ?? a.status,
        Number(a.price).toLocaleString(),
        a.acquiredDate?.split('T')[0] ?? '',
      ])
      const csv  = [header, ...rows].map((r) => r.join(',')).join('\n')
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = '자산원장.csv'; a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('다운로드에 실패했습니다.')
    }
  }

  const selectedAssets   = assets.filter((a) => selectedIds.includes(a.id))
  const activeFilterCount = [filterStatus, filterActive, filterCategory, filterDept].filter(Boolean).length
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
                  className="flex items-center px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4 mr-2 text-slate-500" /> 엑셀 다운
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
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setFilterStatus(''); setFilterActive(''); setFilterCategory(''); setFilterDept('') }}
              className="text-xs font-semibold text-red-500 hover:text-red-700 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              필터 초기화 ({activeFilterCount})
            </button>
          )}
        </div>
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
                  onChange={toggleAll}
                  checked={assets.length > 0 && selectedIds.length === assets.length}
                  className="w-4 h-4 cursor-pointer"
                />
              </th>
              <th className="px-6 py-4 font-semibold">상태</th>
              <th className="px-6 py-4 font-semibold">자산관리번호</th>
              <th className="px-6 py-4 font-semibold">분류</th>
              <th className="px-6 py-4 font-semibold">품명</th>
              <th className="px-6 py-4 font-semibold">사업장 / 상세위치</th>
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
                  <input type="checkbox" checked={selectedIds.includes(asset.id)} onChange={() => toggleOne(asset.id)} className="w-4 h-4 cursor-pointer" />
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
                {!isEmployee && (
                  <td className="px-6 py-3 text-right font-bold text-slate-800 dark:text-slate-100">
                    {formatCurrency(Number(asset.price))}
                  </td>
                )}
              </tr>
            ))}
            {!loading && assets.length === 0 && (
              <EmptyTableRow
                colSpan={isEmployee ? 6 : 7}
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
    </div>
  )
}
