export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, serverError } from '@/lib/api-response'
import { requireRoles } from '@/lib/rbac'
import { DEFAULT_DEPRECIATION_RULES } from '@/lib/depreciation'

const SALVAGE_VALUE = 1000
const RATE_MAP: Record<number, number> = { 3: 0.631, 4: 0.528, 5: 0.451, 6: 0.392, 8: 0.313 }

function calcBookValue(
  price: number,
  monthsElapsed: number,
  totalMonths: number,
  method: '정액법' | '정률법',
  usefulYears: number,
): { bookValue: number; annualDepreciation: number } {
  if (monthsElapsed >= totalMonths || price <= SALVAGE_VALUE) {
    return { bookValue: SALVAGE_VALUE, annualDepreciation: 0 }
  }

  if (method === '정액법') {
    const monthlyDepr = (price - SALVAGE_VALUE) / totalMonths
    const accumulated  = Math.floor(monthsElapsed * monthlyDepr)
    const bookValue    = price - accumulated
    const annualDepreciation = Math.floor(monthlyDepr * 12)
    return { bookValue: Math.max(bookValue, SALVAGE_VALUE), annualDepreciation }
  }

  // 정률법
  const R = RATE_MAP[usefulYears] ?? (1 - Math.pow(SALVAGE_VALUE / price, 1 / usefulYears))
  let bv = price
  const fullYears = Math.floor(monthsElapsed / 12)
  const remMonths = monthsElapsed % 12

  for (let y = 0; y < fullYears; y++) {
    bv -= Math.floor(bv * R)
  }
  if (remMonths > 0) {
    const currentYearDepr = Math.floor(bv * R)
    bv -= Math.floor(currentYearDepr / 12) * remMonths
  }
  bv = Math.max(bv, SALVAGE_VALUE)

  // 현재 연도 연간 감가상각비 (현재 장부가 기준)
  const annualDepreciation = bv > SALVAGE_VALUE ? Math.floor(bv * R) : 0

  return { bookValue: bv, annualDepreciation }
}

// GET /api/depreciation/calculate
// 모든 활성 자산에 DB 감가상각 규칙을 적용해 계산 결과 반환
export async function GET(request: NextRequest) {
  const authError = await requireRoles(request, ['ADMIN', 'MANAGER'])
  if (authError) return authError

  try {
    // 규칙 로드 (DB 우선, 없으면 기본값)
    const ruleItem = await prisma.masterItem.findFirst({ where: { type: 'depreciation_rules' } })
    const rules: Record<string, { years: number; method: '정액법' | '정률법' }> = (() => {
      if (!ruleItem) return DEFAULT_DEPRECIATION_RULES
      try { return JSON.parse(ruleItem.value) } catch { return DEFAULT_DEPRECIATION_RULES }
    })()

    // 활성 자산 조회
    const assets = await prisma.asset.findMany({
      where:   { deletedAt: null },
      select:  { id: true, code: true, name: true, category: true, price: true, acquiredDate: true },
      orderBy: [{ category: 'asc' }, { acquiredDate: 'asc' }],
    })

    const today = new Date()

    const rows = assets.map((asset) => {
      const price        = Number(asset.price)
      const rule         = rules[asset.category] ?? { years: 5, method: '정액법' as const }
      const usefulYears  = rule.years
      const totalMonths  = usefulYears * 12

      const acquired     = new Date(asset.acquiredDate)
      const diff         = today.getTime() - acquired.getTime()
      const monthsElapsed = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24 * 30.4)))
      const clamped      = Math.min(monthsElapsed, totalMonths)

      const { bookValue, annualDepreciation } = calcBookValue(
        price, monthsElapsed, totalMonths, rule.method, usefulYears,
      )

      // 내용연수 종료일
      const endDate = new Date(acquired)
      endDate.setFullYear(endDate.getFullYear() + usefulYears)

      const fullyDepreciated = clamped >= totalMonths || bookValue <= SALVAGE_VALUE

      return {
        id:               asset.id,
        code:             asset.code,
        name:             asset.name,
        category:         asset.category,
        price,
        acquiredDate:     asset.acquiredDate.toISOString().split('T')[0],
        usefulYears,
        method:           rule.method,
        monthsElapsed:    clamped,
        totalMonths,
        bookValue,
        accumulated:      price - bookValue,
        annualDepreciation,
        salvageValue:     SALVAGE_VALUE,
        endOfLifeDate:    endDate.toISOString().split('T')[0],
        fullyDepreciated,
      }
    })

    return ok(rows)
  } catch (e) {
    return serverError(e)
  }
}
