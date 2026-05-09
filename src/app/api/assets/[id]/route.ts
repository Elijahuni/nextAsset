export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { badRequest, notFound, ok, serverError } from '@/lib/api-response'
import { requireRoles, getRequestUser } from '@/lib/rbac'
import { AssetCategory, AssetStatus } from '@prisma/client'

type RouteContext = { params: Promise<{ id: string }> }

const PatchAssetSchema = z.object({
  name:         z.string().min(1).max(200).optional(),
  category:     z.nativeEnum(AssetCategory).optional(),
  department:   z.string().min(1).max(100).optional(),
  location:     z.string().min(1).max(200).optional(),
  status:       z.nativeEnum(AssetStatus).optional(),
  price:        z.number().nonnegative().optional(),
  acquiredDate: z.string().optional(),
  warrantyDate: z.string().nullable().optional(),
  barcode:      z.string().max(100).nullable().optional(),
  remarks:      z.string().max(1000).nullable().optional(),
  subCategory:  z.string().max(100).nullable().optional(),
  description:  z.string().max(500).nullable().optional(),
  size:         z.string().max(50).nullable().optional(),
  color:        z.string().max(50).nullable().optional(),
  assignedTo:   z.string().max(100).nullable().optional(),
})

// GET /api/assets/:id
export async function GET(request: NextRequest, { params }: RouteContext) {
  const authError = await requireRoles(request, ['ADMIN', 'MANAGER', 'STAFF'])
  if (authError) return authError
  try {
    const { id } = await params
    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        historyLogs: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { date: 'desc' },
        },
        maintenanceLogs: { orderBy: { date: 'desc' } },
      },
    })

    if (!asset || asset.deletedAt) return notFound('Asset')
    return ok(asset)
  } catch (error) {
    return serverError(error)
  }
}

// PATCH /api/assets/:id — admin, manager만 허용
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  // getRequestUser로 인증+역할 검사를 통합 (requireRoles와 이중 호출 방지)
  const sessionUser = await getRequestUser(request)
  if (!sessionUser) return new Response(JSON.stringify({ error: '인증이 필요합니다.' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  if (!['ADMIN', 'MANAGER'].includes(sessionUser.role)) return new Response(JSON.stringify({ error: '권한이 없습니다.' }), { status: 403, headers: { 'Content-Type': 'application/json' } })

  try {
    const { id } = await params
    const body = await request.json()

    const parsed = PatchAssetSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest(parsed.error.issues.map((e) => e.message).join(', '))
    }

    const existing = await prisma.asset.findUnique({ where: { id } })
    if (!existing || existing.deletedAt) return notFound('Asset')

    const { name, category, department, location, status, price, acquiredDate, warrantyDate, barcode, remarks, subCategory, description, size, color, assignedTo } = parsed.data

    const asset = await prisma.asset.update({
      where: { id },
      data: {
        ...(name        && { name }),
        ...(category    && { category }),
        ...(department  && { department }),
        ...(location    && { location }),
        ...(status      && { status }),
        ...(price != null && { price }),
        ...(acquiredDate && { acquiredDate: new Date(acquiredDate) }),
        ...(warrantyDate !== undefined  && { warrantyDate: warrantyDate ? new Date(warrantyDate) : null }),
        ...(barcode     !== undefined   && { barcode:      barcode     || null }),
        ...(remarks     !== undefined   && { remarks:      remarks     || null }),
        ...(subCategory !== undefined   && { subCategory:  subCategory || null }),
        ...(description !== undefined   && { description:  description || null }),
        ...(size        !== undefined   && { size:         size        || null }),
        ...(color       !== undefined   && { color:        color       || null }),
        ...(assignedTo  !== undefined   && { assignedTo:   assignedTo  || null }),
      },
    })

    // 변경 내역 HistoryLog 기록
    const changes: string[] = []
    if (status     && status     !== existing.status)     changes.push(`상태: ${existing.status} → ${status}`)
    if (department && department !== existing.department) changes.push(`부서: ${existing.department} → ${department}`)
    if (location   && location   !== existing.location)   changes.push(`위치: ${existing.location} → ${location}`)
    if (name       && name       !== existing.name)       changes.push(`자산명: ${existing.name} → ${name}`)
    if (assignedTo !== undefined && assignedTo !== existing.assignedTo) {
      changes.push(`담당자: ${existing.assignedTo ?? '없음'} → ${assignedTo ?? '없음'}`)
    }
    if (changes.length > 0) {
      const historyType = (status && status !== existing.status) ? 'STATUS_CHANGED' : 'STATUS_CHANGED'
      await prisma.historyLog.create({
        data: {
          assetId: id,
          userId:  sessionUser.id,
          type:    historyType,
          detail:  `[직접 수정] ${changes.join(', ')}`,
        },
      })
    }

    return ok(asset)
  } catch (error) {
    return serverError(error)
  }
}

// DELETE /api/assets/:id — admin만 허용 (소프트 삭제)
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const sessionUser = await getRequestUser(request)
  if (!sessionUser) return new Response(JSON.stringify({ error: '인증이 필요합니다.' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  if (sessionUser.role !== 'ADMIN') return new Response(JSON.stringify({ error: '권한이 없습니다.' }), { status: 403, headers: { 'Content-Type': 'application/json' } })

  try {
    const { id } = await params
    const existing = await prisma.asset.findUnique({ where: { id } })
    if (!existing || existing.deletedAt) return notFound('Asset')

    // 소프트 삭제: deletedAt 설정 (물리 삭제 금지 — 감사 이력 보존)
    await prisma.asset.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    // 삭제 HistoryLog 기록 (소프트 삭제이므로 CASCADE 되지 않음)
    await prisma.historyLog.create({
      data: {
        assetId: id,
        userId:  sessionUser.id,
        type:    'DISPOSED',
        detail:  `[자산 삭제] ${existing.name} (${existing.code}) 소프트 삭제 처리`,
      },
    })

    return ok({ deleted: true, id })
  } catch (error) {
    return serverError(error)
  }
}
