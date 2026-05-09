export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { badRequest, ok, serverError } from '@/lib/api-response'
import { requireRoles } from '@/lib/rbac'
import { supabaseAdmin } from '@/lib/supabase-admin'

type RouteContext = { params: Promise<{ id: string }> }

const MAX_FILE_SIZE  = 5 * 1024 * 1024 // 5 MB
const MAX_FILES      = 10
const ALLOWED_TYPES  = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
])

const PresignSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  size:     z.number().int().positive(),
})

function sanitize(name: string) {
  return name.replace(/[^\w.\-가-힣]/g, '_').slice(0, 100)
}

// POST /api/assets/[id]/files/presign
// → Supabase Storage 서명 업로드 URL 발급 (클라이언트가 직접 Storage로 업로드)
export async function POST(request: NextRequest, { params }: RouteContext) {
  const authError = await requireRoles(request, ['ADMIN', 'MANAGER'])
  if (authError) return authError

  const { id } = await params

  try {
    const body   = await request.json()
    const parsed = PresignSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues[0].message)

    const { filename, mimeType, size } = parsed.data

    if (!ALLOWED_TYPES.has(mimeType))
      return badRequest('JPG, PNG, WEBP, GIF, PDF 파일만 업로드할 수 있습니다.')

    if (size > MAX_FILE_SIZE)
      return badRequest('파일 크기는 5MB 이하여야 합니다.')

    const asset = await prisma.asset.findUnique({ where: { id, deletedAt: null } })
    if (!asset) return badRequest('자산을 찾을 수 없습니다.')

    const count = await prisma.assetFile.count({ where: { assetId: id } })
    if (count >= MAX_FILES)
      return badRequest(`파일은 최대 ${MAX_FILES}개까지 등록할 수 있습니다.`)

    const storagePath = `assets/${id}/${Date.now()}-${sanitize(filename)}`

    const { data, error } = await supabaseAdmin.storage
      .from('asset-files')
      .createSignedUploadUrl(storagePath)

    if (error || !data)
      return serverError(error ?? new Error('presign failed'))

    return ok({ path: storagePath, signedUrl: data.signedUrl, token: data.token })
  } catch (e) {
    return serverError(e)
  }
}
