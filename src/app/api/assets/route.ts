import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest, created, ok, serverError } from '@/lib/api-response'
import { AssetCategory, AssetStatus } from '@/generated/prisma/enums'

// GET /api/assets
// Query params: department, status, category
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const department = searchParams.get('department') ?? undefined
    const status = searchParams.get('status') as AssetStatus | null
    const category = searchParams.get('category') as AssetCategory | null

    const assets = await prisma.asset.findMany({
      where: {
        ...(department && { department }),
        ...(status && { status }),
        ...(category && { category }),
      },
      orderBy: { createdAt: 'desc' },
    })

    return ok(assets)
  } catch (error) {
    return serverError(error)
  }
}

// POST /api/assets
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, name, category, department, location, price, acquiredDate, barcode, warrantyDate } = body

    if (!code || !name || !category || !department || !location || price == null || !acquiredDate) {
      return badRequest('code, name, category, department, location, price, acquiredDate are required')
    }

    const asset = await prisma.asset.create({
      data: {
        code,
        name,
        category,
        department,
        location,
        price,
        acquiredDate: new Date(acquiredDate),
        ...(barcode && { barcode }),
        ...(warrantyDate && { warrantyDate: new Date(warrantyDate) }),
      },
    })

    return created(asset)
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return badRequest('Asset code or barcode already exists')
    }
    return serverError(error)
  }
}
