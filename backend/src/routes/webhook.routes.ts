import type { Request } from 'express'
import { Router } from 'express'
import { prisma } from '@/lib/prisma.js'
import { getActivityById, getValidStravaAccessTokenForUser, validateWebhookToken } from '@/services/strava.service.js'
import { upsertSingleActivityFromStrava } from '@/services/activities.service.js'
import { generateDebrief } from '@/services/debrief.service.js'

export const webhookRouter = Router()

function hubQuery(req: Request, key: 'mode' | 'verify_token' | 'challenge'): string {
  const flat = req.query[`hub.${key}`]
  if (typeof flat === 'string' && flat.length > 0) {
    return flat
  }
  if (Array.isArray(flat) && typeof flat[0] === 'string' && flat[0].length > 0) {
    return flat[0]
  }
  const hub = req.query.hub
  if (hub && typeof hub === 'object' && !Array.isArray(hub)) {
    const v = (hub as Record<string, unknown>)[key === 'verify_token' ? 'verify_token' : key]
    if (typeof v === 'string' && v.length > 0) {
      return v
    }
  }
  return ''
}

webhookRouter.get('/strava', (req, res) => {
  const mode = hubQuery(req, 'mode')
  const token = hubQuery(req, 'verify_token')
  const challenge = hubQuery(req, 'challenge')
  if (mode !== 'subscribe' || !validateWebhookToken(token) || !challenge) {
    res.status(403).send('Forbidden')
    return
  }
  // Strava exige JSON con application/json (no texto plano).
  res.status(200).json({ 'hub.challenge': challenge })
})

interface StravaWebhookBody {
  object_type?: string
  aspect_type?: string
  object_id?: number
  owner_id?: number
}

webhookRouter.post('/strava', async (req, res) => {
  res.status(200).json({ ok: true })
  try {
    const body = req.body as StravaWebhookBody
    if (body.object_type !== 'activity') {
      return
    }
    if (body.aspect_type !== 'create' && body.aspect_type !== 'update') {
      return
    }
    if (!body.object_id || !body.owner_id) {
      return
    }
    const user = await prisma.user.findUnique({ where: { stravaId: body.owner_id } })
    if (!user) {
      return
    }
    const accessToken = await getValidStravaAccessTokenForUser(user.id)
    const activity = await getActivityById(accessToken, body.object_id)
    await upsertSingleActivityFromStrava(user.id, activity)
    const local = await prisma.activity.findUnique({
      where: { stravaId: BigInt(body.object_id) },
    })
    if (local && !local.debrief) {
      await generateDebrief(user.id, local.id)
    }
  } catch {
    // Webhook debe ser idempotente y silencioso
  }
})
