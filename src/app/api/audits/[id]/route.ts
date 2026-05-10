export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notFound, ok, serverError } from '@/lib/api-response'
import { requireRoles, getRequestUser } from '@/lib/rbac'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/audits/:id — 실사 상세 (아이템 포함)
export async function GET(request: NextRequest, { params }: RouteContext) {
  const authError = await requireRoles(request, ['ADMIN', 'MANAGER', 'STAFF'])
  if (authError) return authError
  try {
    const { id } = await params
    const audit = await prisma.assetAudit.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            asset: { select: { id: true, code: true, name: true, department: true, location: true, category: true } },
          },
          orderBy: [{ result: 'asc' }, { asset: { name: 'asc' } }],
        },
      },
    })
    if (!audit) return notFound('Audit')
    return ok(audit)
  } catch (error) {
    return serverError(error)
  }
}

// PATCH /api/audits/:id — 실사 완료 처리
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const sessionUser = await getRequestUser(request)
  if (!sessionUser) return new Response(JSON.stringify({ error: '인증이 필요합니다.' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  if (!['ADMIN', 'MANAGER'].includes(sessionUser.role)) return new Response(JSON.stringify({ error: '권한이 없습니다.' }), { status: 403, headers: { 'Content-Type': 'application/json' } })

  try {
    const { id } = await params
    const audit  = await prisma.assetAudit.findUnique({ where: { id } })
    if (!audit) return notFound('Audit')

    const updated = await prisma.assetAudit.update({
      where: { id },
      data:  { status: 'COMPLETED', endDate: new Date() },
    })
    return ok(updated)
  } catch (error) {
    return serverError(error)
  }
}
