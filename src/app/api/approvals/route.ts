export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { badRequest, created, ok, serverError } from '@/lib/api-response'
import { ApprovalStatus, ApprovalType } from '@/generated/prisma/enums'
import type { Prisma } from '@/generated/prisma/client'
import { getRequestUser } from '@/lib/rbac'

const VALID_APPROVAL_STATUSES = new Set(Object.values(ApprovalStatus))
const VALID_APPROVAL_TYPES    = new Set(Object.values(ApprovalType))

const CreateApprovalSchema = z.object({
  title:       z.string().min(1, '결재 제목은 필수입니다.'),
  type:        z.nativeEnum(ApprovalType),
  // applicantId는 세션에서 추출하므로 schema에서 제외 (클라이언트가 보내도 무시됨)
  assetIds:    z.array(z.string()).optional(),
  reason:      z.string().optional(),
  approverId:  z.string().optional(),
})

// GET /api/approvals
// Query params (ADMIN only): status, type, applicantId, approverId
// STAFF/MANAGER의 조회 범위는 서버에서 role 기반으로 강제 — 클라이언트 파라미터 무시 (IDOR 방지)
export async function GET(request: NextRequest) {
  const sessionUser = await getRequestUser(request)
  if (!sessionUser) {
    return new Response(JSON.stringify({ error: '인증이 필요합니다.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    const { searchParams } = request.nextUrl
    const rawStatus = searchParams.get('status')
    const rawType   = searchParams.get('type')
    // enum 화이트리스트 검증
    const status = rawStatus && VALID_APPROVAL_STATUSES.has(rawStatus as ApprovalStatus) ? rawStatus as ApprovalStatus : null
    const type   = rawType   && VALID_APPROVAL_TYPES.has(rawType as ApprovalType)        ? rawType as ApprovalType    : undefined

    let where: Prisma.ApprovalWhereInput

    if (sessionUser.role === 'STAFF') {
      // STAFF: 본인 기안만 조회 — applicantId 파라미터 무시
      where = {
        applicantId: sessionUser.id,
        ...(status && { status }),
        ...(type && { type }),
      }
    } else if (sessionUser.role === 'MANAGER') {
      // MANAGER: 본인 부서 기안 OR 본인이 결재자인 건 + status/type 필터 적용 (AND)
      where = {
        AND: [
          {
            OR: [
              { applicant: { department: sessionUser.department } },
              { approverId: sessionUser.id },
            ],
          },
          ...(status ? [{ status }] : []),
          ...(type   ? [{ type }]   : []),
        ],
      }
    } else {
      // ADMIN: 전체 조회 허용, 클라이언트 파라미터 신뢰
      const applicantId = searchParams.get('applicantId') ?? undefined
      const approverId  = searchParams.get('approverId')  ?? undefined
      where = {
        ...(status      && { status }),
        ...(type        && { type }),
        ...(applicantId && { applicantId }),
        ...(approverId  && { approverId }),
      }
    }

    const approvals = await prisma.approval.findMany({
      where,
      include: {
        applicant: { select: { id: true, name: true, department: true } },
        approver:  { select: { id: true, name: true } },
        assets: {
          include: {
            asset: { select: { id: true, code: true, name: true, status: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return ok(approvals)
  } catch (error) {
    return serverError(error)
  }
}

// POST /api/approvals — 모든 인증 사용자 기안 가능. applicantId는 세션 사용자로 강제 (위/변조 방지)
export async function POST(request: NextRequest) {
  const sessionUser = await getRequestUser(request)
  if (!sessionUser) {
    return new Response(JSON.stringify({ error: '인증이 필요합니다.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    const body = await request.json()
    const parsed = CreateApprovalSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest(parsed.error.issues.map((e: { message: string }) => e.message).join(', '))
    }
    // applicantId는 클라이언트가 보내더라도 세션 사용자로 강제 — 타인 명의 기안 방지
    const { title, type, assetIds, reason, approverId } = parsed.data
    const applicantId = sessionUser.id

    // assetIds 선택적 — 단독 기안 허용
    const ids: string[] = Array.isArray(assetIds) ? assetIds : []

    if (ids.length > 0) {
      const assets = await prisma.asset.findMany({ where: { id: { in: ids } } })
      if (assets.length !== ids.length) {
        return badRequest('하나 이상의 자산 ID가 유효하지 않습니다.')
      }
    }

    const approval = await prisma.approval.create({
      data: {
        title,
        type,
        applicantId,
        ...(reason && { reason }),
        ...(approverId && { approverId }),
        ...(ids.length > 0 && {
          assets: { create: ids.map((assetId: string) => ({ assetId })) },
        }),
      },
      include: {
        applicant: { select: { id: true, name: true, department: true } },
        assets: {
          include: {
            asset: { select: { id: true, code: true, name: true, status: true } },
          },
        },
      },
    })

    return created(approval)
  } catch (error) {
    return serverError(error)
  }
}
