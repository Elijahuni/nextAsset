/**
 * 공통 API 응답 타입 정의
 * 여러 컴포넌트에서 중복 선언하던 인터페이스를 중앙화합니다.
 */

// ─── 자산 ──────────────────────────────────────────────────────────────────

export interface ApiAsset {
  id:           string
  code:         string
  name:         string
  category:     string
  department:   string
  location:     string
  status:       string
  price:        string | number
  acquiredDate: string
  warrantyDate?: string | null
  barcode?:     string | null
  remarks?:     string | null   // 비고 (TW-AMS 호환)
  deletedAt?:   string | null
  createdAt?:   string
  updatedAt?:   string
  historyLogs?:     ApiHistoryLog[]
  maintenanceLogs?: ApiMaintenanceLog[]
}

export interface PaginatedAssets {
  data:        ApiAsset[]
  total:       number
  page:        number
  limit:       number
  totalPages:  number
  departments: string[]
}

// ─── 결재 ──────────────────────────────────────────────────────────────────

export interface ApiApproval {
  id:          string
  title:       string
  type:        string
  status:      string
  reason:      string | null
  applicantId: string
  approverId:  string | null
  createdAt:   string
  updatedAt:   string
  applicant:   { id: string; name: string; department: string }
  approver:    { id: string; name: string } | null
  assets:      { asset: { id: string; code: string; name: string; status: string } }[]
}

// ─── 이력 / 유지보수 ───────────────────────────────────────────────────────

export interface ApiHistoryLog {
  id:     string
  type:   string
  detail: string
  date:   string
  user?:  { id: string; name: string }
}

export interface ApiMaintenanceLog {
  id:     string
  date:   string
  vendor: string
  cost:   string | number
  detail: string
}

// ─── 마스터 데이터 ─────────────────────────────────────────────────────────

export interface MasterData {
  categories:  string[]
  departments: string[]
  locations:   string[]
  vendors:     string[]
}
