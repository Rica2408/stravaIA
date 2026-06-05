import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatPaceDecimalMinPerKm } from '@/lib/durationPaceFormat'
import type { Activity } from './types'

interface ActivityCardProps {
  activity: Activity
  onOpen: () => void
}

export function ActivityCard({ activity, onOpen }: ActivityCardProps) {
  const km = activity.distance / 1000
  return (
    <article className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div>
        <p className="text-xs text-slate-500">{format(new Date(activity.startDate), "d MMM yyyy HH:mm", { locale: es })}</p>
        <h4 className="mt-1 text-base font-semibold text-white">{activity.name}</h4>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-300">
          <div>
            <dt className="text-slate-500">Dist.</dt>
            <dd className="font-semibold">{km.toFixed(1)} km</dd>
          </div>
          <div>
            <dt className="text-slate-500">Ritmo</dt>
            <dd className="font-semibold">
              {activity.avgPace !== null && activity.avgPace !== undefined
                ? formatPaceDecimalMinPerKm(activity.avgPace)
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">FC</dt>
            <dd className="font-semibold">{activity.avgHeartRate ? Math.round(activity.avgHeartRate) : '—'}</dd>
          </div>
        </dl>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        {activity.debrief ? (
          <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-300">
            Debrief listo
          </span>
        ) : (
          <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] font-semibold uppercase text-slate-400">
            Sin debrief
          </span>
        )}
        <button
          type="button"
          onClick={onOpen}
          className="min-h-[44px] rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 hover:border-strava hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-strava focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          Ver debrief
        </button>
      </div>
    </article>
  )
}
