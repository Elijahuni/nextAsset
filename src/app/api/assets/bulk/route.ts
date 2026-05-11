export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest, created, ok, serverError } from '@/lib/api-response'
import type { AssetCategory, AssetStatus } from '@prisma/client'
import { requireRoles, getRequestUser } from '@/lib/rbac'
import { invalidateCache } from '@/lib/redis'

// ── 품목 매핑 ─────────────────────────────────────────────────────────────────
const CATEGORY_MAP: Record<string, AssetCategory> = {
  '노트북': 'IT_EQUIPMENT', '데스크탑': 'IT_EQUIPMENT', '모니터': 'IT_EQUIPMENT',
  'TV': 'IT_EQUIPMENT', '소프트웨어': 'IT_EQUIPMENT', 'IT': 'IT_EQUIPMENT',
  '사무가구': 'FURNITURE', '가구': 'FURNITURE', '책상': 'FURNITURE', '의자': 'FURNITURE',
  '차량': 'VEHICLE',
  '기계': 'MACHINERY', '기계장치': 'MACHINERY',
}

function mapCategory(raw: string): AssetCategory {
  if (!raw) return 'OTHER'
  const trimmed = raw.trim()
  if (trimmed in CATEGORY_MAP) return CATEGORY_MAP[trimmed]
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (trimmed.includes(key) || key.includes(trimmed)) return val
  }
  const validEnums: AssetCategory[] = ['IT_EQUIPMENT', 'FURNITURE', 'VEHICLE', 'MACHINERY', 'OTHER']
  if (validEnums.includes(trimmed as AssetCategory)) return trimmed as AssetCategory
  return 'OTHER'
}

function generateCode(): string {
  const ts   = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `AST-${ts}-${rand}`
}

// ── POST /api/assets/bulk ──────────────────────────────────────────────────────
// Body: { rows: string[][] | rawText: string }
// 열 순서: [0]자산관리번호, [1]품명, [2]분류, [3]취득가액, [4]사업장, [5]상세위치, [6]시리얼번호, [7]비고
//
// Upsert 전략 (?upsert=true 파라미터 필요):
//   Case A — 엑셀 코드가 DB에 없음      → INSERT
//   Case B — 엑셀 코드가 DB에 있음      → UPDATE (이름/분류/가액/사업장/위치/시리얼/비고)
//   Case C — DB에 있으나 엑셀에 없음    → status = RETIRED (비활성)
//
// ?upsert=false (기본값) = insert-only, 기존 호환
export async function POST(request: NextRequest) {
  const authError = await requireRoles(request, ['ADMIN', 'MANAGER'])
  if (authError) return authError
  try {
    const upsertMode = request.nextUrl.searchParams.get('upsert') === 'true'
    const body       = await request.json()

    let rows: string[][]

    if (body.rawText) {
      const lines: string[] = (body.rawText as string)
        .split('\n')
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 0)
      rows = lines.map((line: string) =>
        line.split(/[,\t]/).map((c: string) => c.trim().replace(/^"|"$/g, ''))
      )
    } else if (Array.isArray(body.rows)) {
      rows = body.rows
    } else {
      return badRequest('rawText 또는 rows 배열이 필요합니다')
    }

    if (rows.length === 0) return badRequest('등록할 데이터가 없습니다')
    if (rows.length > 500) return badRequest('한 번에 최대 500건까지 처리 가능합니다')

    const today = new Date().toISOString().split('T')[0]

    // ── 열 파싱 헬퍼 ───────────────────────────────────────────────────────────
    const parseRow = (cols: string[]) => ({
      code:         (cols[0] || '').trim() || generateCode(),
      name:         cols[1] || '미입력',
      category:     mapCategory(cols[2] ?? ''),
      price:        Math.max(0, Number(cols[3]) || 0),
      department:   cols[4] || '미분류',
      location:     cols[5] || '미입력',
      barcode:      (cols[6] || '').trim() || undefined,
      remarks:      (cols[7] || '').trim() || undefined,
      acquiredDate: new Date(today),
    })

    // ── Insert-only 모드 (기존 호환) ──────────────────────────────────────────
    if (!upsertMode) {
      const assetsToCreate = rows.map((cols) => ({
        ...parseRow(cols),
        status: 'AVAILABLE' as const,
      }))
      const result = await prisma.asset.createMany({
        data: assetsToCreate,
        skipDuplicates: true,
      })
      return created({ mode: 'insert', count: result.count, requested: rows.length })
    }

    // ── Upsert 모드 (Case A / B / C) ─────────────────────────────────────────
    const excelCodes = new Set(
      rows.map((c) => (c[0] || '').trim()).filter(Boolean)
    )

    // 활성 자산만 조회 (RETIRED/DISPOSED 제외) — 임계값 계산 정확도 + Case C 불필요 UPDATE 방지
    const existing = await prisma.asset.findMany({
      where:  { deletedAt: null, status: { notIn: ['RETIRED', 'DISPOSED'] } },
      select: { id: true, code: true },
    })
    const existingMap = new Map(existing.map((a) => [a.code, a.id]))

    // Case C 대상 사전 계산 — DB 쓰기 전에 임계값 검증
    const toDeactivate = existing.filter((a) => !excelCodes.has(a.code))
    const forceMode    = request.nextUrl.searchParams.get('force') === 'true'
    const threshold    = Math.ceil(existing.length * 0.3)
    if (toDeactivate.length > threshold && !forceMode) {
      return new Response(
        JSON.stringify({
          error: `비활성화 대상(${toDeactivate.length}건)이 활성 자산(${existing.length}건)의 30%를 초과합니다. 의도한 작업이면 ?force=true 파라미터를 추가하세요.`,
          toDeactivate: toDeactivate.length,
          total:        existing.length,
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Case A / Case B 분리
    const insertRows: ReturnType<typeof parseRow>[] = []
    const updateOps: { id: string; data: ReturnType<typeof parseRow> }[] = []

    for (const cols of rows) {
      const parsed     = parseRow(cols)
      const existingId = existingMap.get(parsed.code)
      if (!existingId) {
        insertRows.push(parsed)
      } else {
        updateOps.push({ id: existingId, data: parsed })
      }
    }

    // Case A — 신규 Insert (1 쿼리)
    if (insertRows.length > 0) {
      await prisma.asset.createMany({
        data: insertRows.map((r) => ({ ...r, status: 'AVAILABLE' as const })),
        skipDuplicates: true,
      })
    }

    // Case B — 기존 자산 업데이트 (1 DB 왕복, N SQL)
    if (updateOps.length > 0) {
      await prisma.$transaction(
        updateOps.map(({ id, data }) =>
          prisma.asset.update({
            where: { id },
            data: {
              name:       data.name,
              category:   data.category,
              price:      data.price,
              department: data.department,
              location:   data.location,
              ...(data.barcode !== undefined && { barcode: data.barcode }),
              ...(data.remarks !== undefined && { remarks: data.remarks }),
            },
          }),
        ),
      )
    }

    const inserted = insertRows.length
    const updated  = updateOps.length
    let   deactivated = 0

    // Case C — 엑셀에 없는 활성 자산 → RETIRED
    if (toDeactivate.length > 0) {
      await prisma.asset.updateMany({
        where: { id: { in: toDeactivate.map((a) => a.id) } },
        data:  { status: 'RETIRED' },
      })
      deactivated = toDeactivate.length
    }

    return ok({
      mode:        'upsert',
      inserted,
      updated,
      deactivated,
      total:       rows.length,
    })
  } catch (error) {
    return serverError(error)
  }
}

// ── PATCH /api/assets/bulk — 일괄 상태 변경 ───────────────────────────────────
// Body: { ids: string[], status: AssetStatus }
const VALID_STATUSES_SET = new Set<AssetStatus>(['AVAILABLE', 'IN_USE', 'UNDER_MAINTENANCE', 'RETIRED', 'DISPOSED'])
const STATUS_LABEL_MAP: Record<string, string> = {
  AVAILABLE: '사용가능', IN_USE: '사용중', UNDER_MAINTENANCE: '수리중',
  RETIRED: '보관중', DISPOSED: '처분',
}

export async function PATCH(request: NextRequest) {
  const authError = await requireRoles(request, ['ADMIN', 'MANAGER'])
  if (authError) return authError

  try {
    const sessionUser = await getRequestUser(request)
    const body = await request.json()
    const { ids, status } = body as { ids: string[]; status: string }

    if (!Array.isArray(ids) || ids.length === 0) return badRequest('ids 배열이 필요합니다')
    if (ids.length > 500)                         return badRequest('한 번에 최대 500건까지 처리 가능합니다')
    if (!VALID_STATUSES_SET.has(status as AssetStatus)) return badRequest('유효하지 않은 상태값입니다')

    const targetStatus = status as AssetStatus

    // 실제 존재하는 활성 자산만 추리기 (삭제된 자산 제외)
    const assets = await prisma.asset.findMany({
      where:  { id: { in: ids }, deletedAt: null },
      select: { id: true, status: true },
    })
    if (assets.length === 0) return badRequest('유효한 자산이 없습니다')

    const validIds = assets.map((a) => a.id)

    // 상태 업데이트 + HistoryLog 일괄 생성 (트랜잭션)
    await prisma.$transaction(async (tx) => {
      await tx.asset.updateMany({
        where: { id: { in: validIds } },
        data:  { status: targetStatus },
      })
      if (sessionUser) {
        await tx.historyLog.createMany({
          data: validIds.map((assetId) => ({
            assetId,
            userId: sessionUser.id,
            type:   'STATUS_CHANGED',
            detail: `[일괄 변경] 상태 → ${STATUS_LABEL_MAP[targetStatus] ?? targetStatus}`,
          })),
        })
      }
    })

    // 통계 캐시 무효화 (role × dept 조합)
    await invalidateCache([
      'stats:ADMIN:undefined',
      `stats:MANAGER:${sessionUser?.department ?? '*'}`,
      `stats:STAFF:${sessionUser?.department ?? '*'}`,
    ])

    return ok({ updated: validIds.length, status: targetStatus })
  } catch (error) {
    return serverError(error)
  }
}
