export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { badRequest, notFound, ok, serverError } from '@/lib/api-response'
import { getRequestUser } from '@/lib/rbac'

type RouteContext = { params: Promise<{ id: string; assetId: string }> }

const UpdateItemSchema = z.object({
  result: z.enum(['CONFIRMED', 'MISSING', 'SURPLUS']),
  note:   z.string().max(200).optional(),
})

// PATCH /api/audits/:id/items/:assetId — 실사 결과 기록
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const sessionUser = await getRequestUser(request)
  if (!sessionUser) return new Response(JSON.stringify({ error: '인증이 필요합니다.' }), { status: 401, headers: { 'Content-Type': 'application/json' } })

  try {
    const { id, assetId } = await params

    const audit = await prisma.assetAudit.findUnique({ where: { id } })
    if (!audit)                   return notFound('Audit')
    if (audit.status === 'COMPLETED') return badRequest('완료된 실사는 수정할 수 없습니다.')

    const body   = await request.json()
    const parsed = UpdateItemSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues.map((e: { message: string }) => e.message).join(', '))

    const item = await prisma.assetAuditItem.updateMany({
      where: { auditId: id, assetId },
      data: {
        result:    parsed.data.result,
        note:      parsed.data.note ?? null,
        auditedBy: sessionUser.name,
        auditedAt: new Date(),
      },
    })

    if (item.count === 0) return notFound('AuditItem')
    return ok({ updated: true })
  } catch (error) {
    return serverError(error)
  }
}
