import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '@/middleware/auth.middleware.js'
import { adminGuardMiddleware } from '@/middleware/admin.middleware.js'
import { getAiUsageByUser } from '@/services/admin.service.js'

export const adminRouter = Router()

adminRouter.use(authMiddleware)
adminRouter.use(adminGuardMiddleware)

adminRouter.get('/ai-usage', async (req, res) => {
  try {
    const days = z.coerce.number().int().min(1).max(365).default(30).parse(req.query.days ?? 30)
    const data = await getAiUsageByUser(days)
    res.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    res.status(400).json({ error: message })
  }
})
