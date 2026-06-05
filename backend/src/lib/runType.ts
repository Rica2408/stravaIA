export const RUN_LIKE_ACTIVITY_TYPES = ['Run', 'TrailRun', 'VirtualRun'] as const

const RUN_LIKE_TYPES = new Set<string>(RUN_LIKE_ACTIVITY_TYPES)

export function isRunLikeActivityType(type: string): boolean {
  return RUN_LIKE_TYPES.has(type)
}
