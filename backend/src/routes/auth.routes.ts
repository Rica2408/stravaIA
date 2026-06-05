import { Router } from 'express'
import { env } from '@/config/index.js'
import { encryptSecret } from '@/lib/cryptoTokens.js'
import { signAccessToken } from '@/lib/jwt.js'
import { prisma } from '@/lib/prisma.js'
import { authMiddleware } from '@/middleware/auth.middleware.js'
import { isStravaIdAdmin } from '@/lib/admin.js'
import { exchangeCodeForTokens, getAuthorizationUrl } from '@/services/strava.service.js'
import { syncActivitiesFromStrava } from '@/services/activities.service.js'

export const authRouter = Router()

authRouter.get('/strava', (_req, res) => {
  res.redirect(getAuthorizationUrl())
})

authRouter.get('/callback', async (req, res) => {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : ''
    if (!code) {
      res.status(400).send('Falta el parámetro code')
      return
    }
    const tokens = await exchangeCodeForTokens(code)
    const displayName = `${tokens.athlete.firstname} ${tokens.athlete.lastname}`.trim()
    const user = await prisma.user.upsert({
      where: { stravaId: tokens.athlete.id },
      create: {
        stravaId: tokens.athlete.id,
        displayName,
        photoUrl: tokens.athlete.profile || null,
        city: tokens.athlete.city ?? null,
        country: tokens.athlete.country ?? null,
        accessToken: encryptSecret(tokens.accessToken),
        refreshToken: encryptSecret(tokens.refreshToken),
        tokenExpiresAt: new Date(tokens.expiresAt * 1000),
      },
      update: {
        displayName,
        photoUrl: tokens.athlete.profile || null,
        city: tokens.athlete.city ?? null,
        country: tokens.athlete.country ?? null,
        accessToken: encryptSecret(tokens.accessToken),
        refreshToken: encryptSecret(tokens.refreshToken),
        tokenExpiresAt: new Date(tokens.expiresAt * 1000),
      },
    })
    try {
      await syncActivitiesFromStrava(user.id, 60)
    } catch {
      // El login sigue aunque falle el sync inicial
    }
    const jwt = signAccessToken(user.id, user.tokenVersion)
    const redirect = new URL(env.FRONTEND_URL)
    redirect.pathname = '/'
    redirect.searchParams.set('token', jwt)
    res.redirect(redirect.toString())
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error en autenticación'
    res.status(500).send(message)
  }
})

authRouter.get('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        stravaId: true,
        displayName: true,
        photoUrl: true,
        city: true,
        country: true,
        createdAt: true,
      },
    })
    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado' })
      return
    }
    res.json({ user, isAdmin: isStravaIdAdmin(user.stravaId) })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    res.status(500).json({ error: message })
  }
})

authRouter.post('/logout', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!
    await prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    })
    res.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    res.status(500).json({ error: message })
  }
})
