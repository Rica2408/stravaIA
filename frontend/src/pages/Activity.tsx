import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '@/services/api'
import type { Activity } from '@/components/types'
import { LayoutChrome } from '@/components/LayoutChrome'
import { formatDurationSeconds, formatPaceDecimalMinPerKm } from '@/lib/durationPaceFormat'

export function ActivityPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activity, setActivity] = useState<Activity | null>(null)
  const [debrief, setDebrief] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) {
      return
    }
    void (async () => {
      try {
        const res = await api.get<{ activity: Activity }>(`/api/activities/${id}`)
        setActivity(res.data.activity)
        const d = await api.get<{ debrief: string }>(`/api/activities/${id}/debrief`)
        setDebrief(d.data.debrief)
      } catch {
        setActivity(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  if (loading) {
    return (
      <LayoutChrome title="Cargando actividad…" eyebrow="Strava Coach IA">
        <p className="px-4 py-8 text-sm text-slate-400 sm:px-6">Cargando actividad…</p>
      </LayoutChrome>
    )
  }
  if (!activity) {
    return (
      <LayoutChrome title="Actividad no encontrada" eyebrow="Strava Coach IA">
        <p className="px-4 py-8 text-sm text-rose-300 sm:px-6">No encontramos esta actividad o no tienes permiso para verla.</p>
      </LayoutChrome>
    )
  }

  const km = activity.distance / 1000

  return (
    <LayoutChrome
      eyebrow="Debrief de actividad"
      title={activity.name}
      headerExtra={
        <button
          type="button"
          onClick={() =>
            navigate('/coach', {
              state: {
                preset: `Quiero profundizar en la actividad «${activity.name}» del ${new Date(activity.startDate).toLocaleDateString('es-ES')}.`,
              },
            })
          }
          className="min-h-[40px] rounded-lg bg-strava px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
        >
          Preguntar al coach
        </button>
      }
    >
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8">
        <p className="text-sm text-slate-400">{new Date(activity.startDate).toLocaleString('es-ES')}</p>
        <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:grid-cols-2 md:grid-cols-4">
          <Metric label="Distancia" value={`${km.toFixed(2)} km`} />
          <Metric label="Ritmo medio" value={activity.avgPace != null ? formatPaceDecimalMinPerKm(activity.avgPace) : '—'} />
          <Metric label="FC media" value={activity.avgHeartRate ? `${Math.round(activity.avgHeartRate)} lpm` : '—'} />
          <Metric label="Duración" value={formatDurationSeconds(activity.duration)} />
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Análisis del coach</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-100">{debrief}</p>
        </section>
      </div>
    </LayoutChrome>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  )
}
