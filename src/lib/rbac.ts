/**
 * RBAC (Role-Based Access Control) 헬퍼
 *
 * 미들웨어는 인증(Authentication)만 담당하고,
 * 개별 API 라우트에서 이 헬퍼로 역할 권한(Authorization)을 검사합니다.
 *
 * 역할 계층:
 *   ADMIN   → 모든 작업 가능
 *   MANAGER → 자산 생성/수정, 결재 승인/반려 가능
 *   STAFF   → 조회 + 결재 기안만 가능
 */

import '@/lib/env'  // 필수 환경변수 검증 — 서버 시작 시 누락 즉시 에러
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { prisma } from './prisma'

export type AllowedRole = 'ADMIN' | 'MANAGER' | 'STAFF'

/** 요청 쿠키에서 Supabase 세션을 읽어 DB 사용자 정보를 반환합니다. */
export async function getRequestUser(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {}, // 읽기 전용 — 쓰기 불필요
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) return null

  // Supabase auth.users.id (UUID) ≠ public.users.id (cuid) 이므로 email로 매칭
  return prisma.user.findUnique({
    where: { email: user.email },
    select: { id: true, name: true, email: true, role: true, department: true },
  })
}

/**
 * 허용 역할 목록과 비교해 권한이 없으면 403 응답을 반환합니다.
 * null을 반환하면 통과(OK)입니다.
 *
 * @example
 * const authError = await requireRoles(request, ['ADMIN', 'MANAGER'])
 * if (authError) return authError
 */
export async function requireRoles(
  request: NextRequest,
  roles: AllowedRole[],
): Promise<NextResponse | null> {
  const user = await getRequestUser(request)

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  if (!roles.includes(user.role as AllowedRole)) {
    return NextResponse.json(
      { error: `권한이 없습니다. (필요 권한: ${roles.join(' | ')})` },
      { status: 403 },
    )
  }

  return null // 통과
}
