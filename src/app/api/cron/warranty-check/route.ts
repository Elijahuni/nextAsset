export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, serverError } from '@/lib/api-response'
import { createNotifications } from '@/lib/notifications'

// GET /api/cron/warranty-check
// Vercel Cron이 매일 오전 9시(KST) 호출 — Authorization 헤더로 보호
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const thirtyDaysLater = new Date()
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30)

    // 보증 만료 임박 자산 조회 (30일 이내)
    const expiringAssets = await prisma.asset.findMany({
      where: {
        deletedAt:    null,
        warrantyDate: { not: null, lte: thirtyDaysLater },
      },
      select: { id: true, name: true, code: true, warrantyDate: true },
      orderBy: { warrantyDate: 'asc' },
      take: 50,
    })

    if (expiringAssets.length === 0) return ok({ notified: 0 })

    // ADMIN + MANAGER 전원에게 알림
    const managers = await prisma.user.findMany({
      where:  { role: { in: ['ADMIN', 'MANAGER'] } },
      select: { id: true },
    })
    const userIds = managers.map((u) => u.id)

    const today = new Date()
    for (const asset of expiringAssets) {
      const daysLeft = asset.warrantyDate
        ? Math.ceil((new Date(asset.warrantyDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : 0
      const isExpired = daysLeft < 0

      await createNotifications(userIds, {
        type:  'WARRANTY_EXPIRING',
        title: isExpired ? '보증기간 만료' : '보증기간 만료 임박',
        body:  isExpired
          ? `[${asset.code}] ${asset.name} 보증기간이 만료되었습니다.`
          : `[${asset.code}] ${asset.name} 보증기간이 ${daysLeft}일 후 만료됩니다.`,
        link:  `/assets`,
      })
    }

    return ok({ notified: expiringAssets.length })
  } catch (e) {
    return serverError(e)
  }
}
