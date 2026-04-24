import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { badRequest, created, ok, serverError } from '@/lib/api-response'
import { ApprovalStatus, ApprovalType } from '@/generated/prisma/enums'

const CreateApprovalSchema = z.object({
  title:       z.string().min(1, '결재 제목은 필수입니다.'),
  type:        z.nativeEnum(ApprovalType),
  applicantId: z.string().min(1, '기안자 ID는 필수입니다.'),
  assetIds:    z.array(z.string()).optional(),
  reason:      z.string().optional(),
  approverId:  z.string().optional(),
})

// GET /api/approvals
// Query params: status, type, applicantId, approverId, department
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const status = searchParams.get('status') as ApprovalStatus | null
    const type = searchParams.get('type') ?? undefined
    const applicantId = searchParams.get('applicantId') ?? undefined
    const approverId = searchParams.get('approverId') ?? undefined
    const department = searchParams.get('department') ?? undefined

    // manager용: 본인 부서 기안 OR 본인이 결재자인 건 (OR 조건)
    const whereOr = department && approverId
      ? {
          OR: [
            { applicant: { department } },
            { approverId },
          ],
        }
      : undefined

    const approvals = await prisma.approval.findMany({
      where: whereOr ?? {
        ...(status && { status }),
        ...(type && { type: type as never }),
        ...(applicantId && { applicantId }),
        ...(approverId && { approverId }),
      },
      include: {
        applicant: { select: { id: true, name: true, department: true } },
        approver: { select: { id: true, name: true } },
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

// POST /api/approvals
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = CreateApprovalSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest(parsed.error.issues.map((e: { message: string }) => e.message).join(', '))
    }
    const { title, type, applicantId, assetIds, reason, approverId } = parsed.data

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
