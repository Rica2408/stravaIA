/** Duración total en segundos → m:ss o h:mm:ss */
export function formatDurationSeconds(totalSeconds: number): string {
  const t = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

/** API guarda ritmo como minutos decimales por km (5.5 = 5 min 30 s/km) → m:ss/km */
export function formatPaceDecimalMinPerKm(decimalMinutesPerKm: number): string {
  const secTotal = Math.round(decimalMinutesPerKm * 60)
  const m = Math.floor(secTotal / 60)
  const s = secTotal % 60
  return `${m}:${String(s).padStart(2, '0')}/km`
}

/** plannedDuration en la API = minutos enteros → m:ss */
export function formatPlannedDurationMinutes(minutes: number): string {
  return formatDurationSeconds(minutes * 60)
}
