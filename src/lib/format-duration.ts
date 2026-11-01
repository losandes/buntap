/** Mirrors bun's own `[9.00ms]` formatting: always two decimal places. */
export const formatDuration = (durationMs: number | undefined): string => {
  if (durationMs === undefined) return '0.00ms'
  return `${durationMs.toFixed(2)}ms`
}
