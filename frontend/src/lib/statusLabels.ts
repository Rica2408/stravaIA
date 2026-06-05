/** Etiquetas en español para estados que vienen del API en inglés. */

export const sessionStatusEs: Record<string, string> = {
  PENDING: 'Pendiente',
  COMPLETED: 'Completada',
  MISSED: 'Perdida',
  ADJUSTED: 'Ajustada',
}

export function sessionStatusLabel(status: string): string {
  return sessionStatusEs[status] ?? status
}

export const trackStatusEs: Record<string, { label: string }> = {
  ON_TRACK: { label: 'En buen camino' },
  AT_RISK: { label: 'En riesgo' },
  DANGER: { label: 'Fuera de rango' },
}
