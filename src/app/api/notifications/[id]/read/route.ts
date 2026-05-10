export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notFound, ok, serverError } from '@/lib/api-response'
import { getRequestUser } from '@/lib/rbac'

type RouteContext = { params: Promise<{ id: string }> }

// PATCH /api/notifications/[id]/read — 개별 알림 읽음 처리
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const sessionUser = await getRequestUser(request)
  if (!sessionUser) {
    return new Response(JSON.stringify({ error: '인증이 필요합니다.' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    const { id } = await params
    const notification = await prisma.notification.findFirst({
      where: { id, userId: sessionUser.id },
    })
    if (!notification) return notFound('알림')

    const updated = await prisma.notification.update({
      where: { id },
      data:  { readAt: new Date() },
    })
    return ok(updated)
  } catch (e) {
    return serverError(e)
  }
}
