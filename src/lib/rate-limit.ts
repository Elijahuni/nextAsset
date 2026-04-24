/**
 * Rate Limiter — Upstash Redis 우선, 미설정 시 in-memory fallback
 *
 * [Vercel 배포 시]
 *   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN 환경변수 설정 시 Redis 기반 전역 제한 활성화
 *   미설정 시 in-memory fallback (인스턴스 독립, 개발·테스트용)
 *
 * [Upstash 무료 티어]: 10,000 req/day — AI API 사용량 기준 충분
 */

// ─── Upstash Redis (선택적) ────────────────────────────────────────────────────
let upstashRatelimit: ((key: string, limit: number, windowMs: number) => Promise<boolean>) | null = null

if (
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
) {
  // 런타임에 동적으로 로드 — 환경변수 없는 환경에서 import 에러 방지
  void (async () => {
    try {
      const { Redis }       = await import('@upstash/redis')
      const { Ratelimit }   = await import('@upstash/ratelimit')
      const redis           = new Redis({
        url:   process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      })
      // 키별 Ratelimit 인스턴스를 캐싱해 재사용
      const instanceCache = new Map<string, InstanceType<typeof Ratelimit>>()

      upstashRatelimit = async (key: string, limit: number, windowMs: number) => {
        const cacheKey = `${limit}:${windowMs}`
        if (!instanceCache.has(cacheKey)) {
          instanceCache.set(
            cacheKey,
            new Ratelimit({
              redis,
              limiter: Ratelimit.slidingWindow(limit, `${windowMs / 1000} s`),
              prefix:  '@assetcop:rl',
            }),
          )
        }
        const { success } = await instanceCache.get(cacheKey)!.limit(key)
        return success
      }
    } catch {
      // Upstash 초기화 실패 → in-memory fallback 유지
    }
  })()
}

// ─── In-memory fallback ────────────────────────────────────────────────────────
interface Counter {
  count:   number
  resetAt: number
}

const store = new Map<string, Counter>()

// 5분마다 만료 항목 정리
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    store.forEach((entry, key) => {
      if (now > entry.resetAt) store.delete(key)
    })
  }, 5 * 60 * 1000)
}

function checkInMemory(key: string, limit: number, windowMs: number): boolean {
  const now   = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= limit) return false
  entry.count++
  return true
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * 요청이 허용 범위 내에 있으면 true, 초과했으면 false를 반환합니다.
 *
 * @param key       사용자/IP 단위 고유 키
 * @param limit     윈도우당 최대 요청 수 (기본 10)
 * @param windowMs  윈도우 크기 밀리초 (기본 60,000 = 1분)
 */
export async function checkRateLimit(
  key: string,
  limit    = 10,
  windowMs = 60_000,
): Promise<boolean> {
  if (upstashRatelimit) {
    try {
      return await upstashRatelimit(key, limit, windowMs)
    } catch {
      // Redis 일시 장애 → in-memory fallback
    }
  }
  return checkInMemory(key, limit, windowMs)
}

/** Rate Limit 관련 응답 헤더를 반환합니다 (in-memory 기준). */
export function rateLimitHeaders(
  key:   string,
  limit: number,
): Record<string, string> {
  const entry = store.get(key)
  if (!entry) return {}
  return {
    'X-RateLimit-Limit':     String(limit),
    'X-RateLimit-Remaining': String(Math.max(0, limit - entry.count)),
    'X-RateLimit-Reset':     String(Math.ceil((entry.resetAt - Date.now()) / 1000)),
  }
}
