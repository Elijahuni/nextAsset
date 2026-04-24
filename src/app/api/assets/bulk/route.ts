import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest, created, serverError } from '@/lib/api-response'
import type { AssetCategory } from '@/generated/prisma/enums'

// 원본 handleMassUpload 파싱 로직 이식
// CSV/TSV 행: 자산명, 품목, 취득가액, 부서, 위치

// 한국어 품목명 → AssetCategory enum 매핑
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
  // 직접 매핑
  if (trimmed in CATEGORY_MAP) return CATEGORY_MAP[trimmed]
  // 부분 매칭
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (trimmed.includes(key) || key.includes(trimmed)) return val
  }
  // 영문 enum 그대로 허용
  const validEnums: AssetCategory[] = ['IT_EQUIPMENT', 'FURNITURE', 'VEHICLE', 'MACHINERY', 'OTHER']
  if (validEnums.includes(trimmed as AssetCategory)) return trimmed as AssetCategory
  return 'OTHER'
}

function generateCode(): string {
  // 원본: `10${Math.floor(10000000 + Math.random() * 90000000)}`
  // 충돌 방지를 위해 timestamp + random 조합
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `AST-${ts}-${rand}`
}

// POST /api/assets/bulk
// Body: { rows: string[][] | rawText: string, createdById?: string }
// rawText 형식: 한 줄 = 탭/콤마로 구분된 CSV (자산명, 품목, 취득가액, 부서, 위치)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    let rows: string[][]

    if (body.rawText) {
      // 클라이언트에서 붙여넣은 텍스트 파싱 (원본 handleMassUpload 로직)
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
    if (rows.length > 500) return badRequest('한 번에 최대 500건까지 등록 가능합니다')

    const today = new Date().toISOString().split('T')[0]

    const assetsToCreate = rows.map((cols) => ({
      code:        generateCode(),
      name:        cols[0] || '미입력',
      category:    mapCategory(cols[1] ?? ''),
      price:       Math.max(0, Number(cols[2]) || 0),
      department:  cols[3] || '미분류',
      location:    cols[4] || '미입력',
      status:      'AVAILABLE' as const,
      acquiredDate: new Date(today),
    }))

    // createMany로 일괄 삽입 (skipDuplicates: true로 코드 충돌 방지)
    const result = await prisma.asset.createMany({
      data: assetsToCreate,
      skipDuplicates: true,
    })

    return created({ count: result.count, requested: rows.length })
  } catch (error) {
    return serverError(error)
  }
}
