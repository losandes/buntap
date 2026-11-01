import type { TCoverageGateFailedEvent } from '../typedefs/run-events.js'

const pct = (value: number): string => value.toFixed(2)

/**
 * §2.4: the only place this wording exists. No ANSI colour, so the bytes are
 * identical and greppable in every reporter.
 */
export const formatCoverageGateFailure = (
  event: TCoverageGateFailedEvent,
): readonly string[] => {
  const { thresholdPct, failing } = event
  const noun = failing.length === 1 ? 'file' : 'files'
  const headline = `COVERAGE FAIL ${failing.length} ${noun} below the minimum (functions ${pct(thresholdPct.functionsPct)}%, lines ${pct(thresholdPct.linesPct)}%)`
  const rows = failing.map(
    (row) =>
      `  ${row.file} functions ${pct(row.functionsPct)}%, lines ${pct(row.linesPct)}%`,
  )
  return [headline, ...rows]
}
