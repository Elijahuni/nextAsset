export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { badRequest, created, ok, serverError } from '@/lib/api-response'
import { AssetCategory, AssetStatus } from '@prisma/client'
import { statusGroupToEnums } from '@/lib/utils'
import { requireRoles, getRequestUser } from '@/lib/rbac'

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
  subCategory:  z.string().max(100).optional(),
  description:  z.string().max(500).optional(),
  size:         z.string().max(50).optional(),
  color:        z.string().max(50).optional(),
  assignedTo:   z.string().max(100).optional(),
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

    // ── 고급 필터 파라미터 ─────────────────────────────────────────────────────
    const dateFrom = searchParams.get('dateFrom')   // YYYY-MM-DD
    const dateTo   = searchParams.get('dateTo')
    const priceMin = searchParams.get('priceMin')
    const priceMax = searchParams.get('priceMax')
    const warrantyFilter = searchParams.get('warranty') === '1'

    // 취득일 범위 (양쪽 유효할 때만 적용)
    const acquiredDateFilter = (() => {
      const from = dateFrom ? new Date(dateFrom) : null
      const to   = dateTo   ? new Date(`${dateTo}T23:59:59`) : null
      if (from && to)  return { gte: from, lte: to }
      if (from)        return { gte: from }
      if (to)          return { lte: to }
      return null
    })()

    // 가격 범위
    const priceFilter = (() => {
      const mn = priceMin ? Number(priceMin) : null
      const mx = priceMax ? Number(priceMax) : null
      if (mn !== null && !isNaN(mn) && mx !== null && !isNaN(mx)) return { gte: mn, lte: mx }
      if (mn !== null && !isNaN(mn)) return { gte: mn }
      if (mx !== null && !isNaN(mx)) return { lte: mx }
      return null
    })()

    // 보증 만료 임박 (30일 이내)
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    const where = {
      deletedAt: null,           // 소프트 삭제된 자산 제외
      ...(q && {
        OR: [
          { name:        { contains: q, mode: 'insensitive' as const } },
          { code:        { contains: q, mode: 'insensitive' as const } },
          { department:  { contains: q, mode: 'insensitive' as const } },
          { barcode:     { contains: q, mode: 'insensitive' as const } },
          { subCategory: { contains: q, mode: 'insensitive' as const } },
          { description: { contains: q, mode: 'insensitive' as const } },
          { assignedTo:  { contains: q, mode: 'insensitive' as const } },
          { location:    { contains: q, mode: 'insensitive' as const } },
        ],
      }),
      ...(department && { department }),
      // 개별 상태 vs 그룹 상태 — 둘 다 있으면 개별 우선
      ...(status      ? { status } : activeEnums.length ? { status: { in: activeEnums as AssetStatus[] } } : {}),
      ...(category   && { category }),
      ...(acquiredDateFilter && { acquiredDate: acquiredDateFilter }),
      ...(priceFilter        && { price:        priceFilter }),
      ...(warrantyFilter     && { warrantyDate: { not: null, lte: thirtyDaysFromNow } }),
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

    // ── 하위 호환: page 파라미터 없으면 전체 배열 반환 (보고서/감가상각 등 전수 조회용)
    if (!searchParams.has('page')) {
      const assets = await prisma.asset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      })
      return ok(assets)
    }

    // ── 페이지네이션 ──────────────────────────────────────────────────
    const page  = Math.max(1, Number(searchParams.get('page')  ?? '1'))
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') ?? '50')))

    const STORAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/asset-files`

    const [total, rawData, allDepts] = await prisma.$transaction([
      prisma.asset.count({ where }),
      prisma.asset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          files: {
            where:   { mimeType: { startsWith: 'image/' } },
            take:    1,
            orderBy: { createdAt: 'asc' },
            select:  { storagePath: true },
          },
        },
      }),
      // 부서 목록 전체 조회 (필터 드롭다운용, 페이지네이션 무관)
      prisma.asset.findMany({
        select:   { department: true },
        distinct: ['department'],
        orderBy:  { department: 'asc' },
      }),
    ])

    const data = rawData.map(({ files, ...asset }) => ({
      ...asset,
      thumbnail: files[0] ? `${STORAGE_BASE}/${files[0].storagePath}` : null,
    }))

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
  // getRequestUser로 인증+역할 통합 (HistoryLog용 userId 동시 확보)
  const sessionUser = await getRequestUser(request)
  if (!sessionUser) return new Response(JSON.stringify({ error: '인증이 필요합니다.' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  if (!['ADMIN', 'MANAGER'].includes(sessionUser.role)) return new Response(JSON.stringify({ error: '권한이 없습니다.' }), { status: 403, headers: { 'Content-Type': 'application/json' } })

  try {
    const body   = await request.json()
    const parsed = CreateAssetSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest(parsed.error.issues.map((e: { message: string }) => e.message).join(', '))
    }
    const { code, name, category, department, location, price, acquiredDate, barcode, warrantyDate, remarks, subCategory, description, size, color, assignedTo } = parsed.data

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
        ...(subCategory  && { subCategory }),
        ...(description  && { description }),
        ...(size         && { size }),
        ...(color        && { color }),
        ...(assignedTo   && { assignedTo }),
      },
    })

    // 신규 등록 HistoryLog
    await prisma.historyLog.create({
      data: {
        assetId: asset.id,
        userId:  sessionUser.id,
        type:    'STATUS_CHANGED',
        detail:  `[자산 등록] ${asset.name} (${asset.code}) 신규 등록 — 부서: ${department}, 위치: ${location}${assignedTo ? `, 담당자: ${assignedTo}` : ''}`,
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
