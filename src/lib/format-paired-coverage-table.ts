import type { TCoverageRow } from '../typedefs/coverage.js'

export const formatPairedCoverageTable = (
  rows: readonly TCoverageRow[],
): readonly string[] => {
  if (rows.length === 0) return []
  const width = Math.max(
    'All files'.length,
    ...rows.map((row) => row.file.length + 1),
  )
  const rule = `${'-'.repeat(width + 1)}|---------|---------|-------------------`
  const pct = (value: number) => value.toFixed(2).padStart(7)
  const means = rows.reduce(
    (sum, row) => ({
      functionsPct: sum.functionsPct + row.functionsPct,
      linesPct: sum.linesPct + row.linesPct,
    }),
    { functionsPct: 0, linesPct: 0 },
  )
  return [
    rule,
    `${'File'.padEnd(width)} | % Funcs | % Lines | Uncovered Line #s`,
    rule,
    `${'All files'.padEnd(width)} | ${pct(means.functionsPct / rows.length)} | ${pct(means.linesPct / rows.length)} |`,
    ...rows.map(
      (row) =>
        `${` ${row.file}`.padEnd(width)} | ${pct(row.functionsPct)} | ${pct(row.linesPct)} | ${row.uncovered.join(',')}`,
    ),
    rule,
  ]
}
