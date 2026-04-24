import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest, notFound, ok, serverError } from '@/lib/api-response'
import { requireRoles } from '@/lib/rbac'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/assets/:id
export async function GET(_request: NextRequest, { params }: RouteContext) {
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
  const authError = await requireRoles(request, ['ADMIN', 'MANAGER'])
  if (authError) return authError
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.asset.findUnique({ where: { id } })
    if (!existing || existing.deletedAt) return notFound('Asset')

    const { name, category, department, location, status, price, acquiredDate, warrantyDate, barcode, remarks } = body

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
        ...(warrantyDate !== undefined && { warrantyDate: warrantyDate ? new Date(warrantyDate) : null }),
        ...(barcode  !== undefined     && { barcode:  barcode  || null }),
        ...(remarks  !== undefined     && { remarks:  remarks  || null }),
      },
    })

    return ok(asset)
  } catch (error) {
    return serverError(error)
  }
}

// DELETE /api/assets/:id — admin만 허용 (소프트 삭제)
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const authError = await requireRoles(request, ['ADMIN'])
  if (authError) return authError
  try {
    const { id } = await params
    const existing = await prisma.asset.findUnique({ where: { id } })
    if (!existing || existing.deletedAt) return notFound('Asset')

    // 소프트 삭제: deletedAt 설정 (물리 삭제 금지 — 감사 이력 보존)
    await prisma.asset.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    return ok({ deleted: true, id })
  } catch (error) {
    return serverError(error)
  }
}
