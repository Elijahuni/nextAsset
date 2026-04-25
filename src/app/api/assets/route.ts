import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { badRequest, created, ok, serverError } from '@/lib/api-response'
import { AssetCategory, AssetStatus } from '@/generated/prisma/enums'
import { statusGroupToEnums } from '@/lib/utils'
import { requireRoles } from '@/lib/rbac'

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
  remarks:      z.string().optional(),
})

// 유효한 enum 값 화이트리스트
const VALID_STATUSES  = new Set(Object.values(AssetStatus))
const VALID_CATEGORIES = new Set(Object.values(AssetCategory))

// GET /api/assets
// ?q=검색어&status=&category=&department=&page=1&limit=50
// ▸ page 파라미터가 없으면 전체 배열 반환 (Dashboard 하위 호환)
// ▸ page 파라미터가 있으면 페이지네이션 객체 반환
export async function GET(request: NextRequest) {
  const authError = await requireRoles(request, ['ADMIN', 'MANAGER', 'STAFF'])
  if (authError) return authError
  try {
    const { searchParams } = request.nextUrl
    const department  = searchParams.get('department') ?? undefined
    const rawStatus   = searchParams.get('status')
    const rawCategory = searchParams.get('category')
    // enum 화이트리스트 검증 — 잘못된 값은 무시
    const status   = rawStatus   && VALID_STATUSES.has(rawStatus as AssetStatus)   ? rawStatus as AssetStatus   : null
    const category = rawCategory && VALID_CATEGORIES.has(rawCategory as AssetCategory) ? rawCategory as AssetCategory : null
    const q           = searchParams.get('q')?.trim() ?? ''
    // TW-AMS 호환: ?active=active|inactive → 상태 그룹 필터
    const activeGroup = searchParams.get('active') as 'active' | 'inactive' | null
    const activeEnums = activeGroup ? statusGroupToEnums(activeGroup) : []

    const where = {
      deletedAt: null,           // 소프트 삭제된 자산 제외
      ...(q && {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { code: { contains: q, mode: 'insensitive' as const } },
          // 사업장(department) · 시리얼번호(barcode) 검색 포함
          { department: { contains: q, mode: 'insensitive' as const } },
          { barcode:    { contains: q, mode: 'insensitive' as const } },
        ],
      }),
      ...(department && { department }),
      // 개별 상태 vs 그룹 상태 — 둘 다 있으면 개별 우선
      ...(status      ? { status } : activeEnums.length ? { status: { in: activeEnums as AssetStatus[] } } : {}),
      ...(category   && { category }),
    }

    // ── 보증기간 임박·만료 자산만 빠르게 반환 (Header 알림 전용) ──────────
    if (searchParams.get('warrantyExpiring') === 'true') {
      const thirtyDaysLater = new Date()
      thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30)
      const expiring = await prisma.asset.findMany({
        where: {
          deletedAt:   null,
          warrantyDate: { not: null, lte: thirtyDaysLater },
        },
        select: { id: true, name: true, warrantyDate: true, status: true },
        orderBy: { warrantyDate: 'asc' },
        take: 20,
      })
      return ok(expiring)
    }

    // ── 하위 호환: page 파라미터 없으면 전체 배열 반환 (최대 300건 캡) ──
    if (!searchParams.has('page')) {
      const assets = await prisma.asset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 300,
      })
      return ok(assets)
    }

    // ── 페이지네이션 ──────────────────────────────────────────────────
    const page  = Math.max(1, Number(searchParams.get('page')  ?? '1'))
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') ?? '50')))

    const [total, data, allDepts] = await prisma.$transaction([
      prisma.asset.count({ where }),
      prisma.asset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      // 부서 목록 전체 조회 (필터 드롭다운용, 페이지네이션 무관)
      prisma.asset.findMany({
        select:   { department: true },
        distinct: ['department'],
        orderBy:  { department: 'asc' },
      }),
    ])

    return ok({
      data,
      total,
      page,
      limit,
      totalPages:  Math.ceil(total / limit) || 1,
      departments: allDepts.map((d) => d.department),
    })
  } catch (error) {
    return serverError(error)
  }
}

// POST /api/assets — admin, manager만 허용
export async function POST(request: NextRequest) {
  const authError = await requireRoles(request, ['ADMIN', 'MANAGER'])
  if (authError) return authError
  try {
    const body   = await request.json()
    const parsed = CreateAssetSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest(parsed.error.issues.map((e: { message: string }) => e.message).join(', '))
    }
    const { code, name, category, department, location, price, acquiredDate, barcode, warrantyDate, remarks } = parsed.data

    const asset = await prisma.asset.create({
      data: {
        code,
        name,
        category,
        department,
        location,
        price,
        acquiredDate: new Date(acquiredDate),
        ...(barcode      && { barcode }),
        ...(warrantyDate && { warrantyDate: new Date(warrantyDate) }),
        ...(remarks      && { remarks }),
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
