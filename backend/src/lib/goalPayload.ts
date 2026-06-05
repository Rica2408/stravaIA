import { z } from 'zod'
import { GoalType } from '@prisma/client'

export const goalModeSchema = z.enum(['DISTANCE', 'RACE', 'TIME', 'PACE'])

function assertMetricsForMode(
  mode: z.infer<typeof goalModeSchema>,
  d: { distanceKm?: number; timeMinutes?: number; paceMinPerKm?: number },
  ctx: z.RefinementCtx,
) {
  switch (mode) {
    case 'DISTANCE':
      if (d.distanceKm == null) {
        ctx.addIssue({ code: 'custom', path: ['distanceKm'], message: 'Indica los kilómetros a sumar' })
      }
      break
    case 'RACE':
      if (d.distanceKm == null) {
        ctx.addIssue({ code: 'custom', path: ['distanceKm'], message: 'Indica la distancia de la prueba (km)' })
      }
      if (d.timeMinutes == null) {
        ctx.addIssue({ code: 'custom', path: ['timeMinutes'], message: 'Indica el tiempo objetivo (minutos)' })
      }
      break
    case 'TIME':
      if (d.timeMinutes == null) {
        ctx.addIssue({ code: 'custom', path: ['timeMinutes'], message: 'Indica los minutos totales de carrera' })
      }
      break
    case 'PACE':
      if (d.paceMinPerKm == null) {
        ctx.addIssue({
          code: 'custom',
          path: ['paceMinPerKm'],
          message: 'Indica el ritmo en min/km (decimal, ej. 5.5 = 5:30/km)',
        })
      }
      break
    default:
      break
  }
}

export const createGoalBodySchema = z
  .object({
    goalMode: goalModeSchema,
    description: z.string().min(3).max(500),
    targetDate: z.coerce.date(),
    distanceKm: z.number().positive().optional(),
    timeMinutes: z.number().positive().optional(),
    paceMinPerKm: z.number().positive().optional(),
  })
  .superRefine((d, ctx) => {
    assertMetricsForMode(d.goalMode, d, ctx)
  })

export type CreateGoalBody = z.infer<typeof createGoalBodySchema>

export function goalMetricsFromMode(
  goalMode: z.infer<typeof goalModeSchema>,
  parts: { distanceKm?: number; timeMinutes?: number; paceMinPerKm?: number },
): {
  type: GoalType
  targetValue: number
  targetDistanceKm: number | null
  targetTimeMinutes: number | null
} {
  switch (goalMode) {
    case 'DISTANCE': {
      const km = parts.distanceKm!
      return {
        type: GoalType.TOTAL_KM,
        targetValue: km,
        targetDistanceKm: km,
        targetTimeMinutes: null,
      }
    }
    case 'RACE': {
      const km = parts.distanceKm!
      const min = parts.timeMinutes!
      return {
        type: GoalType.RACE_TIME,
        targetValue: min,
        targetDistanceKm: km,
        targetTimeMinutes: min,
      }
    }
    case 'TIME': {
      const min = parts.timeMinutes!
      return {
        type: GoalType.TIME_TOTAL,
        targetValue: min,
        targetDistanceKm: null,
        targetTimeMinutes: min,
      }
    }
    case 'PACE': {
      const pace = parts.paceMinPerKm!
      return {
        type: GoalType.PACE_TARGET,
        targetValue: pace,
        targetDistanceKm: null,
        targetTimeMinutes: null,
      }
    }
  }
}

export function goalRowFromCreateBody(body: CreateGoalBody): {
  type: GoalType
  targetValue: number
  targetDistanceKm: number | null
  targetTimeMinutes: number | null
} {
  return goalMetricsFromMode(body.goalMode, {
    distanceKm: body.distanceKm,
    timeMinutes: body.timeMinutes,
    paceMinPerKm: body.paceMinPerKm,
  })
}

export const patchGoalBodySchema = z
  .object({
    goalMode: goalModeSchema.optional(),
    description: z.string().min(3).max(500).optional(),
    targetDate: z.coerce.date().optional(),
    distanceKm: z.number().positive().optional(),
    timeMinutes: z.number().positive().optional(),
    paceMinPerKm: z.number().positive().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.goalMode !== undefined) {
      assertMetricsForMode(d.goalMode, d, ctx)
    }
    const metricTouch =
      d.distanceKm !== undefined || d.timeMinutes !== undefined || d.paceMinPerKm !== undefined
    if (metricTouch && d.goalMode === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['goalMode'],
        message: 'Incluye goalMode al actualizar distancia, tiempo o ritmo',
      })
    }
  })

export type PatchGoalBody = z.infer<typeof patchGoalBodySchema>

export function goalRowFromPatchBody(body: PatchGoalBody): {
  type: GoalType
  targetValue: number
  targetDistanceKm: number | null
  targetTimeMinutes: number | null
} | null {
  if (body.goalMode === undefined) {
    return null
  }
  return goalMetricsFromMode(body.goalMode, {
    distanceKm: body.distanceKm,
    timeMinutes: body.timeMinutes,
    paceMinPerKm: body.paceMinPerKm,
  })
}
