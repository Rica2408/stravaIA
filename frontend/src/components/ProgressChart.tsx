import { useMemo } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { format, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Activity } from './types'

interface ProgressChartProps {
  activities: Activity[]
}

export function ProgressChart({ activities }: ProgressChartProps) {
  const data = useMemo(() => {
    const runs = activities.filter((a) => a.type === 'Run')
    const buckets = new Map<string, number>()
    for (const a of runs) {
      const wk = startOfWeek(new Date(a.startDate), { weekStartsOn: 1 })
      const key = wk.toISOString()
      buckets.set(key, (buckets.get(key) ?? 0) + a.distance / 1000)
    }
    const keys = Array.from(buckets.keys()).sort()
    const lastKeys = keys.slice(-8)
    return lastKeys.map((k) => ({
      week: format(new Date(k), 'd MMM', { locale: es }),
      km: Number((buckets.get(k) ?? 0).toFixed(1)),
    }))
  }, [activities])

  if (data.length === 0) {
    return (
      <section className="flex h-full min-h-[14rem] flex-col justify-center rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-500">
        Sin suficientes carreras para graficar todavía.
      </section>
    )
  }

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="mb-2 shrink-0 text-xs uppercase tracking-wide text-slate-400">Km de carrera por semana</p>
      <div className="min-h-0 min-w-0 w-full flex-1">
        <ResponsiveContainer width="100%" height="100%" debounce={50}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="week"
              stroke="#94a3b8"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              interval={0}
              height={36}
              angle={-28}
              textAnchor="end"
              dy={6}
            />
            <YAxis
              stroke="#94a3b8"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={36}
              domain={[0, 'dataMax + 1']}
              tickFormatter={(v) => `${v}`}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#020617', borderRadius: 12, border: '1px solid #1e293b' }}
              labelStyle={{ color: '#e2e8f0' }}
              formatter={(value: number) => [`${value} km`, 'Total']}
            />
            <Line
              type="monotone"
              dataKey="km"
              name="km"
              stroke="#38bdf8"
              strokeWidth={2}
              dot={{ r: 3, fill: '#0ea5e9', strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
