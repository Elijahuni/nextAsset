import { NextRequest } from 'next/server'
import { callGemini } from '@/lib/gemini'
import { badRequest, ok, serverError } from '@/lib/api-response'

// 원본 handleGenerateAiReport의 systemInstruction / prompt 구조 그대로 이식

const SYSTEM_INSTRUCTION =
  '당신은 대기업의 전문적인 재무/자산관리 분석가입니다. ' +
  '주어진 자산 통계 데이터를 분석하여, 경영진이 한눈에 파악할 수 있는 핵심적인 인사이트를 3문장 이내로 요약해 주십시오. ' +
  '긍정적인 점, 주의할 점(예: 수리중인 자산 비율), 그리고 향후 권고사항을 부드러운 전문가 톤으로 작성하세요.'

// POST /api/ai/report
// Body: { totalAssets, totalValue, inUseAssets, repairingAssets, disposedAssets, topDepartments, topCategories }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      totalAssets, totalValue, inUseAssets,
      repairingAssets, disposedAssets,
      topDepartments, topCategories,
    } = body

    if (totalAssets == null) return badRequest('totalAssets is required')

    const promptData = {
      totalAssets,
      totalValue,
      inUseAssets,
      repairingAssets: repairingAssets ?? 0,
      disposedAssets: disposedAssets ?? 0,
      topDepartments: topDepartments ?? [],
      topCategories: topCategories ?? [],
    }

    const prompt =
      `현재 우리 회사의 자산 통계 요약 데이터입니다:\n${JSON.stringify(promptData, null, 2)}\n` +
      '이 데이터를 바탕으로 자산 건전성 분석 보고서를 작성해 주세요.'

    const text = await callGemini(prompt, SYSTEM_INSTRUCTION)
    return ok({ text })
  } catch (error) {
    return serverError(error)
  }
}
