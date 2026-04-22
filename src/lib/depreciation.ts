// 원본 AssetManagementMVP.jsx의 calculateDepreciation 로직 그대로 이식
// 카테고리별 내용연수/상각방법 기본 설정 (영문 enum 키 사용)

export const DEFAULT_DEPRECIATION_RULES: Record<string, { years: number; method: '정액법' | '정률법' }> = {
  IT_EQUIPMENT: { years: 4, method: '정률법' },
  FURNITURE:    { years: 8, method: '정액법' },
  VEHICLE:      { years: 5, method: '정액법' },
  MACHINERY:    { years: 5, method: '정액법' },
  OTHER:        { years: 5, method: '정액법' },
}

export interface DepreciationResult {
  accumulated: number
  bookValue: number
  monthsElapsed: number
  totalMonths: number
  rule: { years: number; method: string }
}

export function calculateDepreciation(
  dateStr: string,
  price: number,
  category: string,
  customRules?: Record<string, { years: number; method: '정액법' | '정률법' }>
): DepreciationResult {
  const rules = customRules ?? DEFAULT_DEPRECIATION_RULES
  const rule = rules[category] ?? { years: 5, method: '정액법' as const }
  const USEFUL_YEARS = rule.years
  const TOTAL_MONTHS = USEFUL_YEARS * 12
  const SALVAGE_VALUE = 1000

  const diff = new Date().getTime() - new Date(dateStr).getTime()
  let monthsElapsed = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24 * 30.4)))

  let bookValue = price
  let accumulated = 0

  if (monthsElapsed >= TOTAL_MONTHS || price <= SALVAGE_VALUE) {
    accumulated = price - SALVAGE_VALUE
    bookValue = SALVAGE_VALUE
    monthsElapsed = TOTAL_MONTHS
  } else if (rule.method === '정액법') {
    const monthlyDepr = (price - SALVAGE_VALUE) / TOTAL_MONTHS
    accumulated = Math.floor(monthsElapsed * monthlyDepr)
    bookValue = price - accumulated
  } else {
    // 정률법
    const RATE_MAP: Record<number, number> = { 3: 0.631, 4: 0.528, 5: 0.451, 6: 0.392, 8: 0.313 }
    const R = RATE_MAP[USEFUL_YEARS] ?? (1 - Math.pow(SALVAGE_VALUE / price, 1 / USEFUL_YEARS))

    const fullYears = Math.floor(monthsElapsed / 12)
    const remMonths = monthsElapsed % 12

    for (let y = 0; y < fullYears; y++) {
      bookValue -= Math.floor(bookValue * R)
    }
    if (remMonths > 0) {
      const currentYearDepr = Math.floor(bookValue * R)
      bookValue -= Math.floor(currentYearDepr / 12) * remMonths
    }
    if (bookValue < SALVAGE_VALUE) bookValue = SALVAGE_VALUE
    accumulated = price - bookValue
  }

  return { accumulated, bookValue, monthsElapsed, totalMonths: TOTAL_MONTHS, rule }
}
