export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { badRequest, notFound, ok, serverError } from '@/lib/api-response'
import { requireRoles } from '@/lib/rbac'
import { supabaseAdmin } from '@/lib/supabase-admin'

type RouteContext = { params: Promise<{ id: string }> }

const MAX_FILES = 5

const ConfirmSchema = z.object({
  name:        z.string().min(1).max(255),
  storagePath: z.string().min(1),
  mimeType:    z.string().min(1),
  size:        z.number().int().positive().max(10 * 1024 * 1024),
})

function toPublicUrl(storagePath: string) {
  return supabaseAdmin.storage
    .from('asset-files')
    .getPublicUrl(storagePath).data.publicUrl
}

// GET /api/approvals/[id]/files
export async function GET(request: NextRequest, { params }: RouteContext) {
  const authError = await requireRoles(request, ['ADMIN', 'MANAGER', 'STAFF'])
  if (authError) return authError

  const { id } = await params
  try {
    const files = await prisma.approvalFile.findMany({
      where:   { approvalId: id },
      orderBy: { createdAt: 'asc' },
    })
    return ok(files.map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
      url:       toPublicUrl(f.storagePath),
    })))
  } catch (e) {
    return serverError(e)
  }
}

// POST /api/approvals/[id]/files — 업로드 완료 후 메타데이터 저장
export async function POST(request: NextRequest, { params }: RouteContext) {
  const authError = await requireRoles(request, ['ADMIN', 'MANAGER', 'STAFF'])
  if (authError) return authError

  const { id } = await params
  try {
    const body   = await request.json()
    const parsed = ConfirmSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues[0].message)

    const approval = await prisma.approval.findUnique({ where: { id } })
    if (!approval) return notFound('결재')

    const count = await prisma.approvalFile.count({ where: { approvalId: id } })
    if (count >= MAX_FILES)
      return badRequest(`첨부파일은 최대 ${MAX_FILES}개까지 등록할 수 있습니다.`)

    const file = await prisma.approvalFile.create({
      data: { approvalId: id, ...parsed.data },
    })
    return ok({ ...file, createdAt: file.createdAt.toISOString(), url: toPublicUrl(file.storagePath) })
  } catch (e) {
    return serverError(e)
  }
}

// DELETE /api/approvals/[id]/files?fileId=xxx
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const authError = await requireRoles(request, ['ADMIN', 'MANAGER', 'STAFF'])
  if (authError) return authError

  const { id } = await params
  const fileId  = new URL(request.url).searchParams.get('fileId')
  if (!fileId) return badRequest('fileId가 필요합니다.')

  try {
    const file = await prisma.approvalFile.findFirst({ where: { id: fileId, approvalId: id } })
    if (!file) return notFound('파일')

    const { error: storageErr } = await supabaseAdmin.storage
      .from('asset-files')
      .remove([file.storagePath])
    if (storageErr) console.error('[Storage delete]', storageErr)

    await prisma.approvalFile.delete({ where: { id: fileId } })
    return ok({ success: true })
  } catch (e) {
    return serverError(e)
  }
}
