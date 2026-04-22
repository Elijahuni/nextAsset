// 원본 callGeminiAPI 헬퍼를 서버 전용 모듈로 분리 (Exponential Backoff 유지)

const GEMINI_MODEL = 'gemini-2.5-flash-preview-09-2025'
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

export async function callGemini(
  prompt: string,
  systemInstruction: string,
  retries = 5,
  delay = 1000
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const url = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Gemini HTTP ${res.status}: ${errText}`)
    }

    const data = await res.json()
    return (data.candidates?.[0]?.content?.parts?.[0]?.text as string) ?? ''
  } catch (error) {
    if (retries === 0) throw error
    await new Promise((r) => setTimeout(r, delay))
    return callGemini(prompt, systemInstruction, retries - 1, delay * 2)
  }
}
