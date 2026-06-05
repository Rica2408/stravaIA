import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/services/api'
import type { PlanWeek } from '@/components/types'
import { LayoutChrome } from '@/components/LayoutChrome'
import { formatPlannedDurationMinutes, formatPaceDecimalMinPerKm } from '@/lib/durationPaceFormat'
import { sessionTypeExplainer, sessionTypeTitle } from '@/lib/sessionTypeCopy'
import { sessionStatusLabel } from '@/lib/statusLabels'

const weekTypeLabel: Record<string, string> = {
  LOAD: 'CARGA',
  RECOVERY: 'RECUPERACIÓN',
  RACE: 'CARRERA',
}

export function PlanPage() {
  const navigate = useNavigate()
  const [weeks, setWeeks] = useState<PlanWeek[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void api
      .get<{ weeks: PlanWeek[] }>('/api/plan/current')
      .then((r) => setWeeks(r.data.weeks))
      .finally(() => setLoading(false))
  }, [])

  return (
    <LayoutChrome
      eyebrow="Plan multisección"
      title="Próximas 3 semanas"
      headerExtra={
        <button
          type="button"
          onClick={() =>
            navigate('/coach', {
              state: { preset: 'Necesito ajustar el plan de las próximas semanas por cambios en mi agenda.' },
            })
          }
          className="min-h-[40px] rounded-lg bg-strava px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
        >
          Ajustar con el coach
        </button>
      }
    >
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8">
        {loading ? <p className="text-sm text-slate-400">Cargando plan…</p> : null}
        <div className="space-y-6">
          {weeks.map((w) => {
            const totalKm =
              w.sessions.reduce((acc, s) => acc + (s.plannedDistance ?? 0), 0) || 0
            const sessionsCount = w.sessions.filter((s) => s.sessionType !== 'REST').length
            return (
              <section key={w.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Semana {w.weekNumber}</p>
                    <h2 className="text-lg font-semibold text-white">
                      {weekTypeLabel[w.weekType] ?? w.weekType}
                    </h2>
                  </div>
                  <div className="text-xs text-slate-400">
                    <span className="mr-4">Km planificados: {totalKm.toFixed(1)}</span>
                    <span>Sesiones clave: {sessionsCount}</span>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
                  {[...w.sessions]
                    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
                    .map((s) => (
                      <div key={s.id} className="flex flex-col rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-[11px]">
                        <p className="font-semibold text-white">{sessionTypeTitle(s.sessionType)}</p>
                        <p className="mt-1 line-clamp-4 text-[10px] leading-snug text-slate-500">
                          {sessionTypeExplainer(s.sessionType)}
                        </p>
                        <p className="mt-2 text-slate-400">
                          {new Date(s.scheduledDate).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}
                        </p>
                        <p className="mt-1 text-slate-300">
                          {s.plannedDistance
                            ? `${s.plannedDistance.toFixed(1)} km`
                            : s.plannedDuration
                              ? formatPlannedDurationMinutes(s.plannedDuration)
                              : '—'}
                        </p>
                        {s.plannedPace ? (
                          <p className="mt-1 text-[10px] text-slate-500">{formatPaceDecimalMinPerKm(s.plannedPace)}</p>
                        ) : null}
                        <p className="mt-auto pt-2 text-[10px] uppercase text-slate-500">
                          {sessionStatusLabel(s.status)}
                        </p>
                      </div>
                    ))}
                </div>
              </section>
            )
          })}
          {weeks.length === 0 && !loading ? (
            <p className="text-sm text-slate-500">Todavía no hay plan. Crea un objetivo desde el panel principal.</p>
          ) : null}
        </div>
      </div>
    </LayoutChrome>
  )
}
