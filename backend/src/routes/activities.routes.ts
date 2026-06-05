import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '@/lib/prisma.js'
import { authMiddleware } from '@/middleware/auth.middleware.js'
import { syncActivitiesFromStrava } from '@/services/activities.service.js'
import { generateDebrief } from '@/services/debrief.service.js'

export const activitiesRouter = Router()
activitiesRouter.use(authMiddleware)

activitiesRouter.get('/', async (req, res) => {
  try {
    const userId = req.userId!
    const page = z.coerce.number().int().min(1).default(1).parse(req.query.page ?? 1)
    const limit = z.coerce.number().int().min(1).max(50).default(20).parse(req.query.limit ?? 20)
    const skip = (page - 1) * limit
    const [items, total] = await Promise.all([
      prisma.activity.findMany({
        where: { userId },
        orderBy: { startDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.activity.count({ where: { userId } }),
    ])
    res.json({ items, total, page, limit })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    res.status(400).json({ error: message })
  }
})

activitiesRouter.post('/sync', async (req, res) => {
  try {
    const userId = req.userId!
    const count = await syncActivitiesFromStrava(userId, 120)
    res.json({ synced: count })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    res.status(500).json({ error: message })
  }
})

activitiesRouter.get('/:id/debrief', async (req, res) => {
  try {
    const userId = req.userId!
    const id = req.params.id
    const activity = await prisma.activity.findFirst({ where: { id, userId } })
    if (!activity) {
      res.status(404).json({ error: 'Actividad no encontrada' })
      return
    }
    if (activity.debrief) {
      res.json({ debrief: activity.debrief, cached: true })
      return
    }
    const debrief = await generateDebrief(userId, id)
    res.json({ debrief, cached: false })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    res.status(500).json({ error: message })
  }
})

activitiesRouter.get('/:id', async (req, res) => {
  try {
    const userId = req.userId!
    const id = req.params.id
    const activity = await prisma.activity.findFirst({ where: { id, userId } })
    if (!activity) {
      res.status(404).json({ error: 'Actividad no encontrada' })
      return
    }
    res.json({ activity })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    res.status(500).json({ error: message })
  }
})
