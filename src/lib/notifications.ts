/**
 * 알림 생성 헬퍼
 * API 라우트 내부에서 호출 — 알림 생성 실패가 주요 작업을 막지 않도록 try/catch 처리
 */

import { prisma } from './prisma'

type NotificationType =
  | 'APPROVAL_REQUEST'   // 결재자에게: 새 기안 접수
  | 'APPROVAL_APPROVED'  // 기안자에게: 결재 승인
  | 'APPROVAL_REJECTED'  // 기안자에게: 결재 반려
  | 'APPROVAL_CANCELLED' // 결재자에게: 기안자가 취소
  | 'WARRANTY_EXPIRING'  // 관리자에게: 보증기간 만료 임박

interface CreateNotificationInput {
  userId: string
  type:   NotificationType
  title:  string
  body:   string
  link?:  string
}

/** 단일 알림 생성 (실패 시 무음 처리) */
export async function createNotification(input: CreateNotificationInput) {
  try {
    return await prisma.notification.create({ data: input })
  } catch (e) {
    console.error('[notification] create failed:', e)
    return null
  }
}

/** 여러 사용자에게 동일한 알림 일괄 생성 */
export async function createNotifications(
  userIds: string[],
  base: Omit<CreateNotificationInput, 'userId'>,
) {
  if (userIds.length === 0) return
  try {
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({ ...base, userId })),
      skipDuplicates: true,
    })
  } catch (e) {
    console.error('[notification] createMany failed:', e)
  }
}
