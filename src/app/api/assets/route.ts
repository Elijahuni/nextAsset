import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { badRequest, created, ok, serverError } from '@/lib/api-response'
import { AssetCategory, AssetStatus } from '@/generated/prisma/enums'

const CreateAssetSchema = z.object({
  code:         z.string().min(1, '자산코드는 필수입니다.'),
  name:         z.string().min(1, '자산명은 필수입니다.'),
  category:     z.nativeEnum(AssetCategory),
  department:   z.string().min(1, '부서는 필수입니다.'),
  location:     z.string().min(1, '위치는 필수입니다.'),
  price:        z.coerce.number().nonnegative('취득가액은 0 이상이어야 합니다.'),
  acquiredDate: z.string().min(1, '취득일은 필수입니다.'),
  barcode:      z.string().optional(),
  warrantyDate: z.string().optional(),
})

// GET /api/assets
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
    const parsed = CreateAssetSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest(parsed.error.issues.map((e: { message: string }) => e.message).join(', '))
    }
    const { code, name, category, department, location, price, acquiredDate, barcode, warrantyDate } = parsed.data

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
      return badRequest('이미 존재하는 자산코드 또는 바코드입니다.')
    }
    return serverError(error)
  }
}
