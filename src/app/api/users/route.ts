import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, serverError } from '@/lib/api-response'
import { requireRoles } from '@/lib/rbac'

// GET /api/users — 사용자 목록 (결재자 선택 등에 사용)
// 모든 인증된 사용자(ADMIN/MANAGER/STAFF)가 조회 가능
export async function GET(request: NextRequest) {
  const authError = await requireRoles(request, ['ADMIN', 'MANAGER', 'STAFF'])
  if (authError) return authError
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, department: true },
      orderBy: { name: 'asc' },
    })
    return ok(users)
  } catch (error) {
    return serverError(error)
  }
}
