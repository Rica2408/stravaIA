import { env } from '@/config/index.js'

import { decryptSecret, encryptSecret } from '@/lib/cryptoTokens.js'

import { prisma } from '@/lib/prisma.js'



const STRAVA_API = 'https://www.strava.com/api/v3'

const STRAVA_OAUTH = 'https://www.strava.com/oauth'



const RATE_WINDOW_MS = 15 * 60 * 1000

const RATE_MAX = 95

const requestTimestamps: number[] = []



async function throttleStravaRequest(): Promise<void> {

  const now = Date.now()

  while (requestTimestamps.length > 0 && now - requestTimestamps[0] > RATE_WINDOW_MS) {

    requestTimestamps.shift()

  }

  if (requestTimestamps.length >= RATE_MAX) {

    const wait = RATE_WINDOW_MS - (now - requestTimestamps[0])

    await new Promise((r) => setTimeout(r, Math.max(wait, 100)))

    return throttleStravaRequest()

  }

  requestTimestamps.push(Date.now())

}



async function stravaFetch(input: string, init: RequestInit & { accessToken: string }): Promise<Response> {

  await throttleStravaRequest()

  const { accessToken, ...rest } = init

  const headers = new Headers(rest.headers)

  headers.set('Authorization', `Bearer ${accessToken}`)

  return fetch(input, { ...rest, headers })

}



export interface StravaAthlete {

  id: number

  firstname: string

  lastname: string

  profile: string

  city?: string

  country?: string

}



/** Respuesta de GET /athlete (campos opcionales según privacidad del atleta). */

export interface StravaAthleteProfile {

  id: number

  username?: string | null

  firstname: string

  lastname: string

  city?: string | null

  state?: string | null

  country?: string | null

  sex?: string | null

  bio?: string | null

  weight?: number | null

  measurement_preference?: string | null

  profile?: string | null

  profile_medium?: string | null

  created_at?: string

  updated_at?: string

}



export interface StravaTokens {

  accessToken: string

  refreshToken: string

  expiresAt: number

  athlete: StravaAthlete

}



export interface StravaActivity {

  id: number

  name: string

  type: string

  start_date: string

  distance: number

  moving_time: number

  average_heartrate?: number

  max_heartrate?: number

  total_elevation_gain: number

  calories?: number

  map?: { summary_polyline?: string }

  average_speed?: number

}



export interface StravaStats {

  biggest_ride_distance?: number

  biggest_climb_elevation_gain?: number

  recent_ride_totals?: { count: number; distance: number; moving_time: number; elevation_gain?: number }

  recent_run_totals?: { count: number; distance: number; moving_time: number; elevation_gain?: number }

  recent_swim_totals?: { count: number; distance: number; moving_time: number }

  ytd_ride_totals?: { count: number; distance: number; moving_time: number }

  ytd_run_totals?: { count: number; distance: number; moving_time: number }

  ytd_swim_totals?: { count: number; distance: number; moving_time: number }

  all_ride_totals?: { count: number; distance: number; moving_time: number }

  all_run_totals?: { count: number; distance: number; moving_time: number }

  all_swim_totals?: { count: number; distance: number; moving_time: number }

}



export interface StravaZones {

  heart_rate?: {

    custom_zones: boolean

    zones: Array<{ min: number; max: number }>

  }

  power?: {

    zones: Array<{ min: number; max: number }>

  }

}



export function getAuthorizationUrl(): string {

  const params = new URLSearchParams({

    client_id: env.STRAVA_CLIENT_ID,

    redirect_uri: env.STRAVA_REDIRECT_URI,

    response_type: 'code',

    approval_prompt: 'force',

    scope: 'read,activity:read_all,profile:read_all',

  })

  return `https://www.strava.com/oauth/authorize?${params.toString()}`

}



export async function exchangeCodeForTokens(code: string): Promise<StravaTokens> {

  const body = new URLSearchParams({

    client_id: env.STRAVA_CLIENT_ID,

    client_secret: env.STRAVA_CLIENT_SECRET,

    code,

    grant_type: 'authorization_code',

  })

  const res = await fetch(`${STRAVA_OAUTH}/token`, {

    method: 'POST',

    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },

    body,

  })

  if (!res.ok) {

    const text = await res.text()

    throw new Error(`Strava token exchange falló (${res.status}): ${text}`)

  }

  const data = (await res.json()) as {

    access_token: string

    refresh_token: string

    expires_at: number

    athlete: StravaAthlete

  }

  return {

    accessToken: data.access_token,

    refreshToken: data.refresh_token,

    expiresAt: data.expires_at,

    athlete: data.athlete,

  }

}



export async function refreshAccessToken(refreshToken: string): Promise<StravaTokens> {

  const body = new URLSearchParams({

    client_id: env.STRAVA_CLIENT_ID,

    client_secret: env.STRAVA_CLIENT_SECRET,

    grant_type: 'refresh_token',

    refresh_token: refreshToken,

  })

  const res = await fetch(`${STRAVA_OAUTH}/token`, {

    method: 'POST',

    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },

    body,

  })

  if (!res.ok) {

    const text = await res.text()

    throw new Error(`Strava refresh token falló (${res.status}): ${text}`)

  }

  const data = (await res.json()) as {

    access_token: string

    refresh_token: string

    expires_at: number

    athlete: StravaAthlete

  }

  return {

    accessToken: data.access_token,

    refreshToken: data.refresh_token,

    expiresAt: data.expires_at,

    athlete: data.athlete,

  }

}



/** Perfil completo del atleta autenticado (GET /api/v3/athlete). */

export async function getAuthenticatedAthlete(accessToken: string): Promise<StravaAthleteProfile> {

  const res = await stravaFetch(`${STRAVA_API}/athlete`, {

    method: 'GET',

    accessToken,

  })

  if (!res.ok) {

    const text = await res.text()

    throw new Error(`Strava athlete falló (${res.status}): ${text}`)

  }

  return (await res.json()) as StravaAthleteProfile

}



export async function getAthleteActivities(

  accessToken: string,

  after?: number,

  per_page = 30,

  before?: number,

): Promise<StravaActivity[]> {

  const params = new URLSearchParams({ per_page: String(per_page) })

  if (after !== undefined) {

    params.set('after', String(after))

  }

  if (before !== undefined) {

    params.set('before', String(before))

  }

  const res = await stravaFetch(`${STRAVA_API}/athlete/activities?${params.toString()}`, {

    method: 'GET',

    accessToken,

  })

  if (!res.ok) {

    const text = await res.text()

    throw new Error(`Strava activities falló (${res.status}): ${text}`)

  }

  return (await res.json()) as StravaActivity[]

}



export async function getAthleteStats(accessToken: string, athleteId: number): Promise<StravaStats> {

  const res = await stravaFetch(`${STRAVA_API}/athletes/${athleteId}/stats`, {

    method: 'GET',

    accessToken,

  })

  if (!res.ok) {

    const text = await res.text()

    throw new Error(`Strava stats falló (${res.status}): ${text}`)

  }

  return (await res.json()) as StravaStats

}



export async function getAthleteZones(accessToken: string): Promise<StravaZones> {

  const res = await stravaFetch(`${STRAVA_API}/athlete/zones`, {

    method: 'GET',

    accessToken,

  })

  if (!res.ok) {

    const text = await res.text()

    throw new Error(`Strava zones falló (${res.status}): ${text}`)

  }

  return (await res.json()) as StravaZones

}



export async function getActivityById(accessToken: string, activityId: number): Promise<StravaActivity> {

  const res = await stravaFetch(`${STRAVA_API}/activities/${activityId}?include_all_efforts=false`, {

    method: 'GET',

    accessToken,

  })

  if (!res.ok) {

    const text = await res.text()

    throw new Error(`Strava activity detail falló (${res.status}): ${text}`)

  }

  return (await res.json()) as StravaActivity

}



/** URL pública donde Strava envía POST de eventos (mismo host que STRAVA_REDIRECT_URI). */
export function getStravaWebhookCallbackUrl(): string {
  const callbackUrl = new URL(env.STRAVA_REDIRECT_URI)
  callbackUrl.pathname = '/webhook/strava'
  return callbackUrl.toString()
}

interface StravaPushSubscription {
  id: number
  callback_url?: string
}

function normalizeWebhookCallbackUrl(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ''
    u.pathname = u.pathname.replace(/\/+$/, '') || '/'
    return u.toString()
  } catch {
    return url.trim()
  }
}

export async function listWebhookSubscriptions(): Promise<StravaPushSubscription[]> {
  const params = new URLSearchParams({
    client_id: env.STRAVA_CLIENT_ID,
    client_secret: env.STRAVA_CLIENT_SECRET,
  })
  const res = await fetch(`${STRAVA_API}/push_subscriptions?${params}`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Strava list webhooks falló (${res.status}): ${text}`)
  }
  const data: unknown = await res.json()
  if (Array.isArray(data)) {
    return data as StravaPushSubscription[]
  }
  if (data && typeof data === 'object' && 'id' in data) {
    return [data as StravaPushSubscription]
  }
  return []
}

export async function deleteWebhookSubscription(id: number): Promise<void> {
  const params = new URLSearchParams({
    client_id: env.STRAVA_CLIENT_ID,
    client_secret: env.STRAVA_CLIENT_SECRET,
  })
  const res = await fetch(`${STRAVA_API}/push_subscriptions/${id}?${params}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) {
    const text = await res.text()
    throw new Error(`Strava delete webhook ${id} falló (${res.status}): ${text}`)
  }
}

/**
 * Strava permite una sola suscripción por aplicación. Borra callbacks viejos y crea la correcta si falta.
 * Requiere que esta API sea alcanzable por HTTPS en la URL de callback (validación GET al crear).
 */
export async function ensureStravaWebhookSubscription(): Promise<void> {
  const expected = normalizeWebhookCallbackUrl(getStravaWebhookCallbackUrl())
  const subs = await listWebhookSubscriptions()
  for (const sub of subs) {
    const cb = sub.callback_url ? normalizeWebhookCallbackUrl(sub.callback_url) : ''
    if (cb && cb !== expected) {
      await deleteWebhookSubscription(sub.id)
    }
  }
  const afterDeletes = await listWebhookSubscriptions()
  const hasCorrect = afterDeletes.some(
    (s) => s.callback_url && normalizeWebhookCallbackUrl(s.callback_url) === expected,
  )
  if (hasCorrect) {
    console.log('[webhook] Suscripción Strava ya activa:', expected)
    return
  }
  await registerWebhook()
  console.log('[webhook] Suscripción Strava registrada:', expected)
}

export async function registerWebhook(): Promise<void> {
  const callbackUrl = getStravaWebhookCallbackUrl()
  const body = new URLSearchParams({
    client_id: env.STRAVA_CLIENT_ID,
    client_secret: env.STRAVA_CLIENT_SECRET,
    callback_url: callbackUrl,
    verify_token: env.STRAVA_VERIFY_TOKEN,
  })
  const res = await fetch(`${STRAVA_API}/push_subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Strava register webhook falló (${res.status}): ${text}`)
  }
}

export function validateWebhookToken(token: string): boolean {

  return token === env.STRAVA_VERIFY_TOKEN

}



const ONE_HOUR_MS = 60 * 60 * 1000



export async function getValidStravaAccessTokenForUser(userId: string): Promise<string> {

  const user = await prisma.user.findUnique({ where: { id: userId } })

  if (!user) {

    throw new Error('Usuario no encontrado para token Strava')

  }

  const accessToken = decryptSecret(user.accessToken)

  const refreshToken = decryptSecret(user.refreshToken)

  const expiresAtMs = user.tokenExpiresAt.getTime()

  if (expiresAtMs > Date.now() + ONE_HOUR_MS) {

    return accessToken

  }

  const refreshed = await refreshAccessToken(refreshToken)

  await prisma.user.update({

    where: { id: userId },

    data: {

      accessToken: encryptSecret(refreshed.accessToken),

      refreshToken: encryptSecret(refreshed.refreshToken),

      tokenExpiresAt: new Date(refreshed.expiresAt * 1000),

      displayName: `${refreshed.athlete.firstname} ${refreshed.athlete.lastname}`.trim(),

      photoUrl: refreshed.athlete.profile || null,

      city: refreshed.athlete.city ?? null,

      country: refreshed.athlete.country ?? null,

    },

  })

  return refreshed.accessToken

}

