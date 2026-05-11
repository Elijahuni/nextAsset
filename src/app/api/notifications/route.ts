export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, serverError } from '@/lib/api-response'
import { getRequestUser } from '@/lib/rbac'

// GET /api/notifications — 내 알림 최신 30건
export async function GET(request: NextRequest) {
  const sessionUser = await getRequestUser(request)
  if (!sessionUser) {
    return new Response(JSON.stringify({ error: '인증이 필요합니다.' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    const notifications = await prisma.notification.findMany({
      where:   { userId: sessionUser.id },
      orderBy: { createdAt: 'desc' },
      take:    30,
    })
    return ok(notifications)
  } catch (e) {
    return serverError(e)
  }
}

// PATCH /api/notifications — 내 알림 전체 읽음 처리
export async function PATCH(request: NextRequest) {
  const sessionUser = await getRequestUser(request)
  if (!sessionUser) {
    return new Response(JSON.stringify({ error: '인증이 필요합니다.' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    await prisma.notification.updateMany({
      where: { userId: sessionUser.id, readAt: null },
      data:  { readAt: new Date() },
    })
    return ok({ success: true })
  } catch (e) {
    return serverError(e)
  }
}
