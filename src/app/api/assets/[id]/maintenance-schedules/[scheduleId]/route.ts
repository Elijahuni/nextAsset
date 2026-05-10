export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notFound, ok, serverError } from '@/lib/api-response'
import { getRequestUser } from '@/lib/rbac'

type RouteContext = { params: Promise<{ id: string; scheduleId: string }> }

// DELETE /api/assets/:id/maintenance-schedules/:scheduleId
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const sessionUser = await getRequestUser(request)
  if (!sessionUser) return new Response(JSON.stringify({ error: '인증이 필요합니다.' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  if (!['ADMIN', 'MANAGER'].includes(sessionUser.role)) return new Response(JSON.stringify({ error: '권한이 없습니다.' }), { status: 403, headers: { 'Content-Type': 'application/json' } })

  try {
    const { scheduleId } = await params
    const schedule = await prisma.maintenanceSchedule.findUnique({ where: { id: scheduleId } })
    if (!schedule) return notFound('MaintenanceSchedule')

    await prisma.maintenanceSchedule.delete({ where: { id: scheduleId } })
    return ok({ deleted: true })
  } catch (error) {
    return serverError(error)
  }
}
