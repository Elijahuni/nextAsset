import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest, notFound, ok, serverError } from '@/lib/api-response'
import type { ApprovalType, AssetStatus, HistoryType } from '@/generated/prisma/enums'
import { requireRoles } from '@/lib/rbac'

type RouteContext = { params: Promise<{ id: string }> }

// ApprovalType 별로 자산에 적용할 상태와 이력 타입을 결정
const APPROVAL_EFFECT: Record<
  ApprovalType,
  { assetStatus: AssetStatus; historyType: HistoryType; detailPrefix: string }
> = {
  PURCHASE:            { assetStatus: 'AVAILABLE',         historyType: 'STATUS_CHANGED', detailPrefix: '구매 결재 승인' },
  DISPOSAL:            { assetStatus: 'DISPOSED',          historyType: 'DISPOSED',       detailPrefix: '폐기 결재 승인' },
  TRANSFER:            { assetStatus: 'IN_USE',            historyType: 'TRANSFERRED',    detailPrefix: '이관 결재 승인' },
  MAINTENANCE_REQUEST: { assetStatus: 'UNDER_MAINTENANCE', historyType: 'MAINTAINED',     detailPrefix: '수리 결재 승인' },
  RENTAL:              { assetStatus: 'IN_USE',            historyType: 'ASSIGNED',       detailPrefix: '대여 결재 승인' },
}

// GET /api/approvals/:id
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params

    const approval = await prisma.approval.findUnique({
      where: { id },
      include: {
        applicant: { select: { id: true, name: true, department: true, role: true } },
        approver:  { select: { id: true, name: true, role: true } },
        assets: {
          include: {
            asset: {
              select: {
                id: true, code: true, name: true, category: true,
                department: true, status: true, location: true,
              },
            },
          },
        },
      },
    })

    if (!approval) return notFound('Approval')
    return ok(approval)
  } catch (error) {
    return serverError(error)
  }
}

// PATCH /api/approvals/:id
// APPROVED·REJECTED → admin·manager만 가능
// CANCELLED → 모든 인증 사용자 (기안자 본인 여부는 비즈니스 로직으로 처리)
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, approverId, reason } = body

    if (!status) return badRequest('status is required')

    const validStatuses = ['APPROVED', 'REJECTED', 'CANCELLED']
    if (!validStatuses.includes(status)) {
      return badRequest(`status must be one of: ${validStatuses.join(', ')}`)
    }

    // 승인·반려는 admin·manager 권한 필요
    if (status === 'APPROVED' || status === 'REJECTED') {
      const authError = await requireRoles(request, ['ADMIN', 'MANAGER'])
      if (authError) return authError
    }

    // Load current approval to validate state transition
    const existing = await prisma.approval.findUnique({
      where: { id },
      include: {
        assets: { select: { assetId: true } },
      },
    })

    if (!existing) return notFound('Approval')
    if (existing.status !== 'PENDING') {
      return badRequest(`Approval is already ${existing.status} and cannot be updated`)
    }
    if (status === 'APPROVED' && !approverId) {
      return badRequest('approverId is required when approving')
    }

    // ── Approval 처리 ──────────────────────────────────────────────────────
    if (status === 'APPROVED') {
      const effect = APPROVAL_EFFECT[existing.type]
      const assetIds = existing.assets.map((a) => a.assetId)

      const result = await prisma.$transaction(async (tx) => {
        // 1. 결재 상태 업데이트
        const approval = await tx.approval.update({
          where: { id },
          data: {
            status: 'APPROVED',
            approverId,
            ...(reason !== undefined && { reason }),
          },
          include: {
            applicant: { select: { id: true, name: true, department: true } },
            approver:  { select: { id: true, name: true } },
            assets: {
              include: {
                asset: { select: { id: true, code: true, name: true, status: true } },
              },
            },
          },
        })

        // 2. 결재 유형에 따라 자산 상태 일괄 업데이트
        await tx.asset.updateMany({
          where: { id: { in: assetIds } },
          data: { status: effect.assetStatus },
        })

        // 3. 자산별 HistoryLog 생성
        await tx.historyLog.createMany({
          data: assetIds.map((assetId) => ({
            assetId,
            userId: approverId,
            type: effect.historyType,
            detail: `[${effect.detailPrefix}] ${approval.title} (결재 ID: ${id})`,
          })),
        })

        return approval
      })

      return ok(result)
    }

    // ── REJECTED / CANCELLED ───────────────────────────────────────────────
    const approval = await prisma.approval.update({
      where: { id },
      data: {
        status,
        ...(approverId && { approverId }),
        ...(reason !== undefined && { reason }),
      },
      include: {
        applicant: { select: { id: true, name: true, department: true } },
        approver:  { select: { id: true, name: true } },
        assets: {
          include: {
            asset: { select: { id: true, code: true, name: true, status: true } },
          },
        },
      },
    })

    return ok(approval)
  } catch (error) {
    return serverError(error)
  }
}
