export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { ok, serverError } from '@/lib/api-response'
import { getRequestUser } from '@/lib/rbac'

// GET /api/auth/me — 현재 로그인 사용자 정보 (DB users 테이블 기반)
// 미들웨어에서 401을 처리하므로 여기서는 단순 조회만 수행
export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request)
    if (!user) {
      return new Response(JSON.stringify({ error: '인증된 사용자를 찾을 수 없습니다.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return ok(user)
  } catch (error) {
    return serverError(error)
  }
}
