// ─── 원본 AssetManagementMVP.jsx의 CATEGORY_COLORS, getStatusColor, 유틸 함수 유지 ───

export const CATEGORY_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500',
  'bg-amber-500', 'bg-pink-500', 'bg-cyan-500', 'bg-gray-500',
]

// API 반환 AssetStatus enum → 한국어 라벨
export const ASSET_STATUS_LABEL: Record<string, string> = {
  AVAILABLE:         '사용가능',
  IN_USE:            '사용중',
  UNDER_MAINTENANCE: '수리중',
  RETIRED:           '보관중',
  DISPOSED:          '처분',
}

// AssetCategory enum → 한국어 라벨
export const ASSET_CATEGORY_LABEL: Record<string, string> = {
  IT_EQUIPMENT: 'IT장비',
  FURNITURE:    '사무가구',
  VEHICLE:      '차량',
  MACHINERY:    '기계장치',
  OTHER:        '기타',
}

// 원본 getStatusColor 유지 (한국어 기준 + 영문 enum 기준 모두 지원)
export function getStatusColor(status: string): string {
  switch (status) {
    case '사용중': case 'IN_USE': case '승인완료': case 'APPROVED':
      return 'bg-green-100 text-green-800 border-green-200'
    case '수리중': case 'UNDER_MAINTENANCE': case '결재대기': case 'PENDING':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case '처분': case 'DISPOSED': case '반려': case 'REJECTED': case '누락':
      return 'bg-red-100 text-red-800 border-red-200'
    case '대여중': case 'RENTAL':
      return 'bg-purple-100 text-purple-800 border-purple-200'
    case '사용가능': case 'AVAILABLE':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case '일치':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

// 원본 getWarrantyStatus 유지
export function getWarrantyStatus(warrantyDateStr: string | null) {
  if (!warrantyDateStr) return { text: '미설정', color: 'text-gray-500 bg-gray-100', isExpired: true }
  const today = new Date()
  const warrantyDate = new Date(warrantyDateStr)
  const diffDays = Math.ceil((warrantyDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return { text: '보증 만료', color: 'text-red-600 bg-red-100 border-red-200', isExpired: true }
  if (diffDays <= 30) return { text: `만료 임박 (D-${diffDays})`, color: 'text-amber-600 bg-amber-100 border-amber-200', isExpired: false }
  return { text: `보증 유효 (D-${diffDays})`, color: 'text-emerald-600 bg-emerald-100 border-emerald-200', isExpired: false }
}

// 원본 formatCurrency 유지
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount)
}

export function getNowStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
