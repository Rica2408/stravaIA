import { env } from '@/config/index.js'
import { prisma } from '@/lib/prisma.js'
import Anthropic from '@anthropic-ai/sdk'
import { MessageType, SessionStatus } from '@prisma/client'

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

function startOfUtcDay(d: Date): Date {
  const x = new Date(d)
  x.setUTCHours(0, 0, 0, 0)
  return x
}

export async function checkInactivity(): Promise<void> {
  const goals = await prisma.goal.findMany({
    where: { status: 'ACTIVE' },
    include: {
      user: true,
      plan: {
        include: {
          weeks: {
            include: { sessions: true },
          },
        },
      },
    },
  })

  const now = new Date()
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)

  for (const goal of goals) {
    if (!goal.plan) {
      continue
    }
    const lastActivity = await prisma.activity.findFirst({
      where: { userId: goal.userId },
      orderBy: { startDate: 'desc' },
    })
    if (lastActivity && lastActivity.startDate > twoDaysAgo) {
      continue
    }

    const pendingSessions = goal.plan.weeks.flatMap((w) => w.sessions).filter((s) => {
      if (s.status !== SessionStatus.PENDING) {
        return false
      }
      return s.scheduledDate <= now && s.scheduledDate >= twoDaysAgo
    })
    if (pendingSessions.length === 0) {
      continue
    }

    const already = await prisma.coachMessage.findFirst({
      where: {
        userId: goal.userId,
        type: MessageType.PROACTIVE,
        createdAt: { gte: startOfUtcDay(now) },
      },
    })
    if (already) {
      continue
    }

    const prompt = `Eres el coach del usuario. Lleva al menos 2 días sin registrar actividad en Strava y tenía sesiones planificadas recientes.
Genera un mensaje breve (máximo 2 párrafos) en español: empático, directo, sin lenguaje médico, proponiendo cómo retomar sin culpa.
Objetivo: ${goal.description}`

    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        temperature: 0.6,
        messages: [{ role: 'user', content: prompt }],
      })
      const part = msg.content.find((c) => c.type === 'text')
      if (!part || part.type !== 'text') {
        continue
      }
      const text = part.text.trim()
      await prisma.coachMessage.create({
        data: {
          userId: goal.userId,
          role: 'ASSISTANT',
          content: text,
          type: MessageType.PROACTIVE,
          metadata: { reason: 'inactivity' },
        },
      })
    } catch {
      // Evitamos tumbar el job completo si un usuario falla
    }
  }
}
