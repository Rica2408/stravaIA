import { prisma } from '@/lib/prisma.js'

export async function getAiUsageByUser(days: number) {
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - days)
  since.setUTCHours(0, 0, 0, 0)

  const logs = await prisma.aiUsageLog.findMany({
    where: { createdAt: { gte: since } },
    select: {
      userId: true,
      inputTokens: true,
      outputTokens: true,
      operation: true,
      createdAt: true,
      user: { select: { displayName: true, stravaId: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const byUserMap = new Map<
    string,
    {
      userId: string
      displayName: string
      stravaId: number
      inputTokens: number
      outputTokens: number
      totalTokens: number
      requestCount: number
    }
  >()

  for (const log of logs) {
    const existing = byUserMap.get(log.userId)
    if (existing) {
      existing.inputTokens += log.inputTokens
      existing.outputTokens += log.outputTokens
      existing.totalTokens += log.inputTokens + log.outputTokens
      existing.requestCount += 1
    } else {
      byUserMap.set(log.userId, {
        userId: log.userId,
        displayName: log.user.displayName,
        stravaId: log.user.stravaId,
        inputTokens: log.inputTokens,
        outputTokens: log.outputTokens,
        totalTokens: log.inputTokens + log.outputTokens,
        requestCount: 1,
      })
    }
  }

  const byUser = Array.from(byUserMap.values()).sort((a, b) => b.totalTokens - a.totalTokens)

  const dailyMap = new Map<string, { date: string; inputTokens: number; outputTokens: number; totalTokens: number }>()
  for (const log of logs) {
    const date = log.createdAt.toISOString().slice(0, 10)
    const row = dailyMap.get(date)
    if (row) {
      row.inputTokens += log.inputTokens
      row.outputTokens += log.outputTokens
      row.totalTokens += log.inputTokens + log.outputTokens
    } else {
      dailyMap.set(date, {
        date,
        inputTokens: log.inputTokens,
        outputTokens: log.outputTokens,
        totalTokens: log.inputTokens + log.outputTokens,
      })
    }
  }

  const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))

  const totals = byUser.reduce(
    (acc, u) => ({
      inputTokens: acc.inputTokens + u.inputTokens,
      outputTokens: acc.outputTokens + u.outputTokens,
      totalTokens: acc.totalTokens + u.totalTokens,
      requestCount: acc.requestCount + u.requestCount,
    }),
    { inputTokens: 0, outputTokens: 0, totalTokens: 0, requestCount: 0 },
  )

  return {
    days,
    since: since.toISOString(),
    totals,
    byUser,
    daily,
  }
}
