import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import api from '@/services/api'
import { LayoutChrome } from '@/components/LayoutChrome'
import { GoalStatus } from '@/components/GoalStatus'
import { WeeklyPlan } from '@/components/WeeklyPlan'
import { ActivityCard } from '@/components/ActivityCard'
import { ProgressChart } from '@/components/ProgressChart'
import type { Activity, PlanWeek, TrackStatus } from '@/components/types'

interface GoalDto {
  id: string
  description: string
  targetDate: string
  onTrack: TrackStatus
  type: 'RACE_TIME' | 'TOTAL_KM' | 'PACE_TARGET' | 'TIME_TOTAL'
  targetValue: number
  targetDistanceKm?: number | null
  targetTimeMinutes?: number | null
}

export function Dashboard() {
  const navigate = useNavigate()
  const [goal, setGoal] = useState<GoalDto | null>(null)
  const [weeks, setWeeks] = useState<PlanWeek[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [chartActs, setChartActs] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [goalModal, setGoalModal] = useState<{ open: boolean; editing: GoalDto | null }>({
    open: false,
    editing: null,
  })
  const goalModalDismissedRef = useRef(false)

  const openGoalModal = (editing: GoalDto | null = null) => {
    goalModalDismissedRef.current = false
    setGoalModal({ open: true, editing })
  }

  const closeGoalModal = () => {
    goalModalDismissedRef.current = true
    setGoalModal({ open: false, editing: null })
  }

  const weeksLeft = useMemo(() => {
    if (!goal) {
      return 0
    }
    const ms = new Date(goal.targetDate).getTime() - Date.now()
    return Math.max(0, Math.ceil(ms / (7 * 24 * 60 * 60 * 1000)))
  }, [goal])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [gRes, pRes, aRes, cRes] = await Promise.all([
        api.get<{ goal: GoalDto | null }>('/api/goals/active'),
        api.get<{ weeks: PlanWeek[] }>('/api/plan/current'),
        api.get<{ items: Activity[] }>('/api/activities', { params: { limit: 3, page: 1 } }),
        api.get<{ items: Activity[] }>('/api/activities', { params: { limit: 40, page: 1 } }),
      ])
      setGoal(gRes.data.goal)
      setWeeks(pRes.data.weeks)
      setActivities(aRes.data.items)
      setChartActs(cRes.data.items)
      if (!gRes.data.goal && !goalModalDismissedRef.current) {
        openGoalModal()
      }
    } catch (e) {
      setError('No se pudo cargar el dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <LayoutChrome eyebrow="Strava Coach IA" title="Panel principal">
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8">
        {loading ? <p className="text-sm text-slate-400">Cargando…</p> : null}
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {goal ? (
          <GoalStatus
            description={goal.description}
            targetDate={goal.targetDate}
            onTrack={goal.onTrack}
            weeksLeft={weeksLeft}
            onChat={() => navigate('/coach')}
            onEditGoal={() => openGoalModal(goal)}
          />
        ) : (
          <section className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-sm text-slate-300">
            <p>Crea un objetivo para activar el semáforo de progreso y el plan semanal.</p>
            <button
              type="button"
              onClick={() => openGoalModal()}
              className="mt-4 min-h-[44px] rounded-lg bg-strava px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              Definir objetivo
            </button>
          </section>
        )}
        <div className="grid min-w-0 gap-6 lg:grid-cols-[2fr,1fr] lg:items-stretch">
          <div className="flex h-full min-h-0 min-w-0 flex-col">
            <WeeklyPlan weeks={weeks} hasActiveGoal={Boolean(goal)} />
          </div>
          <div className="flex h-full min-h-0 min-w-0 flex-col lg:max-w-full">
            <ProgressChart activities={chartActs} />
          </div>
        </div>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Últimas actividades</h3>
            <button
              type="button"
              onClick={() => void load()}
              className="min-h-[44px] rounded-lg px-2 text-xs font-semibold text-sky-300 hover:bg-slate-900 hover:text-sky-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              Refrescar
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {activities.map((a) => (
              <ActivityCard key={a.id} activity={a} onOpen={() => navigate(`/activity/${a.id}`)} />
            ))}
            {activities.length === 0 ? (
              <p className="text-sm text-slate-500">Aún no hay actividades sincronizadas.</p>
            ) : null}
          </div>
        </section>
      </main>
      {goalModal.open ? (
        <GoalModal
          existingGoal={goalModal.editing}
          onClose={closeGoalModal}
          onSuccess={async () => {
            goalModalDismissedRef.current = false
            setGoalModal({ open: false, editing: null })
            await load()
          }}
        />
      ) : null}
    </LayoutChrome>
  )
}

interface GoalModalProps {
  existingGoal: GoalDto | null
  onClose: () => void
  onSuccess: () => Promise<void>
}

type GoalFormMode = 'DISTANCE' | 'RACE' | 'TIME' | 'PACE'

function defaultTargetDate(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 3)
  return d.toISOString().slice(0, 10)
}

function applyGoalToForm(g: GoalDto, setters: {
  setDescription: (v: string) => void
  setTargetDate: (v: string) => void
  setGoalMode: (v: GoalFormMode) => void
  setDistanceKm: (v: string) => void
  setTimeMinutes: (v: string) => void
  setPaceMinPerKm: (v: string) => void
}) {
  const { setDescription, setTargetDate, setGoalMode, setDistanceKm, setTimeMinutes, setPaceMinPerKm } = setters
  setDescription(g.description)
  setTargetDate(new Date(g.targetDate).toISOString().slice(0, 10))
  switch (g.type) {
    case 'TOTAL_KM':
      setGoalMode('DISTANCE')
      setDistanceKm(String(g.targetDistanceKm ?? g.targetValue))
      setTimeMinutes('')
      setPaceMinPerKm('')
      break
    case 'RACE_TIME':
      setGoalMode('RACE')
      setDistanceKm(g.targetDistanceKm != null ? String(g.targetDistanceKm) : '')
      setTimeMinutes(String(g.targetTimeMinutes ?? g.targetValue))
      setPaceMinPerKm('')
      break
    case 'TIME_TOTAL':
      setGoalMode('TIME')
      setDistanceKm('')
      setTimeMinutes(String(g.targetTimeMinutes ?? g.targetValue))
      setPaceMinPerKm('')
      break
    case 'PACE_TARGET':
      setGoalMode('PACE')
      setDistanceKm('')
      setTimeMinutes('')
      setPaceMinPerKm(String(g.targetValue))
      break
  }
}

function GoalModal({ existingGoal, onClose, onSuccess }: GoalModalProps) {
  const isEdit = Boolean(existingGoal)
  const [goalMode, setGoalMode] = useState<GoalFormMode>('RACE')
  const [description, setDescription] = useState('Completar 10 km en carrera popular')
  const [distanceKm, setDistanceKm] = useState('10')
  const [timeMinutes, setTimeMinutes] = useState('50')
  const [paceMinPerKm, setPaceMinPerKm] = useState('5.5')
  const [targetDate, setTargetDate] = useState(defaultTargetDate)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!existingGoal) {
      setGoalMode('RACE')
      setDescription('Completar 10 km en carrera popular')
      setDistanceKm('10')
      setTimeMinutes('50')
      setPaceMinPerKm('5.5')
      setTargetDate(defaultTargetDate())
      return
    }
    applyGoalToForm(existingGoal, {
      setDescription,
      setTargetDate,
      setGoalMode,
      setDistanceKm,
      setTimeMinutes,
      setPaceMinPerKm,
    })
  }, [existingGoal])

  const buildBody = (): Record<string, unknown> | null => {
    const d = parseFloat(distanceKm.replace(',', '.'))
    const t = parseFloat(timeMinutes.replace(',', '.'))
    const p = parseFloat(paceMinPerKm.replace(',', '.'))
    const targetDateIso = new Date(targetDate).toISOString()

    if (goalMode === 'DISTANCE') {
      if (!Number.isFinite(d) || d <= 0) {
        setErr('Indica los kilómetros totales a sumar (número mayor que 0).')
        return null
      }
      return {
        goalMode: 'DISTANCE',
        description: description.trim(),
        targetDate: targetDateIso,
        distanceKm: d,
      }
    }
    if (goalMode === 'RACE') {
      if (!Number.isFinite(d) || d <= 0) {
        setErr('Indica la distancia de la prueba en kilómetros.')
        return null
      }
      if (!Number.isFinite(t) || t <= 0) {
        setErr('Indica el tiempo objetivo en minutos (puedes usar decimales).')
        return null
      }
      return {
        goalMode: 'RACE',
        description: description.trim(),
        targetDate: targetDateIso,
        distanceKm: d,
        timeMinutes: t,
      }
    }
    if (goalMode === 'TIME') {
      if (!Number.isFinite(t) || t <= 0) {
        setErr('Indica los minutos totales de carrera que quieres acumular en el plazo.')
        return null
      }
      return {
        goalMode: 'TIME',
        description: description.trim(),
        targetDate: targetDateIso,
        timeMinutes: t,
      }
    }
    if (!Number.isFinite(p) || p <= 0) {
      setErr('Indica el ritmo en minutos por km en formato decimal (ej. 5.5 = 5:30/km).')
      return null
    }
    return {
      goalMode: 'PACE',
      description: description.trim(),
      targetDate: targetDateIso,
      paceMinPerKm: p,
    }
  }

  const submit = async () => {
    setBusy(true)
    setErr(null)
    const body = buildBody()
    if (!body) {
      setBusy(false)
      return
    }
    if ((body.description as string).length < 3) {
      setErr('La descripción debe tener al menos 3 caracteres.')
      setBusy(false)
      return
    }
    try {
      const requestConfig = { timeout: 180_000 }
      if (existingGoal) {
        await api.patch(`/api/goals/${existingGoal.id}`, body, requestConfig)
      } else {
        await api.post('/api/goals', body, requestConfig)
      }
      await onSuccess()
    } catch (e: unknown) {
      const apiErr =
        axios.isAxiosError(e) &&
        e.response?.data &&
        typeof e.response.data === 'object' &&
        e.response.data !== null &&
        'error' in e.response.data
          ? String((e.response.data as { error: string }).error)
          : null
      setErr(
        apiErr ??
          (isEdit
            ? 'No se pudo guardar el objetivo o regenerar el plan. Revisa los datos e inténtalo de nuevo.'
            : 'No se pudo crear el objetivo. Revisa los datos e inténtalo de nuevo.'),
      )
    } finally {
      setBusy(false)
    }
  }

  const modeOption = (mode: GoalFormMode, title: string, hint: string) => (
    <label
      key={mode}
      className={`flex cursor-pointer flex-col gap-1 rounded-xl border px-3 py-2 transition focus-within:outline-none focus-within:ring-2 focus-within:ring-sky-500 focus-within:ring-offset-2 focus-within:ring-offset-slate-950 ${
        goalMode === mode ? 'border-sky-500 bg-sky-950/40' : 'border-slate-800 bg-slate-900/40 hover:border-slate-600'
      }`}
    >
      <span className="flex items-center gap-2">
        <input
          type="radio"
          name="goalMode"
          className="text-sky-500"
          checked={goalMode === mode}
          onChange={() => setGoalMode(mode)}
        />
        <span className="font-medium text-slate-100">{title}</span>
      </span>
      <span className="pl-6 text-xs text-slate-500">{hint}</span>
    </label>
  )

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-3 py-6 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-modal-title"
        aria-busy={busy}
        className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl sm:p-6"
      >
        {busy ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-slate-950/90 px-6 text-center backdrop-blur-sm">
            <div
              className="h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-orange-400"
              aria-hidden
            />
            <p className="text-sm font-medium text-white">
              {isEdit ? 'Regenerando tu plan con IA…' : 'Generando tu plan con IA…'}
            </p>
            <p className="text-xs text-slate-400">Puede tardar hasta 1–2 minutos. No cierres esta ventana.</p>
          </div>
        ) : null}
        <h3 id="goal-modal-title" className="text-lg font-semibold text-white">
          {isEdit ? 'Editar objetivo' : 'Define tu objetivo'}
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          {isEdit
            ? 'Al guardar se elimina el plan actual y se genera uno nuevo con IA según la meta actualizada y tu Strava reciente. El coach dejará un mensaje en el chat.'
            : 'Generaremos un plan inicial con IA usando tus últimas semanas de Strava y dejaremos listo el panel.'}
        </p>

        <div className="mt-4 space-y-4 text-sm">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Cómo quieres medir la meta
            </legend>
            <div className="mt-2 space-y-2">
              {modeOption(
                'DISTANCE',
                'Solo distancia',
                'Kilómetros totales de carrera a sumar antes de la fecha (volumen en el periodo).',
              )}
              {modeOption(
                'RACE',
                'Distancia y tiempo',
                'Una prueba concreta: distancia en km y tiempo objetivo en minutos (ej. 21,1 km y 120 min).',
              )}
              {modeOption(
                'TIME',
                'Solo tiempo',
                'Minutos totales de carrera a acumular en el plazo, sin fijar una distancia concreta.',
              )}
              {modeOption(
                'PACE',
                'Ritmo (avanzado)',
                'Objetivo de ritmo medio en min/km en decimal (ej. 5,5 = 5 min 30 s por km).',
              )}
            </div>
          </fieldset>

          {goalMode === 'DISTANCE' ? (
            <label className="block text-slate-300">
              Kilómetros a sumar (total)
              <input
                type="text"
                inputMode="decimal"
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                placeholder="Ej. 120"
              />
            </label>
          ) : null}

          {goalMode === 'RACE' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-slate-300">
                Distancia de la prueba (km)
                <input
                  type="text"
                  inputMode="decimal"
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value)}
                  placeholder="Ej. 10 o 21,1"
                />
              </label>
              <label className="block text-slate-300">
                Tiempo objetivo (minutos)
                <input
                  type="text"
                  inputMode="decimal"
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2"
                  value={timeMinutes}
                  onChange={(e) => setTimeMinutes(e.target.value)}
                  placeholder="Ej. 55"
                />
              </label>
            </div>
          ) : null}

          {goalMode === 'TIME' ? (
            <label className="block text-slate-300">
              Minutos totales de carrera
              <input
                type="text"
                inputMode="decimal"
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2"
                value={timeMinutes}
                onChange={(e) => setTimeMinutes(e.target.value)}
                placeholder="Ej. 600"
              />
            </label>
          ) : null}

          {goalMode === 'PACE' ? (
            <label className="block text-slate-300">
              Ritmo objetivo (min/km, decimal)
              <input
                type="text"
                inputMode="decimal"
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2"
                value={paceMinPerKm}
                onChange={(e) => setPaceMinPerKm(e.target.value)}
                placeholder="Ej. 5.5"
              />
            </label>
          ) : null}

          <label className="block text-slate-300">
            Descripción (qué quieres conseguir)
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <label className="block text-slate-300">
            Fecha límite del objetivo
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </label>
        </div>

        {err ? <p className="mt-3 text-xs text-rose-300">{err}</p> : null}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-h-[44px] rounded-lg border border-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Más tarde
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="min-h-[44px] rounded-lg bg-strava px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-60"
          >
            {busy ? (isEdit ? 'Regenerando plan…' : 'Generando…') : isEdit ? 'Guardar y regenerar plan' : 'Guardar y generar plan'}
          </button>
        </div>
      </div>
    </div>
  )
}
