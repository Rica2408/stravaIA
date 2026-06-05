import { prisma } from '@/lib/prisma.js'

export type AiOperation =
  | 'plan_generate'
  | 'coach_classify'
  | 'coach_summary'
  | 'coach_chat'
  | 'coach_briefing'
  | 'coach_welcome'
  | 'debrief'
  | 'proactive'

export async function recordAiUsage(params: {
  userId: string
  operation: AiOperation
  model: string
  inputTokens: number
  outputTokens: number
}): Promise<void> {
  const { userId, operation, model, inputTokens, outputTokens } = params
  if (inputTokens <= 0 && outputTokens <= 0) {
    return
  }
  try {
    await prisma.aiUsageLog.create({
      data: {
        userId,
        operation,
        model,
        inputTokens,
        outputTokens,
      },
    })
  } catch {
    // El uso de IA no debe tumbar la petición principal
  }
}

export function usageFromAnthropicMessage(msg: {
  usage?: { input_tokens?: number; output_tokens?: number }
}): { inputTokens: number; outputTokens: number } {
  return {
    inputTokens: msg.usage?.input_tokens ?? 0,
    outputTokens: msg.usage?.output_tokens ?? 0,
  }
}
