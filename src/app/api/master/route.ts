export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, badRequest, serverError } from '@/lib/api-response'
import { requireRoles } from '@/lib/rbac'

type MasterKey = 'departments' | 'locations' | 'vendors' | 'categories'
const VALID_KEYS: MasterKey[] = ['departments', 'locations', 'vendors', 'categories']

// 파일시스템 폴백 (DB 테이블 미생성 시 기본값 반환)
const DEFAULT_DATA: Record<MasterKey, string[]> = {
  categories:  ['노트북', '데스크탑', '모니터', '사무가구', '차량', '기계장치', '소프트웨어'],
  departments: ['경영지원부', 'IT개발팀', '영업팀', '마케팅팀', '회계팀'],
  locations:   ['본사 1층', '본사 2층', '본사 3층', '본사 4층', '별관 A동', '창고'],
  vendors:     ['삼성전자 서비스', 'LG전자 서비스', 'Dell 코리아', '현대자동차'],
}

// GET /api/master — 인증된 사용자만 조회 가능, 5분 캐싱
export async function GET(request: NextRequest) {
  const authError = await requireRoles(request, ['ADMIN', 'MANAGER', 'STAFF'])
  if (authError) return authError
  try {
    const items = await prisma.masterItem.findMany({ orderBy: { value: 'asc' } })

    // type별로 그룹핑
    const grouped = items.reduce<Record<string, string[]>>((acc, item) => {
      if (!acc[item.type]) acc[item.type] = []
      acc[item.type].push(item.value)
      return acc
    }, {})

    const data = {
      categories:  grouped.categories  ?? DEFAULT_DATA.categories,
      departments: grouped.departments ?? DEFAULT_DATA.departments,
      locations:   grouped.locations   ?? DEFAULT_DATA.locations,
      vendors:     grouped.vendors     ?? DEFAULT_DATA.vendors,
    }

    const res = ok(data)
    res.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=60')
    return res
  } catch {
    // DB 테이블 미존재 시 기본값 반환 (배포 초기 방어)
    const res = NextResponse.json(DEFAULT_DATA, { status: 200 })
    res.headers.set('Cache-Control', 'no-store')
    return res
  }
}

// POST /api/master — admin만 허용
export async function POST(request: NextRequest) {
  const authError = await requireRoles(request, ['ADMIN'])
  if (authError) return authError
  try {
    const { type, value } = await request.json()

    if (!VALID_KEYS.includes(type as MasterKey) || !value?.trim()) {
      return badRequest('type과 value는 필수입니다.')
    }

    await prisma.masterItem.create({
      data: { type: type as MasterKey, value: value.trim() },
    })

    // 갱신된 전체 목록 반환
    return GET(request)
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return badRequest('이미 존재하는 항목입니다.')
    }
    return serverError(error)
  }
}

// DELETE /api/master — admin만 허용
export async function DELETE(request: NextRequest) {
  const authError = await requireRoles(request, ['ADMIN'])
  if (authError) return authError
  try {
    const { type, value } = await request.json()

    if (!VALID_KEYS.includes(type as MasterKey) || !value) {
      return badRequest('type과 value는 필수입니다.')
    }

    await prisma.masterItem.deleteMany({
      where: { type: type as MasterKey, value },
    })

    return GET(request)
  } catch (error) {
    return serverError(error)
  }
}
