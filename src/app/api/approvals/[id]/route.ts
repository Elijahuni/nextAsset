export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest, notFound, ok, serverError } from '@/lib/api-response'
import type { ApprovalType, AssetStatus, HistoryType } from '@prisma/client'
import { requireRoles, getRequestUser } from '@/lib/rbac'
import { createNotification } from '@/lib/notifications'

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
        steps: {
          include: { approver: { select: { id: true, name: true, role: true } } },
          orderBy: { order: 'asc' },
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
        steps:  { orderBy: { order: 'asc' } },
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

      // 다단계 결재: 현재 PENDING 스텝 찾기
      const currentStep = existing.steps.find((s) => s.status === 'PENDING')

      if (currentStep) {
        // 이 스텝을 승인하고, 다음 스텝이 있으면 활성화
        const nextStep = existing.steps.find(
          (s) => s.status === 'WAITING' && s.order > currentStep.order
        )

        if (nextStep) {
          // 중간 단계 승인 — 아직 최종 승인 아님
          const result = await prisma.$transaction(async (tx) => {
            await tx.approvalStep.update({
              where: { id: currentStep.id },
              data: { status: 'APPROVED', actedAt: new Date(), ...(reason !== undefined && { comment: reason }) },
            })
            await tx.approvalStep.update({
              where: { id: nextStep.id },
              data: { status: 'PENDING' },
            })
            return tx.approval.update({
              where: { id },
              data: { approverId: nextStep.approverId },
              include: {
                applicant: { select: { id: true, name: true, department: true } },
                approver:  { select: { id: true, name: true } },
                assets: { include: { asset: { select: { id: true, code: true, name: true, status: true } } } },
                steps: { include: { approver: { select: { id: true, name: true, role: true } } }, orderBy: { order: 'asc' } },
              },
            })
          })

          // 다음 결재자에게 알림
          createNotification({
            userId: nextStep.approverId,
            type:   'APPROVAL_REQUEST',
            title:  '결재 차례가 되었습니다',
            body:   `"${existing.title}" 결재의 ${nextStep.order}번째 결재자로 지정되었습니다.`,
            link:   '/approvals',
          })

          return ok(result)
        }

        // 마지막 스텝 승인 → 최종 승인 처리로 진행
        await prisma.approvalStep.update({
          where: { id: currentStep.id },
          data: { status: 'APPROVED', actedAt: new Date(), ...(reason !== undefined && { comment: reason }) },
        })
      }

      // 최종 승인 (스텝 없는 단일 결재 또는 모든 스텝 완료)
      const result = await prisma.$transaction(async (tx) => {
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
            assets: { include: { asset: { select: { id: true, code: true, name: true, status: true } } } },
            steps: { include: { approver: { select: { id: true, name: true, role: true } } }, orderBy: { order: 'asc' } },
          },
        })

        // TRANSFER 이관 메타블록 파싱
        let transferMeta: { dept: string; loc: string } | null = null
        if (existing.type === 'TRANSFER' && existing.reason) {
          const metaMatch = existing.reason.match(/__TRANSFER_META__(.+?)__END__/)
          if (metaMatch) {
            try { transferMeta = JSON.parse(metaMatch[1]) } catch { /* ignore */ }
          }
        }

        if (assetIds.length > 0) {
          await tx.asset.updateMany({
            where: { id: { in: assetIds }, deletedAt: null },
            data: {
              status: effect.assetStatus,
              ...(transferMeta?.dept && { department: transferMeta.dept }),
              ...(transferMeta?.loc  && { location:   transferMeta.loc  }),
            },
          })

          const transferDetail = transferMeta
            ? ` → 부서: ${transferMeta.dept}, 위치: ${transferMeta.loc}`
            : ''
          await tx.historyLog.createMany({
            data: assetIds.map((assetId) => ({
              assetId,
              userId: sessionUser.id,
              type: effect.historyType,
              detail: `[${effect.detailPrefix}] ${approval.title} (결재 ID: ${id})${transferDetail}`,
            })),
          })
        }

        return approval
      })

      createNotification({
        userId: result.applicant.id,
        type:   'APPROVAL_APPROVED',
        title:  '결재가 승인되었습니다',
        body:   `"${result.title}" 결재가 최종 승인되었습니다.`,
        link:   '/approvals',
      })

      return ok(result)
    }

    // ── REJECTED / CANCELLED ───────────────────────────────────────────────

    // REJECTED: 현재 PENDING 스텝도 함께 반려 처리
    if (status === 'REJECTED') {
      const currentStep = existing.steps.find((s) => s.status === 'PENDING')
      if (currentStep) {
        await prisma.approvalStep.update({
          where: { id: currentStep.id },
          data: { status: 'REJECTED', actedAt: new Date(), ...(reason !== undefined && { comment: reason }) },
        })
      }
    }

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
        steps: {
          include: { approver: { select: { id: true, name: true, role: true } } },
          orderBy: { order: 'asc' },
        },
      },
    })

    // 반려: 기안자에게 알림 / 취소: 결재자에게 알림
    if (status === 'REJECTED' && approval.applicant) {
      createNotification({
        userId: approval.applicant.id,
        type:   'APPROVAL_REJECTED',
        title:  '결재가 반려되었습니다',
        body:   `"${approval.title}" 결재가 ${sessionUser.name}님에 의해 반려되었습니다.`,
        link:   '/approvals',
      })
    } else if (status === 'CANCELLED' && approval.approverId) {
      createNotification({
        userId: approval.approverId,
        type:   'APPROVAL_CANCELLED',
        title:  '결재가 취소되었습니다',
        body:   `"${approval.title}" 결재가 기안자에 의해 취소되었습니다.`,
        link:   '/approvals',
      })
    }

    return ok(approval)
  } catch (error) {
    return serverError(error)
  }
}
