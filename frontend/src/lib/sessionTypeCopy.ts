/** Nombres cortos y descripciones para tipos de sesión del plan (alineado con SessionType en Prisma). */

export const sessionTypeLabel: Record<string, string> = {
  EASY: 'Rodaje suave',
  TEMPO: 'Tempo',
  LONG: 'Largo',
  INTERVALS: 'Series',
  REST: 'Descanso',
  CROSS: 'Complementario',
}

export const sessionTypeDescription: Record<string, string> = {
  EASY:
    'Correr a ritmo cómodo y conversacional. Sirve para sumar kilómetros, recuperar entre entrenamientos duros y reforzar la base aeróbica sin acumular fatiga.',
  TEMPO:
    'Ritmo sostenido “cómodamente duro”, algo por debajo de tu máximo. Mejora el umbral anaeróbico y la capacidad de mantener un esfuerzo alto durante más tiempo.',
  LONG:
    'Salida más larga que el resto de la semana. Construye resistencia aeróbica, confianza en distancia y eficiencia en carrera a ritmo moderado.',
  INTERVALS:
    'Bloques repetidos de alta intensidad con recuperaciones. Desarrolla VO2 máx, velocidad y la capacidad de tolerar el lactato en carrera.',
  REST:
    'Día sin carrera (o muy suave). Permite adaptarse a la carga, reducir riesgo de lesión y llegar fresco a los entrenamientos clave.',
  CROSS:
    'Actividad alternativa (bici, elíptica, fuerza, etc.). Mantiene el condicionamiento general con menos impacto en piernas que solo correr.',
}

export function sessionTypeTitle(type: string): string {
  return sessionTypeLabel[type] ?? type
}

export function sessionTypeExplainer(type: string): string {
  return (
    sessionTypeDescription[type] ??
    'Sesión incluida en tu plan según el objetivo y la carga que toca esa semana.'
  )
}
