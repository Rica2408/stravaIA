import { Router } from 'express'
import { prisma } from '@/lib/prisma.js'
import { authMiddleware } from '@/middleware/auth.middleware.js'
import { generateInitialPlan, regenerateTrainingPlanForGoal } from '@/services/plan.service.js'
import { appendReplanCoachMessage, generateWelcomeAfterPlan } from '@/services/coach.service.js'
import { createGoalBodySchema, goalRowFromCreateBody, goalRowFromPatchBody, patchGoalBodySchema } from '@/lib/goalPayload.js'

export const goalsRouter = Router()
goalsRouter.use(authMiddleware)

goalsRouter.post('/', async (req, res) => {
  try {
    const userId = req.userId!
    const body = createGoalBodySchema.parse(req.body)
    const metrics = goalRowFromCreateBody(body)
    await prisma.goal.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'ABANDONED' },
    })
    const goal = await prisma.goal.create({
      data: {
        userId,
        type: metrics.type,
        description: body.description,
        targetValue: metrics.targetValue,
        targetDistanceKm: metrics.targetDistanceKm,
        targetTimeMinutes: metrics.targetTimeMinutes,
        targetDate: body.targetDate,
      },
    })
    await generateInitialPlan(userId, goal)
    await generateWelcomeAfterPlan(userId, goal)
    const full = await prisma.goal.findUnique({
      where: { id: goal.id },
      include: { plan: { include: { weeks: { include: { sessions: true } } } } },
    })
    res.status(201).json({ goal: full })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    res.status(400).json({ error: message })
  }
})

goalsRouter.get('/active', async (req, res) => {
  try {
    const userId = req.userId!
    const goal = await prisma.goal.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: { plan: { include: { weeks: { include: { sessions: true } } } } },
    })
    res.json({ goal })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    res.status(500).json({ error: message })
  }
})

goalsRouter.patch('/:id', async (req, res) => {
  try {
    const userId = req.userId!
    const id = req.params.id
    const body = patchGoalBodySchema.parse(req.body)
    const metrics = goalRowFromPatchBody(body)
    const hasChange =
      body.goalMode !== undefined ||
      body.description !== undefined ||
      body.targetDate !== undefined ||
      body.distanceKm !== undefined ||
      body.timeMinutes !== undefined ||
      body.paceMinPerKm !== undefined
    if (!hasChange) {
      res.status(400).json({ error: 'Indica al menos un campo a actualizar' })
      return
    }
    const existing = await prisma.goal.findFirst({ where: { id, userId } })
    if (!existing) {
      res.status(404).json({ error: 'Objetivo no encontrado' })
      return
    }
    const goal = await prisma.goal.update({
      where: { id },
      data: {
        ...(body.description !== undefined && { description: body.description }),
        ...(body.targetDate !== undefined && { targetDate: body.targetDate }),
        ...(metrics && {
          type: metrics.type,
          targetValue: metrics.targetValue,
          targetDistanceKm: metrics.targetDistanceKm,
          targetTimeMinutes: metrics.targetTimeMinutes,
        }),
      },
    })
    if (goal.status === 'ACTIVE') {
      await regenerateTrainingPlanForGoal(userId, goal.id)
      await appendReplanCoachMessage(userId, goal.description)
    }
    const full = await prisma.goal.findUnique({
      where: { id },
      include: { plan: { include: { weeks: { include: { sessions: true } } } } },
    })
    res.json({ goal: full })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    res.status(400).json({ error: message })
  }
})

goalsRouter.delete('/:id', async (req, res) => {
  try {
    const userId = req.userId!
    const id = req.params.id
    const existing = await prisma.goal.findFirst({ where: { id, userId } })
    if (!existing) {
      res.status(404).json({ error: 'Objetivo no encontrado' })
      return
    }
    await prisma.goal.update({
      where: { id },
      data: { status: 'ABANDONED' },
    })
    res.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    res.status(500).json({ error: message })
  }
})
