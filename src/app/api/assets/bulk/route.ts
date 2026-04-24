import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest, created, ok, serverError } from '@/lib/api-response'
import type { AssetCategory } from '@/generated/prisma/enums'
import { requireRoles } from '@/lib/rbac'

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

    // DB에서 소프트 삭제되지 않은 자산 코드 전체 조회
    const existing = await prisma.asset.findMany({
      where:  { deletedAt: null },
      select: { id: true, code: true },
    })
    const existingMap = new Map(existing.map((a) => [a.code, a.id]))

    let inserted    = 0
    let updated     = 0
    let deactivated = 0

    // Case A + Case B: 엑셀 행 순회
    for (const cols of rows) {
      const parsed     = parseRow(cols)
      const existingId = existingMap.get(parsed.code)

      if (!existingId) {
        // Case A — 신규 Insert
        await prisma.asset.create({
          data: { ...parsed, status: 'AVAILABLE' },
        })
        inserted++
      } else {
        // Case B — 기존 자산 업데이트 (이미지 제외, 취득가액·취득일은 덮어쓰지 않음)
        await prisma.asset.update({
          where: { id: existingId },
          data: {
            name:       parsed.name,
            category:   parsed.category,
            price:      parsed.price,
            department: parsed.department,
            location:   parsed.location,
            ...(parsed.barcode !== undefined && { barcode: parsed.barcode }),
            ...(parsed.remarks !== undefined && { remarks: parsed.remarks }),
          },
        })
        updated++
      }
    }

    // Case C — 엑셀에 없는 자산 → RETIRED (비활성)
    // 안전 임계값: 전체 자산의 30% 초과 비활성화 시 ?force=true 필요
    const toDeactivate = existing.filter((a) => !excelCodes.has(a.code))
    if (toDeactivate.length > 0) {
      const forceMode  = request.nextUrl.searchParams.get('force') === 'true'
      const threshold  = Math.ceil(existing.length * 0.3)
      if (toDeactivate.length > threshold && !forceMode) {
        return new Response(
          JSON.stringify({
            error: `비활성화 대상(${toDeactivate.length}건)이 전체 자산(${existing.length}건)의 30%를 초과합니다. 의도한 작업이면 ?force=true 파라미터를 추가하세요.`,
            toDeactivate: toDeactivate.length,
            total:        existing.length,
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        )
      }
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
