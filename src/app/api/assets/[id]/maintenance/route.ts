export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { badRequest, created, notFound, ok, serverError } from '@/lib/api-response'
import { requireRoles, getRequestUser } from '@/lib/rbac'

type RouteContext = { params: Promise<{ id: string }> }

const CreateMaintenanceSchema = z.object({
  date:   z.string().min(1, '날짜는 필수입니다.'),
  vendor: z.string().min(1, '업체명은 필수입니다.').max(100),
  cost:   z.coerce.number().nonnegative('비용은 0 이상이어야 합니다.'),
  detail: z.string().min(1, '내용은 필수입니다.').max(1000),
})

// GET /api/assets/:id/maintenance — 모든 인증 사용자 조회 가능
export async function GET(request: NextRequest, { params }: RouteContext) {
  const authError = await requireRoles(request, ['ADMIN', 'MANAGER', 'STAFF'])
  if (authError) return authError
  try {
    const { id } = await params
    const asset = await prisma.asset.findUnique({ where: { id } })
    if (!asset) return notFound('Asset')

    const logs = await prisma.maintenanceLog.findMany({
      where: { assetId: id },
      orderBy: { date: 'desc' },
    })
    return ok(logs)
  } catch (error) {
    return serverError(error)
  }
}

// POST /api/assets/:id/maintenance — admin·manager만 등록 가능
export async function POST(request: NextRequest, { params }: RouteContext) {
  const sessionUser = await getRequestUser(request)
  if (!sessionUser) return new Response(JSON.stringify({ error: '인증이 필요합니다.' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  if (!['ADMIN', 'MANAGER'].includes(sessionUser.role)) return new Response(JSON.stringify({ error: '권한이 없습니다.' }), { status: 403, headers: { 'Content-Type': 'application/json' } })

  try {
    const { id } = await params
    const body = await request.json()
    const parsed = CreateMaintenanceSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest(parsed.error.issues.map((e: { message: string }) => e.message).join(', '))
    }
    const { date, vendor, cost, detail } = parsed.data

    const asset = await prisma.asset.findUnique({ where: { id } })
    if (!asset) return notFound('Asset')

    const log = await prisma.maintenanceLog.create({
      data: {
        assetId: id,
        date: new Date(date),
        vendor,
        cost,
        detail,
      },
    })

    // 유지보수 HistoryLog
    await prisma.historyLog.create({
      data: {
        assetId: id,
        userId:  sessionUser.id,
        type:    'MAINTAINED',
        detail:  `[유지보수 등록] ${detail} (업체: ${vendor}, 비용: ${Number(cost).toLocaleString()}원)`,
      },
    })

    return created(log)
  } catch (error) {
    return serverError(error)
  }
}
