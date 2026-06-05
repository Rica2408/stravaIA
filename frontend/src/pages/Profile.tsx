import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import api from '@/services/api'
import { LayoutChrome } from '@/components/LayoutChrome'

interface TotalsBlock {
  actividades: number
  distanciaKm: number
  tiempoMovimientoHoras: number
}

interface StatsPayload {
  ultimas4Semanas: { carrera: TotalsBlock | null; bici: TotalsBlock | null; natacion: TotalsBlock | null }
  anoEnCurso: { carrera: TotalsBlock | null; bici: TotalsBlock | null; natacion: TotalsBlock | null }
  enTotal: { carrera: TotalsBlock | null; bici: TotalsBlock | null; natacion: TotalsBlock | null }
}

interface AthletePayload {
  id: number
  username: string | null
  nombre: string
  apellido: string
  nombreCompleto: string
  ciudad: string | null
  provincia: string | null
  pais: string | null
  sexo: string | null
  bio: string | null
  pesoKg: number | null
  unidades: string | null
  fotoUrl: string | null
  cuentaDesde: string | null
  actualizadoEnStrava: string | null
}

function sexoEs(s: string | null | undefined): string {
  if (!s) {
    return '—'
  }
  if (s === 'M') {
    return 'Masculino'
  }
  if (s === 'F') {
    return 'Femenino'
  }
  return s
}

function unidadesEs(u: string | null | undefined): string {
  if (!u) {
    return '—'
  }
  if (u === 'metric') {
    return 'Métrico (km, kg)'
  }
  if (u === 'imperial') {
    return 'Imperial (millas, lb)'
  }
  return u
}

function formatBlock(title: string, b: TotalsBlock | null) {
  if (!b) {
    return null
  }
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-slate-500">Actividades</dt>
          <dd className="font-semibold text-white">{b.actividades}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Distancia</dt>
          <dd className="font-semibold text-white">{b.distanciaKm} km</dd>
        </div>
        <div>
          <dt className="text-slate-500">Tiempo en movimiento</dt>
          <dd className="font-semibold text-white">{b.tiempoMovimientoHoras} h</dd>
        </div>
      </dl>
    </div>
  )
}

export function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [athlete, setAthlete] = useState<AthletePayload | null>(null)
  const [stats, setStats] = useState<StatsPayload | null>(null)
  const [syncedAt, setSyncedAt] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const res = await api.get<{ athlete: AthletePayload; estadisticas: StatsPayload | null; syncedAt: string }>(
        '/api/me/profile',
      )
      setAthlete(res.data.athlete)
      setStats(res.data.estadisticas)
      setSyncedAt(res.data.syncedAt)
    } catch (e: unknown) {
      const msg =
        axios.isAxiosError(e) &&
        e.response?.data &&
        typeof e.response.data === 'object' &&
        e.response.data !== null &&
        'error' in e.response.data
          ? String((e.response.data as { error: string }).error)
          : 'No se pudo cargar el perfil desde Strava.'
      setErr(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <LayoutChrome eyebrow="Tu cuenta Strava" title="Perfil del atleta">
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Los datos se leen en vivo desde la API de Strava y se guardan en la app solo nombre, foto y ubicación para
            el coach.
          </p>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="min-h-[44px] rounded-lg border border-slate-700 px-4 text-sm font-semibold text-sky-300 hover:bg-slate-900 disabled:opacity-50"
          >
            {loading ? 'Actualizando…' : 'Actualizar desde Strava'}
          </button>
        </div>

        {err ? <p className="rounded-xl border border-rose-900/50 bg-rose-950/40 p-4 text-sm text-rose-200">{err}</p> : null}

        {loading && !athlete ? <p className="text-sm text-slate-400">Cargando perfil…</p> : null}

        {athlete ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              {athlete.fotoUrl ? (
                <img
                  src={athlete.fotoUrl}
                  alt={`Foto de perfil de ${athlete.nombreCompleto}`}
                  width={96}
                  height={96}
                  className="h-24 w-24 shrink-0 rounded-full border border-slate-700 object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-2xl text-slate-500">
                  ?
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold text-white">{athlete.nombreCompleto}</h2>
                {athlete.username ? (
                  <p className="mt-1 text-sm text-slate-400">
                    @{athlete.username} · ID Strava {athlete.id}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-slate-400">ID Strava {athlete.id}</p>
                )}
                <p className="mt-2 text-sm text-slate-300">
                  {[athlete.ciudad, athlete.provincia, athlete.pais].filter(Boolean).join(', ') || 'Ubicación no indicada en Strava'}
                </p>
                {athlete.bio ? <p className="mt-3 text-sm leading-relaxed text-slate-400">{athlete.bio}</p> : null}
              </div>
            </div>
            <dl className="mt-6 grid gap-4 border-t border-slate-800 pt-6 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase text-slate-500">Sexo</dt>
                <dd className="mt-1 text-sm text-white">{sexoEs(athlete.sexo)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Peso</dt>
                <dd className="mt-1 text-sm text-white">
                  {athlete.pesoKg != null ? `${athlete.pesoKg} kg` : 'No indicado en Strava'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Unidades</dt>
                <dd className="mt-1 text-sm text-white">{unidadesEs(athlete.unidades)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Cuenta desde</dt>
                <dd className="mt-1 text-sm text-white">
                  {athlete.cuentaDesde ? new Date(athlete.cuentaDesde).toLocaleDateString('es-ES') : '—'}
                </dd>
              </div>
            </dl>
            {syncedAt ? (
              <p className="mt-4 text-xs text-slate-500">
                Última sincronización con Strava: {new Date(syncedAt).toLocaleString('es-ES')}
              </p>
            ) : null}
          </section>
        ) : null}

        {stats ? (
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Resumen de actividades (Strava)</h3>
            <div className="space-y-3">
              <p className="text-xs text-slate-500">Últimas 4 semanas</p>
              <div className="grid gap-3 md:grid-cols-3">
                {formatBlock('Carrera', stats.ultimas4Semanas.carrera)}
                {formatBlock('Bicicleta', stats.ultimas4Semanas.bici)}
                {formatBlock('Natación', stats.ultimas4Semanas.natacion)}
              </div>
              <p className="pt-2 text-xs text-slate-500">Año en curso</p>
              <div className="grid gap-3 md:grid-cols-3">
                {formatBlock('Carrera', stats.anoEnCurso.carrera)}
                {formatBlock('Bicicleta', stats.anoEnCurso.bici)}
                {formatBlock('Natación', stats.anoEnCurso.natacion)}
              </div>
              <p className="pt-2 text-xs text-slate-500">En total (desde Strava)</p>
              <div className="grid gap-3 md:grid-cols-3">
                {formatBlock('Carrera', stats.enTotal.carrera)}
                {formatBlock('Bicicleta', stats.enTotal.bici)}
                {formatBlock('Natación', stats.enTotal.natacion)}
              </div>
            </div>
          </section>
        ) : athlete && !err ? (
          <p className="text-sm text-slate-500">Strava no devolvió estadísticas agregadas (puede ser un límite temporal).</p>
        ) : null}

        {athlete ? (
          <p className="text-center text-xs text-slate-600">
            <a
              href={`https://www.strava.com/athletes/${athlete.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-400 hover:text-sky-300"
            >
              Abrir perfil público en Strava
            </a>
          </p>
        ) : null}
      </main>
    </LayoutChrome>
  )
}
