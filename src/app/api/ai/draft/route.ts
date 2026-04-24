import { NextRequest } from 'next/server'
import { callGemini } from '@/lib/gemini'
import { badRequest, ok, serverError } from '@/lib/api-response'

// 원본 handleAiDraftReason의 systemInstruction / prompt 구조 그대로 이식

const SYSTEM_INSTRUCTION =
  '당신은 직장인을 위한 기안서 작성 AI 어시스턴트입니다. ' +
  '사용자가 입력한 짧은 키워드나 문장을 바탕으로, 회사의 상급자(팀장/부서장)에게 결재를 올리기 적합한 ' +
  '포멀하고 정중한 사유서 텍스트로 다듬어 주세요. ' +
  '1~2 단락 정도로 간결하면서도 명확하게 작성하며, 긍정적이거나 전문적인 단어를 사용하세요. ' +
  '작성된 텍스트 내용만 출력하세요.'

// POST /api/ai/draft
// Body: { approvalType, targetAssets, draftReason }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { approvalType, targetAssets, draftReason } = body

    if (!draftReason?.trim()) {
      return badRequest('draftReason is required — 간단한 키워드를 먼저 입력해 주세요')
    }

    const prompt =
      `결재 유형: ${approvalType ?? '미지정'}\n` +
      `대상 자산: ${targetAssets || '미지정'}\n` +
      `사용자 입력 내용(초안): ${draftReason}\n\n` +
      '위 내용을 바탕으로 결재 승인권자에게 올릴 상세하고 격식 있는 사유서를 작성해 주세요.'

    const text = await callGemini(prompt, SYSTEM_INSTRUCTION)
    return ok({ text: text.trim() })
  } catch (error) {
    return serverError(error)
  }
}
