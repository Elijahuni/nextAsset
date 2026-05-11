export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { badRequest, created, notFound, ok, serverError } from '@/lib/api-response'
import { requireRoles, getRequestUser } from '@/lib/rbac'

type RouteContext = { params: Promise<{ id: string }> }

const CreateScheduleSchema = z.object({
  description:  z.string().min(1, '점검 내용은 필수입니다.').max(200),
  intervalDays: z.coerce.number().int().min(1, '주기는 1일 이상이어야 합니다.'),
  nextDueAt:    z.string().min(1, '다음 점검일은 필수입니다.'),
})

// GET /api/assets/:id/maintenance-schedules
export async function GET(request: NextRequest, { params }: RouteContext) {
  const authError = await requireRoles(request, ['ADMIN', 'MANAGER', 'STAFF'])
  if (authError) return authError
  try {
    const { id } = await params
    const asset = await prisma.asset.findUnique({ where: { id, deletedAt: null } })
    if (!asset) return notFound('Asset')

    const schedules = await prisma.maintenanceSchedule.findMany({
      where: { assetId: id },
      orderBy: { nextDueAt: 'asc' },
    })
    return ok(schedules)
  } catch (error) {
    return serverError(error)
  }
}

// POST /api/assets/:id/maintenance-schedules — ADMIN/MANAGER 전용
export async function POST(request: NextRequest, { params }: RouteContext) {
  const sessionUser = await getRequestUser(request)
  if (!sessionUser) return new Response(JSON.stringify({ error: '인증이 필요합니다.' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  if (!['ADMIN', 'MANAGER'].includes(sessionUser.role)) return new Response(JSON.stringify({ error: '권한이 없습니다.' }), { status: 403, headers: { 'Content-Type': 'application/json' } })

  try {
    const { id } = await params
    const asset = await prisma.asset.findUnique({ where: { id, deletedAt: null } })
    if (!asset) return notFound('Asset')

    const body = await request.json()
    const parsed = CreateScheduleSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest(parsed.error.issues.map((e: { message: string }) => e.message).join(', '))
    }
    const { description, intervalDays, nextDueAt } = parsed.data

    const schedule = await prisma.maintenanceSchedule.create({
      data: {
        assetId: id,
        description,
        intervalDays,
        nextDueAt: new Date(nextDueAt),
      },
    })
    return created(schedule)
  } catch (error) {
    return serverError(error)
  }
}
