// 원본 callGeminiAPI 헬퍼를 서버 전용 모듈로 분리 (AbortController 타임아웃 + Exponential Backoff)

const GEMINI_MODEL   = 'gemini-2.5-flash-preview-09-2025'
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

// Vercel 무료 플랜 함수 타임아웃 10초 이내 보장 — 1회 요청 8초 + 재시도 2회
const REQUEST_TIMEOUT_MS = 8_000
const MAX_RETRIES        = 2

export async function callGemini(
  prompt: string,
  systemInstruction: string,
  retries = MAX_RETRIES,
  delay   = 1000,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const url = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`

  const payload = {
    contents:          [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
  }

  // AbortController로 단일 요청 8초 제한 — Vercel 10초 함수 타임아웃 초과 방지
  const controller = new AbortController()
  const timeoutId  = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Gemini HTTP ${res.status}: ${errText}`)
    }

    const data = await res.json()
    return (data.candidates?.[0]?.content?.parts?.[0]?.text as string) ?? ''
  } catch (error) {
    clearTimeout(timeoutId)
    if (retries === 0) throw error
    await new Promise((r) => setTimeout(r, delay))
    return callGemini(prompt, systemInstruction, retries - 1, delay * 2)
  }
}
