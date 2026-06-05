import { env } from '@/config/index.js'
import { prisma } from '@/lib/prisma.js'
import { formatDurationSeconds, formatPaceDecimalMinPerKm } from '@/lib/durationPaceFormat.js'
import Anthropic from '@anthropic-ai/sdk'
import { CLAUDE_HAIKU_MODEL } from '@/lib/claudeModels.js'
import { recordAiUsage, usageFromAnthropicMessage } from '@/lib/recordAiUsage.js'
import { MessageType } from '@prisma/client'

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

export async function generateDebrief(userId: string, activityId: string): Promise<string> {
  const activity = await prisma.activity.findFirst({
    where: { id: activityId, userId },
    include: {
      sessions: { include: { week: true } },
    },
  })
  if (!activity) {
    throw new Error('Actividad no encontrada')
  }

  const goal = await prisma.goal.findFirst({
    where: { userId, status: 'ACTIVE' },
  })

  const recent = await prisma.activity.findMany({
    where: { userId, id: { not: activity.id } },
    orderBy: { startDate: 'desc' },
    take: 3,
  })

  const planned = activity.sessions[0]
  const km = activity.distance / 1000
  const block = `Actividad recién completada:
- Nombre: ${activity.name}
- Tipo: ${activity.type}
- Distancia: ${km.toFixed(2)} km
- Duración: ${formatDurationSeconds(activity.duration)}
- Ritmo medio: ${activity.avgPace !== null ? formatPaceDecimalMinPerKm(activity.avgPace) : 'n/d'}
- FC media: ${activity.avgHeartRate ?? 'n/d'}
- Elevación: ${activity.elevationGain ?? 'n/d'} m

Sesión planificada ese día (si aplica):
${
  planned
    ? JSON.stringify({
        sessionType: planned.sessionType,
        plannedDistanceKm: planned.plannedDistance,
        plannedPaceMinPerKm: planned.plannedPace,
        plannedDurationMin: planned.plannedDuration,
      })
    : 'No había sesión enlazada'
}

Últimas 3 actividades previas (contexto fatiga):
${recent
  .map((a) => {
    const k = a.distance / 1000
    return `- ${a.name}: ${k.toFixed(1)} km, ${formatDurationSeconds(a.duration)}, ritmo ${
      a.avgPace !== null ? formatPaceDecimalMinPerKm(a.avgPace) : 'n/d'
    }`
  })
  .join('\n')}

Objetivo activo:
${goal ? `${goal.description} | fecha ${goal.targetDate.toISOString()}` : 'Sin objetivo activo'}

Instrucciones:
- Máximo 2 párrafos en español.
- Explica qué pasó, si encaja con el plan, y una recomendación concreta para el siguiente entreno.
- No uses lenguaje médico.`

  try {
    const msg = await anthropic.messages.create({
      model: CLAUDE_HAIKU_MODEL,
      max_tokens: 700,
      temperature: 0.5,
      messages: [{ role: 'user', content: block }],
    })
    const usage = usageFromAnthropicMessage(msg)
    await recordAiUsage({
      userId,
      operation: 'debrief',
      model: CLAUDE_HAIKU_MODEL,
      ...usage,
    })
    const part = msg.content.find((c) => c.type === 'text')
    if (!part || part.type !== 'text') {
      throw new Error('Respuesta vacía del coach')
    }
    const text = part.text.trim()
    await prisma.activity.update({
      where: { id: activity.id },
      data: { debrief: text, debriefAt: new Date() },
    })
    await prisma.coachMessage.create({
      data: {
        userId,
        role: 'ASSISTANT',
        content: text,
        type: MessageType.DEBRIEF,
        metadata: { activityId: activity.id },
      },
    })
    return text
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    throw new Error(`No se pudo generar el debrief: ${message}`)
  }
}
