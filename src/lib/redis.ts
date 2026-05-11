import { Redis } from '@upstash/redis'

// Redis가 설정되지 않은 환경(개발 로컬 등)에서도 빌드가 깨지지 않도록 조건부 초기화
let redis: Redis | null = null

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}

/**
 * 캐시 조회 → miss 시 fetcher 실행 후 저장
 * Redis 미설정이면 항상 fetcher 실행 (no-op fallback)
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  if (!redis) return fetcher()

  try {
    const cached = await redis.get<T>(key)
    if (cached !== null) return cached

    const data = await fetcher()
    await redis.setex(key, ttlSeconds, JSON.stringify(data))
    return data
  } catch {
    // Redis 오류 시 DB 직접 조회로 fallback
    return fetcher()
  }
}

/** 패턴 매칭 키 무효화 */
export async function invalidateCache(keys: string[]) {
  if (!redis || keys.length === 0) return
  try {
    await redis.del(...keys)
  } catch {}
}

export { redis }
