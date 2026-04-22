import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest, notFound, ok, serverError } from '@/lib/api-response'

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

    if (!asset) return notFound('Asset')
    return ok(asset)
  } catch (error) {
    return serverError(error)
  }
}

// PATCH /api/assets/:id
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.asset.findUnique({ where: { id } })
    if (!existing) return notFound('Asset')

    const { name, category, department, location, status, price, acquiredDate, warrantyDate, barcode } = body

    const asset = await prisma.asset.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(category && { category }),
        ...(department && { department }),
        ...(location && { location }),
        ...(status && { status }),
        ...(price != null && { price }),
        ...(acquiredDate && { acquiredDate: new Date(acquiredDate) }),
        ...(warrantyDate !== undefined && { warrantyDate: warrantyDate ? new Date(warrantyDate) : null }),
        ...(barcode !== undefined && { barcode: barcode || null }),
      },
    })

    return ok(asset)
  } catch (error) {
    return serverError(error)
  }
}

// DELETE /api/assets/:id
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params

    const existing = await prisma.asset.findUnique({ where: { id } })
    if (!existing) return notFound('Asset')

    if (existing.status !== 'AVAILABLE') {
      return badRequest(`Cannot delete asset with status: ${existing.status}`)
    }

    await prisma.asset.delete({ where: { id } })
    return ok({ deleted: true, id })
  } catch (error) {
    return serverError(error)
  }
}
