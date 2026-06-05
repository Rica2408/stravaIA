import Anthropic from '@anthropic-ai/sdk'
import { env } from '@/config/index.js'
import { prisma } from '@/lib/prisma.js'
import { applyPlanUpdateFromAssistant, getUpcomingPlanWeeksForUser, type PlanWeekWithSessions } from '@/services/plan.service.js'
import { formatDurationSeconds, formatPaceDecimalMinPerKm } from '@/lib/durationPaceFormat.js'
import { RUN_LIKE_ACTIVITY_TYPES, isRunLikeActivityType } from '@/lib/runType.js'
import { Goal, MessageRole, MessageType, SessionStatus, TrackStatus } from '@prisma/client'

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

const COACH_MODEL = 'claude-sonnet-4-20250514'

/** Respuesta fija cuando el mensaje no es de consulta running/entreno (sin segunda respuesta “creativa”). */
const OFF_TOPIC_COACH_REPLY =
  'Solo puedo orientarte sobre **running y entrenamiento**: tu plan, ritmos, volumen, recuperación, carrera objetivo, material (zapatillas, reloj), datos de la app o Strava, sensaciones al correr o ajustar sesiones. No atiendo otros temas (apps, programación, trabajo, etc.). ¿Qué necesitas saber de tu entrenamiento?'

const coachHits = new Map<string, number[]>()

function hitCoachRateLimit(userId: string): void {
  const now = Date.now()
  const windowMs = 60 * 60 * 1000
  const arr = (coachHits.get(userId) ?? []).filter((t) => now - t < windowMs)
  if (arr.length >= 20) {
    throw new Error('Límite de 20 mensajes por hora con el coach alcanzado')
  }
  arr.push(now)
  coachHits.set(userId, arr)
}

function weeksBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime()
  return Math.max(0, Math.ceil(ms / (7 * 24 * 60 * 60 * 1000)))
}

function parseTrackStatus(text: string): TrackStatus | null {
  const m = text.match(/TRACK_STATUS:\s*(ON_TRACK|AT_RISK|DANGER)/i)
  if (!m) {
    return null
  }
  const v = m[1].toUpperCase()
  if (v === 'ON_TRACK' || v === 'AT_RISK' || v === 'DANGER') {
    return v as TrackStatus
  }
  return null
}

/**
 * Clasificación estricta antes del coach principal: evita gastar tokens y respuestas fuera de alcance.
 * Si la API falla, se deja pasar el mensaje (mejor un falso positivo que bloquear al atleta).
 */
async function isCoachUserMessageOnTopic(userMessage: string): Promise<boolean> {
  const trimmed = userMessage.trim()
  if (trimmed.length === 0) {
    return false
  }

  try {
    const msg = await anthropic.messages.create({
      model: COACH_MODEL,
      max_tokens: 12,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content:
            'Eres un clasificador binario para un chat de SOLO consultas de running y entrenamiento.\n\n' +
            'ON_TOPIC: correr, plan, sesiones, series, rodajes, volumen, ritmo, FC, carrera objetivo, recuperación, descanso, fatiga, zapatillas/reloj, Strava/Garmin, datos de actividades, cancelar o mover entrenos, sensaciones al correr, nutrición/hidratación ligada a carreras, lesiones en contexto deportivo (orientación general, sin actuar como médico).\n\n' +
            'OFF_TOPIC: crear apps o software, programación, tareas escolares, matemáticas generales, trabajo, política, finanzas, salud no deportiva, terapia, cocina, viajes, chistes sin relación con el entreno, otros deportes sin vínculo claro con la carrera del usuario, uso de la IA para cualquier cosa no ligada a correr/entrenar.\n\n' +
            'Si mezcla charla irrelevante con una pregunta clara de entreno, responde ON_TOPIC.\n\n' +
            'Responde exactamente una palabra: ON_TOPIC u OFF_TOPIC. Sin puntuación ni explicación.\n\n' +
            `Mensaje del usuario:\n"""${trimmed.slice(0, 4000)}"""`,
        },
      ],
    })
    const part = msg.content.find((c) => c.type === 'text')
    if (!part || part.type !== 'text') {
      return true
    }
    const t = part.text.toUpperCase()
    if (/\bOFF_TOPIC\b/.test(t)) {
      return false
    }
    if (/\bON_TOPIC\b/.test(t)) {
      return true
    }
    return true
  } catch {
    return true
  }
}

function stripCoachArtifacts(raw: string): string {
  let out = raw.replace(/TRACK_STATUS:\s*(ON_TRACK|AT_RISK|DANGER)/gi, '').trim()
  const idx = out.indexOf('PLAN_UPDATE:')
  if (idx !== -1) {
    out = out.slice(0, idx).trim()
  }
  return out
}

function startOfWeekUtc(d: Date): Date {
  const x = new Date(d)
  const day = x.getUTCDay()
  const diff = (day + 6) % 7
  x.setUTCDate(x.getUTCDate() - diff)
  x.setUTCHours(0, 0, 0, 0)
  return x
}

function endOfWeekUtc(start: Date): Date {
  const e = new Date(start)
  e.setUTCDate(e.getUTCDate() + 7)
  return e
}

async function maybeRefreshConversationSummary(userId: string): Promise<void> {
  const total = await prisma.coachMessage.count({ where: { userId, type: MessageType.CHAT } })
  if (total < 40) {
    return
  }
  const oldest = await prisma.coachMessage.findMany({
    where: { userId, type: MessageType.CHAT },
    orderBy: { createdAt: 'asc' },
    take: 15,
  })
  if (oldest.length === 0) {
    return
  }
  const transcript = oldest.map((m) => `${m.role}: ${m.content}`).join('\n---\n')
  try {
    const msg = await anthropic.messages.create({
      model: COACH_MODEL,
      max_tokens: 400,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: `Resume en español en máximo 6 viñetas el hilo siguiente (entrenos, decisiones, tono emocional):\n${transcript}`,
        },
      ],
    })
    const part = msg.content.find((c) => c.type === 'text')
    if (!part || part.type !== 'text') {
      return
    }
    const summary = part.text.trim()
    await prisma.user.update({
      where: { id: userId },
      data: { conversationSummary: summary },
    })
  } catch {
    // No bloqueamos el chat si el resumen falla
  }
}

export async function sendMessage(
  userId: string,
  userMessage: string,
): Promise<{
  response: string
  planUpdated: boolean
  updatedPlan?: PlanWeekWithSessions[]
  onTrackStatus: TrackStatus
}> {
  hitCoachRateLimit(userId)

  const onTopic = await isCoachUserMessageOnTopic(userMessage)
  if (!onTopic) {
    const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!exists) {
      throw new Error('Usuario no encontrado')
    }
    const goalLite = await prisma.goal.findFirst({
      where: { userId, status: 'ACTIVE' },
      select: { id: true, onTrack: true },
    })
    const trackEarly = goalLite?.onTrack ?? TrackStatus.ON_TRACK

    await prisma.coachMessage.create({
      data: { userId, role: MessageRole.USER, content: userMessage, type: MessageType.CHAT },
    })
    await prisma.coachMessage.create({
      data: {
        userId,
        role: MessageRole.ASSISTANT,
        content: OFF_TOPIC_COACH_REPLY,
        type: MessageType.CHAT,
        metadata: { offTopic: true },
      },
    })

    return {
      response: OFF_TOPIC_COACH_REPLY,
      planUpdated: false,
      updatedPlan: undefined,
      onTrackStatus: trackEarly,
    }
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new Error('Usuario no encontrado')
  }

  const goal = await prisma.goal.findFirst({
    where: { userId, status: 'ACTIVE' },
    include: { plan: { include: { weeks: { include: { sessions: true } } } } },
  })

  const upcomingWeeks = await getUpcomingPlanWeeksForUser(userId, 3)
  const activities = await prisma.activity.findMany({
    where: { userId },
    orderBy: { startDate: 'desc' },
    take: 15,
  })

  const now = new Date()
  const weekStart = startOfWeekUtc(now)
  const weekEnd = endOfWeekUtc(weekStart)
  const weekActivities = await prisma.activity.findMany({
    where: { userId, startDate: { gte: weekStart, lt: weekEnd }, type: { in: [...RUN_LIKE_ACTIVITY_TYPES] } },
  })
  const kmWeek = weekActivities.reduce((acc, a) => acc + a.distance / 1000, 0)

  const sessionsThisWeek =
    goal?.plan?.weeks.flatMap((w) => w.sessions).filter((s) => s.scheduledDate >= weekStart && s.scheduledDate < weekEnd) ??
    []
  const completed = sessionsThisWeek.filter((s) => s.status === SessionStatus.COMPLETED).length
  const totalPlanned = sessionsThisWeek.filter((s) => s.sessionType !== 'REST').length
  const failed = sessionsThisWeek.filter((s) => s.status === SessionStatus.MISSED)

  const runs = activities.filter((a) => isRunLikeActivityType(a.type) && a.avgPace !== null)
  const last5 = runs.slice(0, 5).map((a) => a.avgPace as number)
  const prev5 = runs.slice(5, 10).map((a) => a.avgPace as number)
  let trend = 'estable'
  if (last5.length >= 3 && prev5.length >= 3) {
    const a1 = last5.reduce((a, b) => a + b, 0) / last5.length
    const a2 = prev5.reduce((a, b) => a + b, 0) / prev5.length
    if (a1 < a2 - 0.05) {
      trend = 'mejorando'
    } else if (a1 > a2 + 0.05) {
      trend = 'empeorando'
    }
  }

  const history = await prisma.coachMessage.findMany({
    where: { userId, type: MessageType.CHAT },
    orderBy: { createdAt: 'desc' },
    take: 25,
  })
  const orderedHistory = [...history].reverse()

  const goalBlock = goal
    ? `OBJETIVO DEL USUARIO:\n${goal.description}\nTipo: ${goal.type}\nDistancia (km): ${
        goal.targetDistanceKm ?? '—'
      }\nTiempo (min): ${goal.targetTimeMinutes ?? '—'}\nFecha límite: ${goal.targetDate.toISOString()}\nSemanas restantes: ${weeksBetween(
        now,
        goal.targetDate,
      )}`
    : 'OBJETIVO DEL USUARIO: aún no hay objetivo activo'

  const planJson = JSON.stringify(
    upcomingWeeks.slice(0, 2).map((w) => ({
      weekNumber: w.weekNumber,
      weekType: w.weekType,
      sessions: w.sessions.map((s) => ({
        id: s.id,
        date: s.scheduledDate,
        type: s.sessionType,
        distanceKm: s.plannedDistance,
        pace: s.plannedPace,
        durationMin: s.plannedDuration,
        status: s.status,
      })),
    })),
    null,
    2,
  )

  const activitiesBlock = activities
    .map((a) => {
      const km = a.distance / 1000
      return `- ${a.name} (${a.type}) ${km.toFixed(1)} km, duración ${formatDurationSeconds(a.duration)}, ritmo ${
        a.avgPace !== null ? formatPaceDecimalMinPerKm(a.avgPace) : 'n/d'
      }, FC ${a.avgHeartRate ?? 'n/d'}`
    })
    .join('\n')

  const summaryLine = user.conversationSummary ? `Resumen histórico (compacto):\n${user.conversationSummary}\n` : ''

  const system = `Eres el coach de running personal de ${user.displayName}. Tienes acceso completo a su historial de entrenamiento y debes actuar como un coach experto, empático y directo.

ALCANCE OBLIGATORIO: Solo respondes consultas sobre running y el entrenamiento de este atleta (plan, sesiones, ritmos, volumen, recuperación, carrera, material, datos de actividad, sensaciones, ajustes de calendario). Si el usuario insiste en temas ajenos (crear una app, programación, estudios, trabajo, política, otro deporte sin relación con su carrera, etc.), no ayudes con eso: una frase cordial que este chat es solo de entreno y redirige a una duda concreta de running. No des consejos parciales fuera de tema ni “de todos modos”.

${goalBlock}

ESTADO ACTUAL:
- Km esta semana: ${kmWeek.toFixed(1)}
- Sesiones completadas: ${completed}/${Math.max(totalPlanned, 1)}
- Sesiones falladas: ${failed.map((f) => `${f.sessionType} ${f.scheduledDate.toISOString()}`).join(', ') || 'ninguna'}
- Tendencia de ritmo: ${trend}

PLAN ACTUAL (próximas 2 semanas):
${planJson}

ÚLTIMAS ACTIVIDADES:
${activitiesBlock}

${summaryLine}
REGLAS:
1. Responde siempre en español
2. Sé conciso — máximo 3 párrafos
3. Cumple el ALCANCE: nada de desarrollo de software, apps, negocios ajenos al deporte ni consultas generales; solo running/entreno de este usuario
4. Si el usuario no puede entrenar un día, reorganiza el plan y devuelve el plan actualizado en JSON al final de tu respuesta con el formato: PLAN_UPDATE: {"sessions":[{"id":"...","scheduledDate":"ISO opcional","sessionType":"EASY","plannedDistance":5,"plannedPace":5.5,"plannedDuration":40,"notes":"texto","status":"PENDING"}]}  (plannedPace = minutos decimales por km, ej. 5.5 = 5:30/km; plannedDuration = minutos enteros de sesión)
5. Siempre termina evaluando si el objetivo es alcanzable: ON_TRACK, AT_RISK o DANGER con este formato: TRACK_STATUS: ON_TRACK
6. Nunca uses lenguaje médico — eres coach, no médico`

  const anthropicMessages = [
    ...orderedHistory.map((m) => ({
      role: m.role === MessageRole.USER ? ('user' as const) : ('assistant' as const),
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ]

  let assistantRaw = ''
  try {
    const msg = await anthropic.messages.create({
      model: COACH_MODEL,
      max_tokens: 1200,
      temperature: 0.6,
      system,
      messages: anthropicMessages,
    })
    const part = msg.content.find((c) => c.type === 'text')
    if (!part || part.type !== 'text') {
      throw new Error('Respuesta vacía del coach')
    }
    assistantRaw = part.text
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    throw new Error(`El coach de IA no está disponible: ${message}`)
  }

  const planResult = await applyPlanUpdateFromAssistant(userId, assistantRaw)
  const track = parseTrackStatus(assistantRaw) ?? goal?.onTrack ?? TrackStatus.ON_TRACK
  const cleanReply = stripCoachArtifacts(assistantRaw)

  if (goal) {
    await prisma.goal.update({ where: { id: goal.id }, data: { onTrack: track } })
  }

  await prisma.coachMessage.create({
    data: { userId, role: MessageRole.USER, content: userMessage, type: MessageType.CHAT },
  })
  await prisma.coachMessage.create({
    data: {
      userId,
      role: MessageRole.ASSISTANT,
      content: cleanReply,
      type: MessageType.CHAT,
      metadata: planResult.updated ? { planUpdated: true, sessionsTouched: planResult.count } : undefined,
    },
  })

  void maybeRefreshConversationSummary(userId)

  let updatedPlan: PlanWeekWithSessions[] | undefined
  if (planResult.updated) {
    updatedPlan = await getUpcomingPlanWeeksForUser(userId, 3)
  }

  return {
    response: cleanReply,
    planUpdated: planResult.updated,
    updatedPlan,
    onTrackStatus: track,
  }
}

export async function generateRaceBriefing(userId: string, goalId: string): Promise<string> {
  const goal = await prisma.goal.findFirst({
    where: { id: goalId, userId, status: 'ACTIVE' },
  })
  if (!goal) {
    throw new Error('Objetivo no encontrado')
  }

  const activities = await prisma.activity.findMany({
    where: { userId, type: { in: [...RUN_LIKE_ACTIVITY_TYPES] } },
    orderBy: { startDate: 'desc' },
    take: 40,
  })

  const prompt = `Eres coach de carrera. Mañana es el día del objetivo del atleta.
Genera un briefing en español con:
- Estrategia de ritmo (orienta splits km a km de forma práctica)
- Ritmo de salida recomendado
- Qué esperar en cada fase (inicio, mitad, cierre)
- Tips básicos de nutrición e hidratación (sin lenguaje médico)
- Mensaje motivacional personalizado según el historial

Objetivo:
${goal.description}
Distancia (km): ${goal.targetDistanceKm != null ? goal.targetDistanceKm : 'n/d'}
Tiempo (min): ${goal.targetTimeMinutes != null ? goal.targetTimeMinutes : 'n/d'}
Meta numérica (resumen): ${goal.targetValue}
Tipo: ${goal.type}
Fecha: ${goal.targetDate.toISOString()}

Historial reciente (corridas):
${activities
  .map((a) => {
    const km = a.distance / 1000
    return `- ${a.startDate.toISOString().slice(0, 10)}: ${km.toFixed(1)} km, ${formatDurationSeconds(a.duration)}, ritmo ${
      a.avgPace !== null ? formatPaceDecimalMinPerKm(a.avgPace) : 'n/d'
    }`
  })
  .join('\n')}`

  const msg = await anthropic.messages.create({
    model: COACH_MODEL,
    max_tokens: 1200,
    temperature: 0.55,
    messages: [{ role: 'user', content: prompt }],
  })
  const part = msg.content.find((c) => c.type === 'text')
  if (!part || part.type !== 'text') {
    throw new Error('Briefing vacío')
  }
  const text = part.text.trim()
  await prisma.coachMessage.create({
    data: {
      userId,
      role: 'ASSISTANT',
      content: text,
      type: MessageType.BRIEFING,
      metadata: { goalId: goal.id },
    },
  })
  return text
}

export async function checkUpcomingRaces(): Promise<void> {
  const tomorrow = new Date()
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const start = new Date(Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate(), 0, 0, 0))
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)

  const goals = await prisma.goal.findMany({
    where: {
      status: 'ACTIVE',
      type: 'RACE_TIME',
      targetDate: { gte: start, lt: end },
    },
  })

  for (const goal of goals) {
    const briefings = await prisma.coachMessage.findMany({
      where: { userId: goal.userId, type: MessageType.BRIEFING },
    })
    const done = briefings.some((b) => {
      const meta = b.metadata as { goalId?: string } | null
      return meta?.goalId === goal.id
    })
    if (done) {
      continue
    }
    try {
      await generateRaceBriefing(goal.userId, goal.id)
    } catch {
      // Continuamos con otros usuarios
    }
  }
}

export async function appendReplanCoachMessage(userId: string, goalDescription: string): Promise<void> {
  await prisma.coachMessage.create({
    data: {
      userId,
      role: MessageRole.ASSISTANT,
      type: MessageType.CHAT,
      content: `He aplicado los cambios a tu objetivo («${goalDescription}») y he vuelto a generar por completo el plan con IA usando tu historial reciente en Strava y la meta actualizada. Revisa el plan semanal y la vista de 3 semanas.`,
      metadata: { kind: 'replan' },
    },
  })
}

export async function generateWelcomeAfterPlan(userId: string, goal: Goal): Promise<void> {
  const weeks = await getUpcomingPlanWeeksForUser(userId, 2)
  const planJson = JSON.stringify(
    weeks.map((w) => ({
      weekNumber: w.weekNumber,
      weekType: w.weekType,
      sessions: w.sessions,
    })),
    null,
    2,
  )
  const msg = await anthropic.messages.create({
    model: COACH_MODEL,
    max_tokens: 800,
    temperature: 0.55,
    messages: [
      {
        role: 'user',
        content: `Eres el coach. El usuario acaba de crear este objetivo: ${goal.description}. 
Aquí está el plan generado (JSON):\n${planJson}\n
Escribe un mensaje de bienvenida en español (máximo 3 párrafos) explicando la lógica general de las próximas semanas y cómo empezar mañana.`,
      },
    ],
  })
  const part = msg.content.find((c) => c.type === 'text')
  if (!part || part.type !== 'text') {
    return
  }
  await prisma.coachMessage.create({
    data: {
      userId,
      role: 'ASSISTANT',
      content: part.text.trim(),
      type: MessageType.CHAT,
      metadata: { kind: 'welcome', goalId: goal.id },
    },
  })
}
