export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { serverError } from '@/lib/api-response'
import { getRequestUser } from '@/lib/rbac'
import { AssetCategory, AssetStatus } from '@prisma/client'
import { DEFAULT_DEPRECIATION_RULES } from '@/lib/depreciation'

// ── Vercel 서버리스: 최대 5,000건 제한 (메모리 안전) ──────────────────────────
const MAX_ROWS = 5_000

const VALID_STATUSES   = new Set(Object.values(AssetStatus))
const VALID_CATEGORIES = new Set(Object.values(AssetCategory))

const STATUS_LABEL: Record<string, string> = {
  IN_USE:            '사용중',
  AVAILABLE:         '사용가능',
  UNDER_MAINTENANCE: '수리중',
  RETIRED:           '보관중',
  DISPOSED:          '처분',
}
const CATEGORY_LABEL: Record<string, string> = {
  IT_EQUIPMENT: 'IT 장비',
  FURNITURE:    '가구',
  VEHICLE:      '차량',
  MACHINERY:    '기계',
  OTHER:        '기타',
}
const SALVAGE = 1000
const RATE_MAP: Record<number, number> = { 3: 0.631, 4: 0.528, 5: 0.451, 6: 0.392, 8: 0.313 }

function calcDepr(price: number, acquiredDate: Date, category: string, rules: Record<string, { years: number; method: string }>) {
  const rule = rules[category] ?? { years: 5, method: '정액법' }
  const totalMonths = rule.years * 12
  const diff = Date.now() - acquiredDate.getTime()
  const monthsElapsed = Math.min(Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24 * 30.4))), totalMonths)

  if (monthsElapsed >= totalMonths || price <= SALVAGE) {
    return { bookValue: SALVAGE, accumulated: price - SALVAGE, annualDepr: 0 }
  }

  let bookValue = price
  if (rule.method === '정액법') {
    const monthly = (price - SALVAGE) / totalMonths
    const accum   = Math.floor(monthsElapsed * monthly)
    bookValue = Math.max(price - accum, SALVAGE)
    return { bookValue, accumulated: price - bookValue, annualDepr: Math.floor(monthly * 12) }
  }

  // 정률법
  const R = RATE_MAP[rule.years] ?? (1 - Math.pow(SALVAGE / price, 1 / rule.years))
  const fullYears = Math.floor(monthsElapsed / 12)
  const remMonths = monthsElapsed % 12
  for (let y = 0; y < fullYears; y++) bookValue -= Math.floor(bookValue * R)
  if (remMonths > 0) bookValue -= Math.floor(Math.floor(bookValue * R) / 12) * remMonths
  bookValue = Math.max(bookValue, SALVAGE)
  const annualDepr = bookValue > SALVAGE ? Math.floor(bookValue * R) : 0
  return { bookValue, accumulated: price - bookValue, annualDepr }
}

// ── 컬럼 너비 자동 계산 ───────────────────────────────────────────────────────
function autoWidth(ws: XLSX.WorkSheet): XLSX.ColInfo[] {
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  const widths: number[] = []
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })]
      const len  = cell ? String(cell.v ?? '').length : 0
      widths[C]  = Math.min(Math.max(widths[C] ?? 8, len + 2), 50)
    }
  }
  return widths.map((w) => ({ wch: w }))
}

// ── 헤더 행 스타일 (굵게 + 배경) ─────────────────────────────────────────────
function styleHeader(ws: XLSX.WorkSheet, colCount: number) {
  const headerStyle = {
    font:      { bold: true, color: { rgb: 'FFFFFF' } },
    fill:      { fgColor: { rgb: '1E40AF' } },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const },
    border: {
      bottom: { style: 'medium', color: { rgb: '93C5FD' } },
    },
  }
  for (let C = 0; C < colCount; C++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: C })
    if (ws[addr]) ws[addr].s = headerStyle
  }
}

// GET /api/export/assets?q=&status=&category=&department=&active=
export async function GET(request: NextRequest) {
  const sessionUser = await getRequestUser(request)
  if (!sessionUser) {
    return new Response(JSON.stringify({ error: '인증이 필요합니다.' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }
  if (!['ADMIN', 'MANAGER'].includes(sessionUser.role)) {
    return new Response(JSON.stringify({ error: '권한이 없습니다.' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
  }
  // MANAGER는 본인 부서만 내보내기 가능 — 쿼리파라미터보다 우선
  const deptScope = sessionUser.role === 'MANAGER' ? sessionUser.department : null

  try {
    const { searchParams } = request.nextUrl
    const q                  = searchParams.get('q')?.trim() ?? ''
    const rawStatus          = searchParams.get('status')
    const rawCategory        = searchParams.get('category')
    const department         = deptScope ?? (searchParams.get('department') ?? undefined)
    const activeGroup        = searchParams.get('active')
    const dateFrom           = searchParams.get('dateFrom')
    const dateTo             = searchParams.get('dateTo')
    const priceMin           = searchParams.get('priceMin')
    const priceMax           = searchParams.get('priceMax')
    const warrantyExpiring   = searchParams.get('warranty') === '1'

    const status   = rawStatus   && VALID_STATUSES.has(rawStatus as AssetStatus)       ? rawStatus as AssetStatus     : null
    const category = rawCategory && VALID_CATEGORIES.has(rawCategory as AssetCategory) ? rawCategory as AssetCategory : null

    // active 그룹 → enum 목록
    const ACTIVE_STATUSES   = ['IN_USE', 'AVAILABLE'] as AssetStatus[]
    const INACTIVE_STATUSES = ['UNDER_MAINTENANCE', 'RETIRED', 'DISPOSED'] as AssetStatus[]
    const activeEnums =
      activeGroup === 'active'   ? ACTIVE_STATUSES :
      activeGroup === 'inactive' ? INACTIVE_STATUSES : []

    // 보증만료 임박: 오늘~30일 이내
    const warrantyFrom = warrantyExpiring ? new Date() : undefined
    const warrantyTo   = warrantyExpiring ? (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d })() : undefined

    const where = {
      deletedAt: null,
      ...(q && {
        OR: [
          { name:        { contains: q, mode: 'insensitive' as const } },
          { code:        { contains: q, mode: 'insensitive' as const } },
          { department:  { contains: q, mode: 'insensitive' as const } },
          { barcode:     { contains: q, mode: 'insensitive' as const } },
          { subCategory: { contains: q, mode: 'insensitive' as const } },
          { assignedTo:  { contains: q, mode: 'insensitive' as const } },
          { location:    { contains: q, mode: 'insensitive' as const } },
        ],
      }),
      ...(department && { department }),
      ...(status
        ? { status }
        : activeEnums.length ? { status: { in: activeEnums } } : {}),
      ...(category && { category }),
      // 취득일 범위
      ...(dateFrom || dateTo ? {
        acquiredDate: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo   && { lte: new Date(dateTo + 'T23:59:59') }),
        },
      } : {}),
      // 가격 범위
      ...(priceMin || priceMax ? {
        price: {
          ...(priceMin && { gte: Number(priceMin) }),
          ...(priceMax && { lte: Number(priceMax) }),
        },
      } : {}),
      // 보증만료 임박
      ...(warrantyExpiring && warrantyFrom && warrantyTo ? {
        warrantyDate: { gte: warrantyFrom, lte: warrantyTo },
      } : {}),
    }

    // 자산 + 유지보수이력 한 번에 조회
    const [assets, ruleItem] = await Promise.all([
      prisma.asset.findMany({
        where,
        select: {
          id: true, code: true, name: true, category: true,
          department: true, location: true, status: true,
          price: true, acquiredDate: true, warrantyDate: true,
          barcode: true, remarks: true, subCategory: true,
          description: true, size: true, color: true, assignedTo: true,
          maintenanceLogs: {
            select: {
              id: true, vendor: true, cost: true,
              detail: true, date: true,
            },
            orderBy: { date: 'desc' },
            take: 20, // 자산당 최근 20건
          },
        },
        orderBy: [{ category: 'asc' }, { acquiredDate: 'asc' }],
        take: MAX_ROWS,
      }),
      prisma.masterItem.findFirst({ where: { type: 'depreciation_rules' } }),
    ])

    const rules: Record<string, { years: number; method: string }> = (() => {
      if (!ruleItem) return DEFAULT_DEPRECIATION_RULES
      try { return JSON.parse(ruleItem.value) } catch { return DEFAULT_DEPRECIATION_RULES }
    })()

    const today      = new Date().toLocaleDateString('ko-KR')
    const dateStr    = new Date().toISOString().split('T')[0]

    // ── 시트 1: 자산목록 ──────────────────────────────────────────────────────
    const assetHeader = [
      '자산코드', '자산명', '품목', '중분류', '세부정보', '사이즈', '색상',
      '담당자', '부서', '위치', '상태',
      '취득가액', '취득일', '보증만료일', '바코드', '비고',
    ]
    const assetRows = assets.map((a) => [
      a.code,
      a.name,
      CATEGORY_LABEL[a.category] ?? a.category,
      a.subCategory ?? '',
      a.description ?? '',
      a.size        ?? '',
      a.color       ?? '',
      a.assignedTo  ?? '',
      a.department,
      a.location,
      STATUS_LABEL[a.status] ?? a.status,
      Number(a.price),
      a.acquiredDate.toISOString().split('T')[0],
      a.warrantyDate ? a.warrantyDate.toISOString().split('T')[0] : '',
      a.barcode  ?? '',
      a.remarks  ?? '',
    ])
    const ws1 = XLSX.utils.aoa_to_sheet([assetHeader, ...assetRows])
    ws1['!cols'] = autoWidth(ws1)
    styleHeader(ws1, assetHeader.length)
    // 취득가액 열(인덱스 11)에 숫자 포맷 적용
    const priceColIdx = 11
    for (let R = 1; R <= assetRows.length; R++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: priceColIdx })
      if (ws1[addr]) ws1[addr].z = '#,##0'
    }

    // ── 시트 2: 유지보수이력 ──────────────────────────────────────────────────
    const maintHeader = [
      '자산코드', '자산명', '부서',
      '업체', '비용', '일자', '상세내용',
    ]
    const maintRows: (string | number)[][] = []
    for (const a of assets) {
      for (const m of a.maintenanceLogs) {
        maintRows.push([
          a.code,
          a.name,
          a.department,
          m.vendor ?? '',
          Number(m.cost ?? 0),
          m.date ? new Date(m.date).toISOString().split('T')[0] : '',
          m.detail ?? '',
        ])
      }
    }
    const ws2 = XLSX.utils.aoa_to_sheet(
      maintRows.length > 0 ? [maintHeader, ...maintRows] : [maintHeader, ['데이터 없음']],
    )
    ws2['!cols'] = autoWidth(ws2)
    styleHeader(ws2, maintHeader.length)
    // 비용 열(인덱스 5)에 숫자 포맷
    for (let R = 1; R <= maintRows.length; R++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: 5 })
      if (ws2[addr]) ws2[addr].z = '#,##0'
    }

    // ── 시트 3: 감가상각현황 ──────────────────────────────────────────────────
    const deprHeader = [
      '자산코드', '자산명', '품목', '상각방법', '내용연수(년)',
      '취득일', '내용연수종료일', '경과월', '전체월',
      '취득가액', '상각누계액', '연간감가상각비', '잔존가치', '현재장부가', '상각완료',
    ]
    const deprRows = assets.map((a) => {
      const price     = Number(a.price)
      const rule      = rules[a.category] ?? { years: 5, method: '정액법' }
      const totalMths = (rule.years as number) * 12
      const diff      = Date.now() - a.acquiredDate.getTime()
      const elapsed   = Math.min(Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24 * 30.4))), totalMths)
      const { bookValue, accumulated, annualDepr } = calcDepr(price, a.acquiredDate, a.category, rules)
      const endDate   = new Date(a.acquiredDate)
      endDate.setFullYear(endDate.getFullYear() + (rule.years as number))
      const done      = elapsed >= totalMths || bookValue <= SALVAGE

      return [
        a.code,
        a.name,
        CATEGORY_LABEL[a.category] ?? a.category,
        rule.method,
        rule.years,
        a.acquiredDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        elapsed,
        totalMths,
        price,
        accumulated,
        done ? 0 : annualDepr,
        SALVAGE,
        bookValue,
        done ? 'Y' : 'N',
      ]
    })
    const ws3 = XLSX.utils.aoa_to_sheet([deprHeader, ...deprRows])
    ws3['!cols'] = autoWidth(ws3)
    styleHeader(ws3, deprHeader.length)
    // 숫자 열 포맷 (취득가액:9, 상각누계:10, 연간감가:11, 잔존:12, 장부가:13)
    const numCols = [9, 10, 11, 12, 13]
    for (let R = 1; R <= deprRows.length; R++) {
      for (const C of numCols) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C })
        if (ws3[addr]) ws3[addr].z = '#,##0'
      }
    }

    // ── 워크북 생성 ───────────────────────────────────────────────────────────
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws1, '자산목록')
    XLSX.utils.book_append_sheet(wb, ws2, '유지보수이력')
    XLSX.utils.book_append_sheet(wb, ws3, '감가상각현황')

    // 파일 속성
    wb.Props = {
      Title:   '자산관리 보고서',
      Subject: `${today} 기준`,
      Author:  'TW-AMS',
      CreatedDate: new Date(),
    }

    // Uint8Array로 직렬화 — Vercel 서버리스에서 BodyInit 호환 + 실제 바이트 수로 Content-Length 계산
    // (이전 방식의 xlsxArray.length는 number[] 원소 수여서 바이트 크기와 다름)
    const xlsxBytes = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as number[])

    const filename = encodeURIComponent(`자산보고서_${dateStr}.xlsx`)
    return new Response(xlsxBytes, {
      status: 200,
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
        'Content-Length':      String(xlsxBytes.byteLength),
        'Cache-Control':       'no-store',
      },
    })
  } catch (e) {
    return serverError(e)
  }
}
