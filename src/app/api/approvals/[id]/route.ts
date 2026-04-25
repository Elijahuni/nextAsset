import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest, notFound, ok, serverError } from '@/lib/api-response'
import type { ApprovalType, AssetStatus, HistoryType } from '@/generated/prisma/enums'
import { requireRoles, getRequestUser } from '@/lib/rbac'

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
export async function GET(request: NextRequest, { params }: RouteContext) {
  const authError = await requireRoles(request, ['ADMIN', 'MANAGER', 'STAFF'])
  if (authError) return authError
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
// CANCELLED → 기안자 본인만 가능
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const sessionUser = await getRequestUser(request)
  if (!sessionUser) {
    return new Response(JSON.stringify({ error: '인증이 필요합니다.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    const { id } = await params
    const body = await request.json()
    const { status, reason } = body
    // approverId는 클라이언트가 보내도 무시 — 세션 사용자로 강제 (위/변조 방지)

    if (!status) return badRequest('status is required')

    const validStatuses = ['APPROVED', 'REJECTED', 'CANCELLED']
    if (!validStatuses.includes(status)) {
      return badRequest(`status must be one of: ${validStatuses.join(', ')}`)
    }

    // 승인·반려는 admin·manager 권한 필요
    if (status === 'APPROVED' || status === 'REJECTED') {
      if (sessionUser.role !== 'ADMIN' && sessionUser.role !== 'MANAGER') {
        return new Response(JSON.stringify({ error: '권한이 없습니다.' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      }
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

    // CANCELLED는 기안자 본인만 가능
    if (status === 'CANCELLED' && existing.applicantId !== sessionUser.id) {
      return new Response(JSON.stringify({ error: '본인이 기안한 결재만 취소할 수 있습니다.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 승인/반려 시 approverId는 세션 사용자로 강제
    const approverId = (status === 'APPROVED' || status === 'REJECTED') ? sessionUser.id : undefined

    // ── Approval 처리 ──────────────────────────────────────────────────────
    if (status === 'APPROVED') {
      const effect = APPROVAL_EFFECT[existing.type]
      const assetIds = existing.assets.map((a) => a.assetId)
      const approverIdForLog = sessionUser.id  // APPROVED 분기에서는 항상 존재 (type narrowing)

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

        // 2. 결재 유형에 따라 자산 상태 일괄 업데이트 (소프트 삭제된 자산 제외)
        await tx.asset.updateMany({
          where: { id: { in: assetIds }, deletedAt: null },
          data: { status: effect.assetStatus },
        })

        // 3. 자산별 HistoryLog 생성
        await tx.historyLog.createMany({
          data: assetIds.map((assetId) => ({
            assetId,
            userId: approverIdForLog,
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
