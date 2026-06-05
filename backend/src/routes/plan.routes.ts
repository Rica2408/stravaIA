import { Router } from 'express'
import { prisma } from '@/lib/prisma.js'
import { authMiddleware } from '@/middleware/auth.middleware.js'
import { getUpcomingPlanWeeksForUser } from '@/services/plan.service.js'

export const planRouter = Router()
planRouter.use(authMiddleware)

planRouter.get('/current', async (req, res) => {
  try {
    const userId = req.userId!
    const weeks = await getUpcomingPlanWeeksForUser(userId, 3)
    res.json({ weeks })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    res.status(500).json({ error: message })
  }
})

planRouter.get('/week/:weekId', async (req, res) => {
  try {
    const userId = req.userId!
    const weekId = req.params.weekId
    const week = await prisma.planWeek.findFirst({
      where: { id: weekId, plan: { goal: { userId } } },
      include: { sessions: true, plan: { include: { goal: true } } },
    })
    if (!week) {
      res.status(404).json({ error: 'Semana no encontrada' })
      return
    }
    res.json({ week })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    res.status(500).json({ error: message })
  }
})
