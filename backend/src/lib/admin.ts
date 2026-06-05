import { env } from '@/config/index.js'
import { prisma } from '@/lib/prisma.js'

export function parseAdminStravaIds(raw?: string): Set<number> {
  if (!raw?.trim()) {
    return new Set()
  }
  return new Set(
    raw
      .split(',')
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n)),
  )
}

export function isStravaIdAdmin(stravaId: number): boolean {
  return parseAdminStravaIds(env.ADMIN_STRAVA_IDS).has(stravaId)
}

export async function isAdminUser(userId: string): Promise<boolean> {
  const allowed = parseAdminStravaIds(env.ADMIN_STRAVA_IDS)
  if (allowed.size === 0) {
    return false
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stravaId: true },
  })
  return user ? allowed.has(user.stravaId) : false
}
