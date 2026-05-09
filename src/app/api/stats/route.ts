export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, serverError } from '@/lib/api-response'
import { getRequestUser } from '@/lib/rbac'
import { ASSET_STATUS_LABEL, ASSET_CATEGORY_LABEL } from '@/lib/utils'

// GET /api/stats — 대시보드용 집계 통계. MANAGER는 본인 부서만 집계.
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

    const pendingWhere =
      sessionUser.role === 'STAFF'
        ? { applicantId: sessionUser.id }
        : sessionUser.role === 'MANAGER'
        ? {
            OR: [
              { applicant: { department: sessionUser.department ?? undefined } },
              { approverId: sessionUser.id },
            ],
          }
        : {}

    const [assets, pendingApprovals] = await Promise.all([
      prisma.asset.findMany({
        where: { deletedAt: null, ...deptFilter },
        select: { status: true, category: true, price: true, department: true },
      }),
      prisma.approval.count({ where: { status: 'PENDING', ...pendingWhere } }),
    ])

    const totalCount = assets.length
    const totalValue = assets.reduce((sum, a) => sum + Number(a.price), 0)
    const inUseCount = assets.filter((a) => a.status === 'IN_USE').length

    const statusCounts = assets.reduce<Record<string, number>>((acc, a) => {
      const label = ASSET_STATUS_LABEL[a.status] ?? a.status
      acc[label] = (acc[label] ?? 0) + 1
      return acc
    }, {})

    const categoryValueMap = assets.reduce<Record<string, number>>((acc, a) => {
      const label = ASSET_CATEGORY_LABEL[a.category] ?? a.category
      acc[label] = (acc[label] ?? 0) + Number(a.price)
      return acc
    }, {})

    const categoryChartData = Object.entries(categoryValueMap)
      .map(([name, value]) => ({
        name,
        value,
        percentage: totalValue ? (value / totalValue) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)

    const deptCounts = assets.reduce<Record<string, number>>((acc, a) => {
      acc[a.department] = (acc[a.department] ?? 0) + 1
      return acc
    }, {})

    const topDepartments = Object.entries(deptCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5) as [string, number][]

    return ok({ totalCount, totalValue, inUseCount, pendingApprovals, statusCounts, categoryChartData, topDepartments })
  } catch (error) {
    return serverError(error)
  }
}
