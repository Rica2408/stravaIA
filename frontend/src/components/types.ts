export type TrackStatus = 'ON_TRACK' | 'AT_RISK' | 'DANGER'

export type SessionType = 'EASY' | 'TEMPO' | 'LONG' | 'INTERVALS' | 'REST' | 'CROSS'

export type SessionStatus = 'PENDING' | 'COMPLETED' | 'MISSED' | 'ADJUSTED'

export interface PlanSession {
  id: string
  scheduledDate: string
  sessionType: SessionType
  plannedDistance: number | null
  plannedPace: number | null
  plannedDuration: number | null
  status: SessionStatus
  activityId: string | null
}

export interface PlanWeek {
  id: string
  weekNumber: number
  weekStart: string
  weekType: 'LOAD' | 'RECOVERY' | 'RACE'
  sessions: PlanSession[]
}

export interface Activity {
  id: string
  name: string
  type: string
  startDate: string
  distance: number
  duration: number
  avgPace: number | null
  avgHeartRate: number | null
  debrief: string | null
}

export interface CoachMessage {
  id: string
  role: 'USER' | 'ASSISTANT'
  content: string
  type: 'CHAT' | 'DEBRIEF' | 'PROACTIVE' | 'BRIEFING'
  createdAt: string
  readAt?: string | null
}
