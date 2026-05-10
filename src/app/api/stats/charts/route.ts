export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, serverError } from '@/lib/api-response'
import { getRequestUser } from '@/lib/rbac'

// 카테고리별 고정 색상 (다크모드 양쪽 다 선명하게 보이는 팔레트)
const CATEGORY_HEX: Record<string, string> = {
  IT_EQUIPMENT: '#3B82F6', // blue-500
  FURNITURE:    '#10B981', // emerald-500
  VEHICLE:      '#F59E0B', // amber-500
  MACHINERY:    '#8B5CF6', // violet-500
  OTHER:        '#6B7280', // gray-500
}
const CATEGORY_KO: Record<string, string> = {
  IT_EQUIPMENT: 'IT 장비',
  FURNITURE:    '가구',
  VEHICLE:      '차량',
  MACHINERY:    '기계',
  OTHER:        '기타',
}

// GET /api/stats/charts — 대시보드 차트용 집계. MANAGER는 본인 부서만.
export async function GET(request: NextRequest) {
  const sessionUser = await getRequestUser(request)
  if (!sessionUser) {
    return new Response(JSON.stringify({ error: '인증이 필요합니다.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const deptFilter =
      sessionUser.role === 'MANAGER' && sessionUser.department
        ? { department: sessionUser.department }
        : {}

    // 활성 자산만 (취득일·카테고리·금액·부서 필드만 선택)
    const assets = await prisma.asset.findMany({
      where:  { deletedAt: null, ...deptFilter },
      select: { category: true, price: true, department: true, acquiredDate: true },
    })

    // ── 1. 카테고리별 자산 건수 (도넛 차트) ────────────────────────────────────
    const catCountMap: Record<string, number> = {}
    for (const a of assets) {
      catCountMap[a.category] = (catCountMap[a.category] ?? 0) + 1
    }
    const totalCount = assets.length
    const categoryData = Object.entries(catCountMap)
      .map(([cat, count]) => ({
        category:   cat,
        label:      CATEGORY_KO[cat] ?? cat,
        count,
        percentage: totalCount > 0 ? (count / totalCount) * 100 : 0,
        color:      CATEGORY_HEX[cat] ?? '#94A3B8',
      }))
      .sort((a, b) => b.count - a.count)

    // ── 2. 월별 자산 등록 추이 (최근 12개월 라인 차트) ────────────────────────
    const now       = new Date()
    const months: { year: number; month: number; label: string; count: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({
        year:  d.getFullYear(),
        month: d.getMonth() + 1,               // 1-12
        label: `${d.getMonth() + 1}월`,
        count: 0,
      })
    }
    for (const a of assets) {
      const d = new Date(a.acquiredDate)
      const slot = months.find((m) => m.year === d.getFullYear() && m.month === d.getMonth() + 1)
      if (slot) slot.count++
    }
    const monthlyData = months

    // ── 3. 부서별 자산 금액 상위 7개 (수평 바 차트) ────────────────────────────
    const deptValueMap: Record<string, number> = {}
    for (const a of assets) {
      deptValueMap[a.department] = (deptValueMap[a.department] ?? 0) + Number(a.price)
    }
    const maxValue = Math.max(...Object.values(deptValueMap), 1)
    const deptValueData = Object.entries(deptValueMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 7)
      .map(([dept, totalValue]) => ({
        dept,
        totalValue,
        percentage: (totalValue / maxValue) * 100,
      }))

    return ok({ categoryData, monthlyData, deptValueData })
  } catch (e) {
    return serverError(e)
  }
}
