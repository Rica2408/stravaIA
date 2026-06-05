import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatPlannedDurationMinutes, formatPaceDecimalMinPerKm } from '@/lib/durationPaceFormat'
import { sessionStatusLabel } from '@/lib/statusLabels'
import { sessionTypeExplainer, sessionTypeTitle } from '@/lib/sessionTypeCopy'
import type { PlanWeek } from './types'

function sessionIcon(t: string): string {
  switch (t) {
    case 'LONG':
      return '🏃‍♂️'
    case 'TEMPO':
      return '⏱️'
    case 'INTERVALS':
      return '⚡'
    case 'REST':
      return '😴'
    case 'CROSS':
      return '🧘'
    default:
      return '🏃'
  }
}

interface WeeklyPlanProps {
  weeks: PlanWeek[]
  /** Si ya hay meta activa pero aún no llegan semanas del API (p. ej. generando plan). */
  hasActiveGoal?: boolean
}

export function WeeklyPlan({ weeks, hasActiveGoal }: WeeklyPlanProps) {
  const current = weeks[0]
  if (!current) {
    return (
      <section className="flex h-full min-h-[14rem] flex-col justify-center rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
        {hasActiveGoal ? (
          <>
            No hay sesiones listadas para esta vista todavía. Si acabas de crear o editar el objetivo, el plan puede
            tardar unos segundos: pulsa <span className="font-medium text-slate-300">Refrescar</span> en actividades o
            recarga la página.
          </>
        ) : (
          <>Aún no hay plan para esta semana. Crea un objetivo para generarlo.</>
        )}
      </section>
    )
  }
  const sessions = [...current.sessions].sort(
    (a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime(),
  )

  const [slide, setSlide] = useState(0)
  useEffect(() => {
    setSlide(0)
  }, [current.id])

  const n = sessions.length
  useEffect(() => {
    if (n === 0) {
      return
    }
    setSlide((i) => Math.min(i, n - 1))
  }, [n])

  const safeSlide = n === 0 ? 0 : Math.min(slide, n - 1)
  const go = (dir: -1 | 1) => {
    setSlide((i) => {
      const next = i + dir
      if (next < 0) {
        return n - 1
      }
      if (next >= n) {
        return 0
      }
      return next
    })
  }

  return (
    <section className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-3 shrink-0 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-slate-400">Plan semanal</p>
          <h3 className="truncate text-lg font-semibold text-white">
            Semana {current.weekNumber} · {current.weekType}
          </h3>
        </div>
        <p className="shrink-0 text-xs text-slate-500">
          Inicio {format(new Date(current.weekStart), 'd MMM', { locale: es })}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/50">
          <div
            className="flex h-full min-h-[9rem] transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${safeSlide * 100}%)` }}
          >
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex h-full w-full shrink-0 flex-col justify-center px-3 py-3 sm:px-4 sm:py-3"
              >
                <div className="mx-auto flex w-full max-w-md items-start gap-3">
                  <span className="text-2xl leading-none">{sessionIcon(s.sessionType)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-white">
                        {format(new Date(s.scheduledDate), 'EEE d MMM', { locale: es })}
                      </p>
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase text-slate-300">
                        {sessionStatusLabel(s.status)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm font-medium text-slate-200">{sessionTypeTitle(s.sessionType)}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      {sessionTypeExplainer(s.sessionType)}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      {s.plannedDistance
                        ? `${s.plannedDistance.toFixed(1)} km`
                        : s.plannedDuration
                          ? formatPlannedDurationMinutes(s.plannedDuration)
                          : '—'}
                      {s.plannedPace ? (
                        <span className="text-slate-500"> · Obj. {formatPaceDecimalMinPerKm(s.plannedPace)}</span>
                      ) : null}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {n > 1 ? (
            <>
              <button
                type="button"
                aria-label="Entrenamiento anterior"
                onClick={() => go(-1)}
                className="absolute left-1 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-700 bg-slate-900/90 text-lg text-slate-200 shadow-md backdrop-blur hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Siguiente entrenamiento"
                onClick={() => go(1)}
                className="absolute right-1 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-700 bg-slate-900/90 text-lg text-slate-200 shadow-md backdrop-blur hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                ›
              </button>
            </>
          ) : null}
        </div>

        {n > 1 ? (
          <div className="mt-2 flex shrink-0 justify-center gap-1.5">
            {sessions.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Ir al entrenamiento ${i + 1}`}
                aria-current={i === safeSlide ? 'true' : undefined}
                onClick={() => setSlide(i)}
                className={`h-2 min-w-[0.5rem] rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                  i === safeSlide ? 'w-8 bg-sky-500' : 'w-2 bg-slate-600 hover:bg-slate-500'
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
