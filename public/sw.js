const CACHE = 'nextasset-v2'

const APP_SHELL = [
  '/',
  '/assets',
  '/approvals',
  '/depreciation',
  '/reports',
]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const url = e.request.url

  // Next.js 내부 리소스(청크, HMR, 이미지 최적화 등)는 절대 캐시하지 않고 네트워크 직통
  if (url.includes('/_next/')) {
    e.respondWith(fetch(e.request))
    return
  }

  // API 요청은 네트워크 우선, 실패 시 캐시
  if (url.includes('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    )
    return
  }

  // 페이지 요청은 캐시 우선 (오프라인 지원)
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached
      return fetch(e.request).then((res) => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(e.request, clone))
        }
        return res
      })
    })
  )
})
