/**
 * 서버 환경변수 필수값 검증 — 누락 시 빌드/시작 단계에서 명확한 에러 발생
 * import 순서상 lib/supabase-server.ts, lib/prisma.ts, lib/gemini.ts 보다 먼저 로드됨
 *
 * 사용처: src/lib/rbac.ts, src/lib/gemini.ts 등에서 상단에 import
 */

const REQUIRED_SERVER_ENV = [
  'DATABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const

if (typeof window === 'undefined') {
  const missing = REQUIRED_SERVER_ENV.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new Error(
      `[env] 필수 환경변수가 설정되지 않았습니다: ${missing.join(', ')}\n` +
      '.env.example 을 참고해 Vercel Dashboard 또는 로컬 .env 파일에 설정하세요.',
    )
  }
}
