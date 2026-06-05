import { prisma } from '@/lib/prisma.js'
import {
  getAthleteActivities,
  getValidStravaAccessTokenForUser,
  type StravaActivity,
} from '@/services/strava.service.js'
import { computeAvgPaceDecimalMinPerKmFromStrava } from '@/lib/stravaPace.js'

export function mapStravaActivityToPrisma(userId: string, a: StravaActivity) {
  const avgPace = computeAvgPaceDecimalMinPerKmFromStrava(a)
  return {
    userId,
    stravaId: BigInt(a.id),
    name: a.name,
    type: a.type,
    startDate: new Date(a.start_date),
    distance: a.distance,
    duration: a.moving_time,
    avgPace,
    avgHeartRate: a.average_heartrate ?? null,
    maxHeartRate: a.max_heartrate ?? null,
    elevationGain: a.total_elevation_gain ?? null,
    calories: a.calories ?? null,
    mapPolyline: a.map?.summary_polyline ?? null,
  }
}

export async function syncActivitiesFromStrava(userId: string, limit = 60): Promise<number> {
  const accessToken = await getValidStravaAccessTokenForUser(userId)
  let before: number | undefined
  let count = 0
  while (count < limit) {
    const perPage = Math.min(50, limit - count)
    const batch = await getAthleteActivities(accessToken, undefined, perPage, before)
    if (batch.length === 0) {
      break
    }
    for (const a of batch) {
      const data = mapStravaActivityToPrisma(userId, a)
      await prisma.activity.upsert({
        where: { stravaId: data.stravaId },
        create: data,
        update: {
          name: data.name,
          type: data.type,
          startDate: data.startDate,
          distance: data.distance,
          duration: data.duration,
          avgPace: data.avgPace,
          avgHeartRate: data.avgHeartRate,
          maxHeartRate: data.maxHeartRate,
          elevationGain: data.elevationGain,
          calories: data.calories,
          mapPolyline: data.mapPolyline,
        },
      })
      count += 1
      if (count >= limit) {
        break
      }
    }
    const oldest = batch[batch.length - 1]
    before = Math.floor(new Date(oldest.start_date).getTime() / 1000)
    if (batch.length < perPage) {
      break
    }
  }
  return count
}

export async function upsertSingleActivityFromStrava(userId: string, activity: StravaActivity): Promise<void> {
  const data = mapStravaActivityToPrisma(userId, activity)
  await prisma.activity.upsert({
    where: { stravaId: data.stravaId },
    create: data,
    update: {
      name: data.name,
      type: data.type,
      startDate: data.startDate,
      distance: data.distance,
      duration: data.duration,
      avgPace: data.avgPace,
      avgHeartRate: data.avgHeartRate,
      maxHeartRate: data.maxHeartRate,
      elevationGain: data.elevationGain,
      calories: data.calories,
      mapPolyline: data.mapPolyline,
    },
  })
}
