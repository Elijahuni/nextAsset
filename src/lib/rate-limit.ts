/**
 * In-memory Rate Limiter (외부 의존성 없음)
 *
 * 서버리스(Vercel) 환경에서는 인스턴스별로 카운터가 독립적으로 유지됩니다.
 * 엄격한 전역 제한이 필요한 경우 Upstash Redis로 교체하세요.
 *
 * 기본 설정: 사용자당 분당 10회
 */

interface Counter {
  count:   number
  resetAt: number
}

const store = new Map<string, Counter>()

// 5분마다 만료된 항목 정리
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    Array.from(store.entries()).forEach(([key, entry]) => {
      if (now > entry.resetAt) store.delete(key)
    })
  }, 5 * 60 * 1000)
}

/**
 * 요청이 허용 범위 내에 있으면 true, 초과했으면 false를 반환합니다.
 *
 * @param key       사용자/IP 단위 고유 키 (예: userId 또는 IP)
 * @param limit     윈도우당 최대 요청 수 (기본 10)
 * @param windowMs  윈도우 크기 밀리초 (기본 60,000 = 1분)
 */
export function checkRateLimit(
  key: string,
  limit = 10,
  windowMs = 60_000,
): boolean {
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

/** Rate Limit 관련 응답 헤더를 반환합니다. */
export function rateLimitHeaders(
  key: string,
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
