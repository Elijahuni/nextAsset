/**
 * DB users + Supabase Auth users 초기 시드
 * 실행: pnpm db:seed  (또는 npx tsx prisma/seed.ts)
 *
 * 필요 환경변수:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   ← .env에 추가 필요
 */

import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { createClient } from '@supabase/supabase-js'

const prisma = new PrismaClient()

const USERS = [
  { id: 'admin',    name: '시스템관리자', email: 'admin@assetcop.local',    password: 'Admin1234!',    role: 'ADMIN'   as const, department: '경영지원부' },
  { id: 'manager1', name: '김팀장',       email: 'manager1@assetcop.local', password: 'Manager1234!',  role: 'MANAGER' as const, department: 'IT개발팀'  },
  { id: 'emp1',     name: '홍길동',       email: 'emp1@assetcop.local',     password: 'Employee1234!', role: 'STAFF'   as const, department: '경영지원부' },
  { id: 'emp2',     name: '김철수',       email: 'emp2@assetcop.local',     password: 'Employee1234!', role: 'STAFF'   as const, department: 'IT개발팀'  },
]

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 .env에 없습니다.')
    process.exit(1)
  }

  const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log('🌱 Seeding DB users...')
  for (const user of USERS) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: { name: user.name, email: user.email, role: user.role, department: user.department },
      create: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department },
    })
    console.log(`  ✓ DB: ${user.id} (${user.name})`)
  }

  console.log('\n🔐 Seeding Supabase Auth users...')
  for (const user of USERS) {
    // Check if auth user already exists
    const { data: existing } = await adminSupabase.auth.admin.listUsers()
    const alreadyExists = existing?.users?.some((u) => u.email === user.email)

    if (alreadyExists) {
      console.log(`  ⏭  Auth: ${user.email} (already exists)`)
      continue
    }

    const { error } = await adminSupabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { userId: user.id, name: user.name, role: user.role },
    })

    if (error) {
      console.error(`  ✗ Auth: ${user.email} — ${error.message}`)
    } else {
      console.log(`  ✓ Auth: ${user.email} (password: ${user.password})`)
    }
  }

  console.log('\n✅ Seed complete.')
  console.log('\n📋 Login credentials:')
  USERS.forEach((u) => console.log(`   ${u.name}: ${u.email} / ${u.password}`))
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
