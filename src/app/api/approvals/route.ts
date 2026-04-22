import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest, created, ok, serverError } from '@/lib/api-response'
import { ApprovalStatus } from '@/generated/prisma/enums'

// GET /api/approvals
// Query params: status, type, applicantId, approverId
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const status = searchParams.get('status') as ApprovalStatus | null
    const type = searchParams.get('type') ?? undefined
    const applicantId = searchParams.get('applicantId') ?? undefined
    const approverId = searchParams.get('approverId') ?? undefined

    const approvals = await prisma.approval.findMany({
      where: {
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
    const { title, type, applicantId, assetIds, reason, approverId } = body

    if (!title || !type || !applicantId || !Array.isArray(assetIds) || assetIds.length === 0) {
      return badRequest('title, type, applicantId, and assetIds (non-empty array) are required')
    }

    // Verify all assets exist
    const assets = await prisma.asset.findMany({ where: { id: { in: assetIds } } })
    if (assets.length !== assetIds.length) {
      return badRequest('One or more asset IDs are invalid')
    }

    const approval = await prisma.approval.create({
      data: {
        title,
        type,
        applicantId,
        ...(reason && { reason }),
        ...(approverId && { approverId }),
        assets: {
          create: assetIds.map((assetId: string) => ({ assetId })),
        },
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
