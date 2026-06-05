import { isRunLikeActivityType } from '@/lib/runType.js'
import type { StravaActivity } from '@/services/strava.service.js'

/**
 * Ritmo medio en minutos decimales por km (como usa la BD).
 * Prioriza average_speed de Strava (m/s) para alinear con la app; si no, distancia/tiempo.
 */
export function computeAvgPaceDecimalMinPerKmFromStrava(activity: StravaActivity): number | null {
  if (!isRunLikeActivityType(activity.type) || activity.distance <= 0 || activity.moving_time <= 0) {
    return null
  }
  const speed = activity.average_speed
  if (typeof speed === 'number' && speed > 0) {
    return 1000 / (60 * speed)
  }
  const km = activity.distance / 1000
  return activity.moving_time / 60 / km
}
