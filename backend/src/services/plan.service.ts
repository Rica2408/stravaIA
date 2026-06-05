import { env } from '@/config/index.js'
import { prisma } from '@/lib/prisma.js'
import {
  getAthleteActivities,
  getValidStravaAccessTokenForUser,
  type StravaActivity,
} from '@/services/strava.service.js'
import { formatPaceDecimalMinPerKm } from '@/lib/durationPaceFormat.js'
import { computeAvgPaceDecimalMinPerKmFromStrava } from '@/lib/stravaPace.js'
import Anthropic from '@anthropic-ai/sdk'
import { CLAUDE_SONNET_MODEL } from '@/lib/claudeModels.js'
import { Goal, Prisma, SessionStatus, SessionType, WeekType } from '@prisma/client'
import { z } from 'zod'

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

export type PlanWeekWithSessions = Prisma.PlanWeekGetPayload<{ include: { sessions: true } }>

const initialPlanSchema = z.object({
  weeks: z.array(
    z.object({
      weekNumber: z.number().int().positive(),
      weekStart: z.string(),
      weekType: z.nativeEnum(WeekType),
      sessions: z.array(
        z.object({
          scheduledDate: z.string(),
          sessionType: z.nativeEnum(SessionType),
          plannedDistance: z.number().nullable().optional(),
          plannedPace: z.number().nullable().optional(),
          plannedDuration: z.number().int().nullable().optional(),
          notes: z.string().nullable().optional(),
        }),
      ),
    }),
  ),
})

const planUpdateSchema = z.object({
  sessions: z.array(
    z.object({
      id: z.string(),
      scheduledDate: z.string().optional(),
      sessionType: z.nativeEnum(SessionType).optional(),
      plannedDistance: z.number().nullable().optional(),
      plannedPace: z.number().nullable().optional(),
      plannedDuration: z.number().int().nullable().optional(),
      notes: z.string().nullable().optional(),
      status: z.nativeEnum(SessionStatus).optional(),
    }),
  ),
})

function mapStravaToContext(activities: StravaActivity[]): string {
  return activities
    .map((a) => {
      const km = a.distance / 1000
      const paceDec = computeAvgPaceDecimalMinPerKmFromStrava(a)
      const paceLabel = paceDec !== null ? formatPaceDecimalMinPerKm(paceDec) : 'n/a'
      return `- ${a.name} (${a.type}) ${km.toFixed(1)} km, ritmo ${paceLabel}, FC media ${a.average_heartrate ?? 'n/d'}`
    })
    .join('\n')
}

export async function generateInitialPlan(userId: string, goal: Goal) {
  const accessToken = await getValidStravaAccessTokenForUser(userId)
  const eightWeeksAgo = Math.floor((Date.now() - 56 * 24 * 60 * 60 * 1000) / 1000)
  const activities = await getAthleteActivities(accessToken, eightWeeksAgo, 200)

  const system = `Eres un planificador de running experto. Debes responder SOLO con JSON válido sin markdown.
El JSON debe cumplir exactamente esta forma:
{
  "weeks": [
    {
      "weekNumber": number,
      "weekStart": "ISO date string",
      "weekType": "LOAD" | "RECOVERY" | "RACE",
      "sessions": [
        {
          "scheduledDate": "ISO datetime",
          "sessionType": "EASY" | "TEMPO" | "LONG" | "INTERVALS" | "REST" | "CROSS",
          "plannedDistance": number | null,
          "plannedPace": number | null,
          "plannedDuration": number | null,
          "notes": string | null
        }
      ]
    }
  ]
}
Reglas:
- Patrón de carga 3:1 (tres semanas LOAD, una RECOVERY).
- Incluye variedad: easy, tempo, long run, intervals.
- Ajusta volumen inicial al nivel actual inferido de actividades, no al objetivo final.
- La última semana antes de la fecha objetivo puede ser RACE si aplica.
- plannedDistance en km. plannedPace en minutos decimales por km (ej. 5.5 = 5 min 30 s/km). plannedDuration en minutos enteros de sesión.
- Genera al menos 4 semanas hacia adelante desde hoy.`

  const distLine =
    goal.targetDistanceKm != null ? `${goal.targetDistanceKm} km` : 'no especificada (solo tiempo o ritmo)'
  const timeLine =
    goal.targetTimeMinutes != null ? `${goal.targetTimeMinutes} min` : 'no especificado (solo distancia o ritmo)'

  const userBlock = `OBJETIVO:
${goal.description}
Tipo: ${goal.type}
Distancia asociada: ${distLine}
Tiempo asociado: ${timeLine}
Valor resumen (referencia): ${goal.targetValue}
Fecha objetivo: ${goal.targetDate.toISOString()}

ACTIVIDADES (últimas ~8 semanas):
${mapStravaToContext(activities)}`

  let text = ''
  try {
    const msg = await anthropic.messages.create({
      model: CLAUDE_SONNET_MODEL,
      max_tokens: 4096,
      temperature: 0.4,
      system,
      messages: [{ role: 'user', content: userBlock }],
    })
    const block = msg.content.find((b) => b.type === 'text')
    if (!block || block.type !== 'text') {
      throw new Error('Respuesta de Claude sin texto')
    }
    text = block.text.trim()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    throw new Error(`No se pudo generar el plan inicial con IA: ${message}`)
  }

  const jsonStart = text.indexOf('{')
  const jsonEnd = text.lastIndexOf('}')
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('El plan inicial no contenía JSON válido')
  }
  const parsedJson = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as unknown
  const parsed = initialPlanSchema.safeParse(parsedJson)
  if (!parsed.success) {
    throw new Error('El JSON del plan inicial no pasó la validación')
  }

  return prisma.$transaction(async (tx) => {
    const plan = await tx.trainingPlan.create({
      data: { goalId: goal.id },
    })
    for (const w of parsed.data.weeks) {
      const week = await tx.planWeek.create({
        data: {
          planId: plan.id,
          weekNumber: w.weekNumber,
          weekStart: new Date(w.weekStart),
          weekType: w.weekType,
        },
      })
      for (const s of w.sessions) {
        await tx.planSession.create({
          data: {
            weekId: week.id,
            scheduledDate: new Date(s.scheduledDate),
            sessionType: s.sessionType,
            plannedDistance: s.plannedDistance ?? null,
            plannedPace: s.plannedPace ?? null,
            plannedDuration: s.plannedDuration ?? null,
            notes: s.notes ?? null,
            status: SessionStatus.PENDING,
          },
        })
      }
    }
    return tx.trainingPlan.findUniqueOrThrow({
      where: { id: plan.id },
      include: { weeks: { include: { sessions: true }, orderBy: { weekNumber: 'asc' } } },
    })
  })
}

export async function applyPlanUpdateFromAssistant(
  userId: string,
  raw: string,
): Promise<{ updated: boolean; count: number }> {
  const marker = 'PLAN_UPDATE:'
  const idx = raw.indexOf(marker)
  if (idx === -1) {
    return { updated: false, count: 0 }
  }
  const jsonPart = raw.slice(idx + marker.length).trim()
  const braceStart = jsonPart.indexOf('{')
  const braceEnd = jsonPart.lastIndexOf('}')
  if (braceStart === -1 || braceEnd === -1) {
    return { updated: false, count: 0 }
  }
  let payload: unknown
  try {
    payload = JSON.parse(jsonPart.slice(braceStart, braceEnd + 1))
  } catch {
    return { updated: false, count: 0 }
  }
  const parsed = planUpdateSchema.safeParse(payload)
  if (!parsed.success) {
    return { updated: false, count: 0 }
  }

  const sessionIds = parsed.data.sessions.map((s) => s.id)
  const existing = await prisma.planSession.findMany({
    where: { id: { in: sessionIds } },
    include: { week: { include: { plan: { include: { goal: true } } } } },
  })
  const allowedIds = new Set(existing.filter((s) => s.week.plan.goal.userId === userId).map((s) => s.id))
  const updates = parsed.data.sessions.filter((u) => allowedIds.has(u.id))
  if (updates.length === 0) {
    return { updated: false, count: 0 }
  }

  await prisma.$transaction(
    updates.map((upd) => {
      const data: Prisma.PlanSessionUpdateInput = {}
      if (upd.scheduledDate) {
        data.scheduledDate = new Date(upd.scheduledDate)
      }
      if (upd.sessionType) {
        data.sessionType = upd.sessionType
      }
      if (upd.plannedDistance !== undefined) {
        data.plannedDistance = upd.plannedDistance
      }
      if (upd.plannedPace !== undefined) {
        data.plannedPace = upd.plannedPace
      }
      if (upd.plannedDuration !== undefined) {
        data.plannedDuration = upd.plannedDuration
      }
      if (upd.notes !== undefined) {
        data.notes = upd.notes
      }
      if (upd.status) {
        data.status = upd.status
      }
      return prisma.planSession.update({
        where: { id: upd.id },
        data,
      })
    }),
  )
  return { updated: true, count: updates.length }
}

export async function deleteTrainingPlanForGoal(goalId: string): Promise<void> {
  await prisma.trainingPlan.deleteMany({ where: { goalId } })
}

/** Borra el plan anterior y genera uno nuevo con IA (objetivo ya guardado en BD). */
export async function regenerateTrainingPlanForGoal(userId: string, goalId: string): Promise<void> {
  const goal = await prisma.goal.findFirst({
    where: { id: goalId, userId, status: 'ACTIVE' },
  })
  if (!goal) {
    throw new Error('Objetivo no encontrado o no está activo')
  }
  await deleteTrainingPlanForGoal(goalId)
  await generateInitialPlan(userId, goal)
}

export async function getUpcomingPlanWeeksForUser(
  userId: string,
  weeks = 3,
): Promise<PlanWeekWithSessions[]> {
  const now = new Date()
  const goal = await prisma.goal.findFirst({
    where: { userId, status: 'ACTIVE' },
    include: {
      plan: {
        include: {
          weeks: { include: { sessions: true }, orderBy: { weekStart: 'asc' } },
        },
      },
    },
  })
  if (!goal?.plan) {
    return []
  }
  const allWeeks = [...goal.plan.weeks].sort(
    (a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime(),
  )

  const endOfPlanWeek = (weekStart: Date) => {
    const e = new Date(weekStart)
    e.setDate(e.getDate() + 7)
    return e
  }

  // Semana “vigente”: la que aún no ha terminado del todo respecto a hoy
  const notFullyPast = allWeeks.filter((w) => endOfPlanWeek(w.weekStart) > now)
  if (notFullyPast.length > 0) {
    return notFullyPast.slice(0, weeks)
  }

  // Si Claude puso weekStart en el pasado, buscamos semanas con sesión aún futura (desde hoy 00:00)
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const withFutureSession = allWeeks.filter((w) =>
    w.sessions.some((s) => new Date(s.scheduledDate) >= startOfToday),
  )
  if (withFutureSession.length > 0) {
    return withFutureSession.slice(0, weeks)
  }

  // Último recurso: mostrar las primeras semanas del plan para que la UI no quede vacía
  return allWeeks.slice(0, weeks)
}
