import type { TCoverageGateFailedEvent } from '../typedefs/run-events.js'

const pct = (value: number): string => value.toFixed(2)

/**
 * The row's uncovered-lines suffix, shared by `formatCoverageGateFailure` and
 * the markdown reporter, which renders the gate block itself. The suffix
 * carries its own leading space, so a caller appends it unconditionally and
 * an empty array leaves the row untouched.
 */
export const formatUncoveredSuffix = (uncovered: readonly string[]): string =>
  uncovered.length === 0 ? '' : ` (uncovered ${uncovered.join(', ')})`

/**
 * The block is plain and colourless, so its bytes are identical and
 * greppable in every reporter. `formatUncoveredSuffix` is shared with the
 * markdown reporter, which renders this same block from its own template.
 */
export const formatCoverageGateFailure = (
  event: TCoverageGateFailedEvent,
): readonly string[] => {
  const { thresholdPct, failing } = event
  const noun = failing.length === 1 ? 'file' : 'files'
  const headline = `COVERAGE FAIL ${failing.length} ${noun} below the minimum (functions ${pct(thresholdPct.functionsPct)}%, lines ${pct(thresholdPct.linesPct)}%)`
  const rows = failing.map(
    (row) =>
      `  ${row.file} functions ${pct(row.functionsPct)}%, lines ${pct(row.linesPct)}%${formatUncoveredSuffix(row.uncovered)}`,
  )
  return [headline, ...rows]
}
