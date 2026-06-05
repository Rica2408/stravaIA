import cron from 'node-cron'
import { checkUpcomingRaces } from '@/services/coach.service.js'
import { checkInactivity } from '@/services/proactive.service.js'

export function startScheduledJobs(): void {
  cron.schedule('0 9 * * *', async () => {
    try {
      await checkInactivity()
    } catch {
      // Job diario no debe tumbar el proceso
    }
  })

  cron.schedule('0 20 * * *', async () => {
    try {
      await checkUpcomingRaces()
    } catch {
      // Igualmente tolerante a fallos
    }
  })
}
