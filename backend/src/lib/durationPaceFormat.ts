/** Formatea segundos totales como m:ss o h:mm:ss (duración de actividad). */
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

/**
 * Ritmo guardado como minutos decimales por km (p. ej. 5.5 = 5 min 30 s / km).
 * Muestra m:ss/km.
 */
export function formatPaceDecimalMinPerKm(decimalMinutesPerKm: number): string {
  const secTotal = Math.round(decimalMinutesPerKm * 60)
  const m = Math.floor(secTotal / 60)
  const s = secTotal % 60
  return `${m}:${String(s).padStart(2, '0')}/km`
}
