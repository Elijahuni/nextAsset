export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { badRequest, created, ok, serverError } from '@/lib/api-response'
import { requireRoles, getRequestUser } from '@/lib/rbac'

const CreateAuditSchema = z.object({
  name: z.string().min(1, '실사명은 필수입니다.').max(100),
})

// GET /api/audits — 실사 목록 (진행률 포함)
export async function GET(request: NextRequest) {
  const authError = await requireRoles(request, ['ADMIN', 'MANAGER', 'STAFF'])
  if (authError) return authError
  try {
    const audits = await prisma.assetAudit.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { items: true } },
        items:  { select: { result: true } },
      },
    })

    const result = audits.map((a) => {
      const total     = a._count.items
      const confirmed = a.items.filter((i) => i.result === 'CONFIRMED').length
      const missing   = a.items.filter((i) => i.result === 'MISSING').length
      const surplus   = a.items.filter((i) => i.result === 'SURPLUS').length
      const pending   = a.items.filter((i) => i.result === 'PENDING').length
      const rate      = total > 0 ? Math.round(((confirmed + missing + surplus) / total) * 100) : 0
      return { ...a, items: undefined, total, confirmed, missing, surplus, pending, rate }
    })

    return ok(result)
  } catch (error) {
    return serverError(error)
  }
}

// POST /api/audits — 실사 생성 (ADMIN/MANAGER)
export async function POST(request: NextRequest) {
  const sessionUser = await getRequestUser(request)
  if (!sessionUser) return new Response(JSON.stringify({ error: '인증이 필요합니다.' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  if (!['ADMIN', 'MANAGER'].includes(sessionUser.role)) return new Response(JSON.stringify({ error: '권한이 없습니다.' }), { status: 403, headers: { 'Content-Type': 'application/json' } })

  try {
    const body   = await request.json()
    const parsed = CreateAuditSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues.map((e: { message: string }) => e.message).join(', '))

    // 현재 활성 자산 스냅샷
    const assets = await prisma.asset.findMany({
      where: { deletedAt: null },
      select: { id: true },
    })

    const audit = await prisma.assetAudit.create({
      data: {
        name:      parsed.data.name,
        startDate: new Date(),
        createdBy: sessionUser.name,
        items: {
          create: assets.map((a) => ({ assetId: a.id })),
        },
      },
    })

    return created(audit)
  } catch (error) {
    return serverError(error)
  }
}
