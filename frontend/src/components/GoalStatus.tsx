import type { TrackStatus } from './types'
import { trackStatusEs } from '@/lib/statusLabels'

interface GoalStatusProps {
  description: string
  targetDate: string
  onTrack: TrackStatus
  weeksLeft: number
  onChat: () => void
  onEditGoal?: () => void
}

const badge: Record<TrackStatus, { label: string; emoji: string; className: string }> = {
  ON_TRACK: {
    label: trackStatusEs.ON_TRACK.label,
    emoji: '🟢',
    className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  },
  AT_RISK: {
    label: trackStatusEs.AT_RISK.label,
    emoji: '🟡',
    className: 'bg-amber-500/15 text-amber-200 border-amber-500/40',
  },
  DANGER: {
    label: trackStatusEs.DANGER.label,
    emoji: '🔴',
    className: 'bg-rose-500/15 text-rose-200 border-rose-500/40',
  },
}

export function GoalStatus({
  description,
  targetDate,
  onTrack,
  weeksLeft,
  onChat,
  onEditGoal,
}: GoalStatusProps) {
  const b = badge[onTrack]
  return (
    <section
      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/30 sm:p-6"
      aria-labelledby="goal-heading"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-slate-400">Tu objetivo</p>
          <h2 id="goal-heading" className="mt-1 break-words text-xl font-semibold text-white sm:text-2xl">
            {description}
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Fecha límite: {new Date(targetDate).toLocaleDateString('es-ES')} · Semanas restantes:{' '}
            <span className="font-semibold text-white">{weeksLeft}</span>
          </p>
          <p className="mt-3 max-w-2xl text-sm text-slate-400">
            El coach evalúa tu progreso con datos reales de Strava y el cumplimiento del plan. El semáforo resume si el
            objetivo sigue siendo realista.
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 md:items-end">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${b.className}`}
            role="status"
            aria-label={`Estado del objetivo: ${b.label}`}
          >
            <span aria-hidden>{b.emoji}</span>
            {b.label}
          </span>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {onEditGoal ? (
              <button
                type="button"
                onClick={onEditGoal}
                className="min-h-[44px] rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              >
                Editar objetivo
              </button>
            ) : null}
            <button
              type="button"
              onClick={onChat}
              className="min-h-[44px] rounded-xl bg-strava px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-900/40 transition hover:bg-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            >
              Hablar con mi coach
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
