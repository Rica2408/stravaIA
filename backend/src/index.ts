import express from 'express'
import cors from 'cors'
import { env } from '@/config/index.js'
import { errorMiddleware } from '@/middleware/error.middleware.js'
import { authRouter } from '@/routes/auth.routes.js'
import { activitiesRouter } from '@/routes/activities.routes.js'
import { coachRouter } from '@/routes/coach.routes.js'
import { goalsRouter } from '@/routes/goals.routes.js'
import { planRouter } from '@/routes/plan.routes.js'
import { webhookRouter } from '@/routes/webhook.routes.js'
import { meRouter } from '@/routes/me.routes.js'
import { adminRouter } from '@/routes/admin.routes.js'
import { startScheduledJobs } from '@/jobs/inactivity.job.js'
import { ensureStravaWebhookSubscription } from '@/services/strava.service.js'

const app = express()

// Prisma usa BigInt (p. ej. Activity.stravaId); JSON.stringify no lo soporta por defecto.
app.set('json replacer', (_key: string, value: unknown) =>
  typeof value === 'bigint' ? value.toString() : value,
)

// Debe coincidir con el Origin del navegador (localhost vs 127.0.0.1 son distintos).
const frontendBase = env.FRONTEND_URL.replace(/\/$/, '')
const devOrigins = new Set([
  frontendBase,
  frontendBase.replace('://localhost:', '://127.0.0.1:'),
  frontendBase.replace('://127.0.0.1:', '://localhost:'),
])

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true)
        return
      }
      if (env.NODE_ENV === 'development' && devOrigins.has(origin)) {
        callback(null, true)
        return
      }
      if (origin === frontendBase) {
        callback(null, true)
        return
      }
      callback(null, false)
    },
    credentials: true,
  }),
)
app.use(express.json({ limit: '1mb' }))

app.use('/auth', authRouter)
app.use('/api/activities', activitiesRouter)
app.use('/api/coach', coachRouter)
app.use('/api/goals', goalsRouter)
app.use('/api/plan', planRouter)
app.use('/api/me', meRouter)
app.use('/api/admin', adminRouter)
app.use('/webhook', webhookRouter)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use(errorMiddleware)

app.listen(env.PORT, () => {
  console.log(`API escuchando en http://localhost:${env.PORT}`)
  startScheduledJobs()

  const raw = process.env.STRAVA_AUTO_REGISTER_WEBHOOK?.toLowerCase()
  const autoRegisterWebhook =
    raw === 'false' || raw === '0' ? false : raw === 'true' || raw === '1' ? true : env.NODE_ENV === 'production'

  if (autoRegisterWebhook) {
    void ensureStravaWebhookSubscription().catch((err) =>
      console.error(
        '[webhook] No se pudo registrar la suscripción Strava:',
        err instanceof Error ? err.message : err,
      ),
    )
  }
})
