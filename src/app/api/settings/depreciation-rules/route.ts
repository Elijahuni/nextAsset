export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest, ok, serverError } from '@/lib/api-response'
import { requireRoles, getRequestUser } from '@/lib/rbac'
import { DEFAULT_DEPRECIATION_RULES } from '@/lib/depreciation'

const MASTER_TYPE = 'depreciation_rules'

// GET /api/settings/depreciation-rules — 인증된 모든 역할 조회 가능
export async function GET(request: NextRequest) {
  const authError = await requireRoles(request, ['ADMIN', 'MANAGER', 'STAFF'])
  if (authError) return authError
  try {
    const item = await prisma.masterItem.findFirst({ where: { type: MASTER_TYPE } })
    if (item) {
      try {
        return ok(JSON.parse(item.value))
      } catch {
        // 파싱 실패 시 기본값 반환
        return ok(DEFAULT_DEPRECIATION_RULES)
      }
    }
    return ok(DEFAULT_DEPRECIATION_RULES)
  } catch (error) {
    return serverError(error)
  }
}

// POST /api/settings/depreciation-rules — ADMIN·MANAGER만 저장 가능
export async function POST(request: NextRequest) {
  const sessionUser = await getRequestUser(request)
  if (!sessionUser) return new Response(JSON.stringify({ error: '인증이 필요합니다.' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  if (!['ADMIN', 'MANAGER'].includes(sessionUser.role)) return new Response(JSON.stringify({ error: '권한이 없습니다.' }), { status: 403, headers: { 'Content-Type': 'application/json' } })

  try {
    const body = await request.json()
    if (!body || typeof body !== 'object') return badRequest('규칙 데이터가 올바르지 않습니다.')

    const valueJson = JSON.stringify(body)

    // DELETE + CREATE 트랜잭션으로 단일 행 upsert (value가 unique constraint에 포함됨)
    await prisma.$transaction([
      prisma.masterItem.deleteMany({ where: { type: MASTER_TYPE } }),
      prisma.masterItem.create({ data: { type: MASTER_TYPE, value: valueJson } }),
    ])

    return ok(body)
  } catch (error) {
    return serverError(error)
  }
}
