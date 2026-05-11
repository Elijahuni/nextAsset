export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, serverError } from '@/lib/api-response'
import { requireRoles } from '@/lib/rbac'

// GET /api/maintenance/due — 이번 달 점검 예정 목록
export async function GET(request: NextRequest) {
  const authError = await requireRoles(request, ['ADMIN', 'MANAGER', 'STAFF'])
  if (authError) return authError
  try {
    const now        = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    const schedules = await prisma.maintenanceSchedule.findMany({
      where: {
        nextDueAt: { gte: monthStart, lte: monthEnd },
        asset: { deletedAt: null },
      },
      include: {
        asset: { select: { id: true, name: true, code: true, department: true } },
      },
      orderBy: { nextDueAt: 'asc' },
      take: 50,
    })

    return ok({ count: schedules.length, schedules })
  } catch (error) {
    return serverError(error)
  }
}
