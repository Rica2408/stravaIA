import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '@/lib/prisma.js'
import { authMiddleware } from '@/middleware/auth.middleware.js'
import { sendMessage } from '@/services/coach.service.js'

export const coachRouter = Router()
coachRouter.use(authMiddleware)

const messageSchema = z.object({
  message: z.string().min(1).max(8000),
})

coachRouter.post('/message', async (req, res) => {
  try {
    const userId = req.userId!
    const body = messageSchema.parse(req.body)
    const result = await sendMessage(userId, body.message)
    res.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    const status = message.includes('Límite') ? 429 : 400
    res.status(status).json({ error: message })
  }
})

coachRouter.get('/history', async (req, res) => {
  try {
    const userId = req.userId!
    const items = await prisma.coachMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    res.json({ items: items.reverse() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    res.status(500).json({ error: message })
  }
})

coachRouter.get('/proactive', async (req, res) => {
  try {
    const userId = req.userId!
    const items = await prisma.coachMessage.findMany({
      where: { userId, type: 'PROACTIVE', readAt: null },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    res.json({ items })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    res.status(500).json({ error: message })
  }
})

coachRouter.patch('/proactive/:id/read', async (req, res) => {
  try {
    const userId = req.userId!
    const id = req.params.id
    const msg = await prisma.coachMessage.findFirst({
      where: { id, userId, type: 'PROACTIVE' },
    })
    if (!msg) {
      res.status(404).json({ error: 'Mensaje no encontrado' })
      return
    }
    await prisma.coachMessage.update({
      where: { id },
      data: { readAt: new Date() },
    })
    res.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    res.status(500).json({ error: message })
  }
})
