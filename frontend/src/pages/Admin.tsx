import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import api from '@/services/api'
import { LayoutChrome } from '@/components/LayoutChrome'

interface UserUsageRow {
  userId: string
  displayName: string
  stravaId: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  requestCount: number
}

interface DailyUsageRow {
  date: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

interface AiUsageResponse {
  days: number
  since: string
  totals: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
    requestCount: number
  }
  byUser: UserUsageRow[]
  daily: DailyUsageRow[]
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`
  }
  return String(n)
}

export function AdminPage() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<AiUsageResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<AiUsageResponse>('/api/admin/ai-usage', { params: { days } })
      setData(res.data)
    } catch (e: unknown) {
      if (axios.isAxiosError(e) && e.response?.status === 403) {
        setError('No tienes permisos de administrador.')
      } else {
        setError('No se pudo cargar el uso de tokens.')
      }
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    void load()
  }, [load])

  const userChartData = useMemo(
    () =>
      (data?.byUser ?? []).map((u) => ({
        name: u.displayName.length > 18 ? `${u.displayName.slice(0, 16)}…` : u.displayName,
        entrada: u.inputTokens,
        salida: u.outputTokens,
        total: u.totalTokens,
        peticiones: u.requestCount,
      })),
    [data],
  )

  const dailyChartData = useMemo(
    () =>
      (data?.daily ?? []).map((d) => ({
        fecha: d.date.slice(5),
        total: d.totalTokens,
      })),
    [data],
  )

  return (
    <LayoutChrome eyebrow="Administración" title="Uso de tokens IA">
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-slate-300">
            Periodo
            <select
              className="ml-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={7}>7 días</option>
              <option value={30}>30 días</option>
              <option value={90}>90 días</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void load()}
            className="min-h-[44px] rounded-lg border border-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-900"
          >
            Actualizar
          </button>
        </div>

        {loading ? <p className="text-sm text-slate-400">Cargando métricas…</p> : null}
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}

        {data ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Total tokens</p>
                <p className="mt-1 text-2xl font-semibold text-white">{formatTokens(data.totals.totalTokens)}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Entrada</p>
                <p className="mt-1 text-2xl font-semibold text-sky-300">{formatTokens(data.totals.inputTokens)}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Salida</p>
                <p className="mt-1 text-2xl font-semibold text-orange-300">{formatTokens(data.totals.outputTokens)}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Peticiones IA</p>
                <p className="mt-1 text-2xl font-semibold text-white">{data.totals.requestCount}</p>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="mb-3 text-xs uppercase tracking-wide text-slate-400">Tokens por usuario</p>
              {userChartData.length === 0 ? (
                <p className="text-sm text-slate-500">Aún no hay registros en este periodo.</p>
              ) : (
                <div className="h-72 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <BarChart data={userChartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={56} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={formatTokens} />
                      <Tooltip
                        contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                        formatter={(value: number, name: string) => [formatTokens(value), name === 'entrada' ? 'Entrada' : 'Salida']}
                      />
                      <Legend />
                      <Bar dataKey="entrada" stackId="a" fill="#38bdf8" name="Entrada" />
                      <Bar dataKey="salida" stackId="a" fill="#fb923c" name="Salida" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="mb-3 text-xs uppercase tracking-wide text-slate-400">Tokens por día (todos los usuarios)</p>
              {dailyChartData.length === 0 ? (
                <p className="text-sm text-slate-500">Sin actividad diaria registrada.</p>
              ) : (
                <div className="h-56 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <LineChart data={dailyChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="fecha" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={formatTokens} />
                      <Tooltip
                        contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                        formatter={(value: number) => [formatTokens(value), 'Total']}
                      />
                      <Line type="monotone" dataKey="total" stroke="#a78bfa" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            {data.byUser.length > 0 ? (
              <section className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40">
                <table className="min-w-full text-left text-sm text-slate-300">
                  <thead className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Usuario</th>
                      <th className="px-4 py-3">Strava ID</th>
                      <th className="px-4 py-3">Entrada</th>
                      <th className="px-4 py-3">Salida</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Peticiones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byUser.map((u) => (
                      <tr key={u.userId} className="border-b border-slate-900/80">
                        <td className="px-4 py-3">{u.displayName}</td>
                        <td className="px-4 py-3">{u.stravaId}</td>
                        <td className="px-4 py-3">{formatTokens(u.inputTokens)}</td>
                        <td className="px-4 py-3">{formatTokens(u.outputTokens)}</td>
                        <td className="px-4 py-3 font-medium text-white">{formatTokens(u.totalTokens)}</td>
                        <td className="px-4 py-3">{u.requestCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : null}
          </>
        ) : null}
      </main>
    </LayoutChrome>
  )
}
