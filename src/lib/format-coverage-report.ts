import {
  parseCoverageTable,
  parseCoverageTotals,
} from '../parse/parse-coverage-table.js'
import type { TCoverageReportMode } from '../typedefs/cli-options.js'
import type {
  TCoverageRow,
  TCoverageThresholdPct,
  TCoverageTotals,
} from '../typedefs/coverage.js'
import type { TConsoleStyles } from './console-styles.js'

export type TCoverageReportDeps = Readonly<{
  mode: TCoverageReportMode
  styles: TConsoleStyles
  thresholdPct: TCoverageThresholdPct | undefined
}>

const BAR_WIDTH = 24
const PATH_WIDTH = 36
const PCT_FIELD_WIDTH = 7
const MAX_BAR_ROWS = 10

const splitCells = (line: string): readonly string[] =>
  line.split('|').map((cell) => cell.trim())

const isRuleLine = (line: string): boolean => /^-+(?:\|-+)*$/.test(line.trim())

const rowFails = (
  row: TCoverageRow,
  thresholdPct: TCoverageThresholdPct,
): boolean =>
  row.functionsPct < thresholdPct.functionsPct ||
  row.linesPct < thresholdPct.linesPct

const trimPct = (pct: number): string => String(pct)

/**
 * §1.3.9: below a configured threshold is red, within five points above it
 * is yellow, otherwise green. With no threshold, `100` is green, `90` or
 * above is yellow, and anything lower is red.
 */
const pctColor = (
  pct: number,
  thresholdValue: number | undefined,
): 'red' | 'yellow' | 'green' => {
  if (thresholdValue === undefined) {
    if (pct >= 100) return 'green'
    return pct >= 90 ? 'yellow' : 'red'
  }
  if (pct < thresholdValue) return 'red'
  return pct <= thresholdValue + 5 ? 'yellow' : 'green'
}

const formatPct = (pct: number): string =>
  `${pct.toFixed(2)}%`.padStart(PCT_FIELD_WIDTH)

const padPath = (path: string): string =>
  path.length <= PATH_WIDTH
    ? path.padStart(PATH_WIDTH)
    : `…${path.slice(path.length - (PATH_WIDTH - 1))}`

/** §2.2: lower of `lines`/`functions`, `lines` on a tie. */
const lowerMetric = (
  row: TCoverageRow,
): Readonly<{ metric: 'lines' | 'funcs'; pct: number }> =>
  row.linesPct <= row.functionsPct
    ? { metric: 'lines', pct: row.linesPct }
    : { metric: 'funcs', pct: row.functionsPct }

/** §1.3.6: every row below `100%`, ordered ascending by its lower metric then by file. */
const rowsBelow100 = (
  rows: readonly TCoverageRow[],
): readonly Readonly<{
  row: TCoverageRow
  metric: 'lines' | 'funcs'
  pct: number
}>[] =>
  rows
    .filter((row) => row.linesPct < 100 || row.functionsPct < 100)
    .map((row) => ({ row, ...lowerMetric(row) }))
    .toSorted((a, b) => a.pct - b.pct || a.row.file.localeCompare(b.row.file))

const buildBar = (
  pct: number,
  thresholdValue: number | undefined,
  styles: TConsoleStyles,
): string => {
  const filled = Math.round((pct / 100) * BAR_WIDTH)
  const cells = Array.from({ length: BAR_WIDTH }, (_, i) =>
    i < filled ? '█' : '░',
  )
  const withMarker =
    thresholdValue === undefined
      ? cells
      : [
          ...cells.slice(
            0,
            Math.max(
              0,
              Math.min(
                BAR_WIDTH,
                Math.round((thresholdValue / 100) * BAR_WIDTH),
              ),
            ),
          ),
          '┊',
          ...cells.slice(
            Math.max(
              0,
              Math.min(
                BAR_WIDTH,
                Math.round((thresholdValue / 100) * BAR_WIDTH),
              ),
            ),
          ),
        ]
  const color = styles[pctColor(pct, thresholdValue)]
  return withMarker.map((cell) => (cell === '█' ? color(cell) : cell)).join('')
}

const colorizeCell = (
  segment: string,
  thresholdValue: number | undefined,
  styles: TConsoleStyles,
): string => {
  const match = segment.match(/-?\d+(?:\.\d+)?/)
  if (!match) return segment
  const value = Number(match[0])
  const color = styles[pctColor(value, thresholdValue)]
  return segment.replace(match[0], color(match[0]))
}

const colorizeDataLine = (
  line: string,
  funcsIndex: number,
  linesIndex: number,
  thresholdPct: TCoverageThresholdPct | undefined,
  styles: TConsoleStyles,
): string =>
  line
    .split('|')
    .map((segment, index) => {
      if (index === funcsIndex)
        return colorizeCell(segment, thresholdPct?.functionsPct, styles)
      if (index === linesIndex)
        return colorizeCell(segment, thresholdPct?.linesPct, styles)
      return segment
    })
    .join('|')

const headerPositions = (
  lines: readonly string[],
): Readonly<{
  headerIndex: number
  funcsIndex: number
  linesIndex: number
}> => {
  const rows = lines.map(splitCells)
  const headerIndex = rows.findIndex((cells) => cells[0] === 'File')
  if (headerIndex === -1)
    return { headerIndex: -1, funcsIndex: -1, linesIndex: -1 }
  const header = rows[headerIndex] as readonly string[]
  return {
    headerIndex,
    funcsIndex: header.indexOf('% Funcs'),
    linesIndex: header.indexOf('% Lines'),
  }
}

/** §1.3.2/§2.6: bun's table unchanged, with the two percentage cells of each data row coloured and rule lines dimmed. */
const renderFull = (
  lines: readonly string[],
  deps: TCoverageReportDeps,
): readonly string[] => {
  const { headerIndex, funcsIndex, linesIndex } = headerPositions(lines)
  if (headerIndex === -1 || funcsIndex === -1 || linesIndex === -1)
    return [...lines]

  return lines.map((line, index) => {
    if (isRuleLine(line)) return deps.styles.dim(line)
    if (index === headerIndex) return line
    const cells = splitCells(line)
    if (cells[0] === undefined || cells[0] === '') return line
    return colorizeDataLine(
      line,
      funcsIndex,
      linesIndex,
      deps.thresholdPct,
      deps.styles,
    )
  })
}

/** §2.3: the one summary line every other mode falls back on. */
const renderSummary = (
  deps: TCoverageReportDeps,
  rows: readonly TCoverageRow[],
  totals: TCoverageTotals | undefined,
): readonly string[] => {
  if (totals === undefined) return []

  const linesStr = deps.styles[
    pctColor(totals.linesPct, deps.thresholdPct?.linesPct)
  ](formatPct(totals.linesPct).trim())
  const funcsStr = deps.styles[
    pctColor(totals.functionsPct, deps.thresholdPct?.functionsPct)
  ](formatPct(totals.functionsPct).trim())

  const verdict = (() => {
    if (deps.thresholdPct === undefined)
      return deps.styles.yellow('no minimum configured')
    const label = trimPct(deps.thresholdPct.linesPct)
    const failing = rows.filter((row) =>
      rowFails(row, deps.thresholdPct as TCoverageThresholdPct),
    )
    return failing.length === 0
      ? deps.styles.green(`all above ${label}%`)
      : deps.styles.red(`${failing.length} below ${label}%`)
  })()

  return [
    `coverage  lines ${linesStr}  funcs ${funcsStr}  ·  ${totals.files} files  ·  ${verdict}`,
  ]
}

/** §1.3.3: `full`'s lines filtered to the header, rule lines, `All files`, and the failing rows. */
const renderFailures = (
  lines: readonly string[],
  deps: TCoverageReportDeps,
  rows: readonly TCoverageRow[],
  totals: TCoverageTotals | undefined,
): readonly string[] => {
  if (deps.thresholdPct === undefined) return renderSummary(deps, rows, totals)

  const failingFiles = new Set(
    rows
      .filter((row) =>
        rowFails(row, deps.thresholdPct as TCoverageThresholdPct),
      )
      .map((row) => row.file),
  )
  if (failingFiles.size === 0) return renderSummary(deps, rows, totals)

  const full = renderFull(lines, deps)
  return full.filter((_, index) => {
    const line = lines[index] as string
    if (isRuleLine(line)) return true
    const cells = splitCells(line)
    if (cells[0] === 'File') return true
    if (cells[0] === 'All files') return true
    return failingFiles.has(cells[0] ?? '')
  })
}

const badgeFor = (
  row: TCoverageRow,
  thresholdPct: TCoverageThresholdPct | undefined,
  styles: TConsoleStyles,
): string => {
  const failing = thresholdPct !== undefined && rowFails(row, thresholdPct)
  return failing ? styles.red('FAIL') : styles.green('ok  ')
}

/** §1.3.5/§1.3.6: a header line, up to ten rows below `100%`, an overflow note, then the summary line. */
const renderBar = (
  _lines: readonly string[],
  deps: TCoverageReportDeps,
  rows: readonly TCoverageRow[],
  totals: TCoverageTotals | undefined,
): readonly string[] => {
  const label =
    deps.thresholdPct === undefined
      ? 'no minimum configured'
      : `${trimPct(deps.thresholdPct.linesPct)}% minimum`
  const header = deps.styles.dim(`coverage  ${label}`)

  const below = rowsBelow100(rows)
  const selected = below.slice(0, MAX_BAR_ROWS)
  const dropped = Math.max(below.length - MAX_BAR_ROWS, 0)

  const rowLines = selected.map(({ row, metric, pct }) => {
    const thresholdValue =
      deps.thresholdPct === undefined
        ? undefined
        : metric === 'lines'
          ? deps.thresholdPct.linesPct
          : deps.thresholdPct.functionsPct
    const path = padPath(row.file)
    const metricLabel = metric.padEnd(5)
    const pctField = deps.styles[pctColor(pct, thresholdValue)](formatPct(pct))
    const bar = buildBar(pct, thresholdValue, deps.styles)
    const badge = badgeFor(row, deps.thresholdPct, deps.styles)
    const uncovered = deps.styles.cyan(row.uncovered.join(', '))
    return `  ${path}  ${metricLabel}  ${pctField}  ${bar}  ${badge}  ${uncovered}`
  })

  const overflow =
    dropped > 0
      ? [deps.styles.dim(`… and ${dropped} more files below 100%`)]
      : []

  return [
    header,
    ...rowLines,
    ...overflow,
    ...renderSummary(deps, rows, totals),
  ]
}

const markdownRow = (row: TCoverageRow): string =>
  `| \`${row.file}\` | ${row.linesPct.toFixed(2)}% | ${row.functionsPct.toFixed(2)}% | ${row.uncovered.join(', ')} |`

/** §1.3.7/§2.5: a headline, a worst-first table, and bun's table behind a fold. No ANSI, ever. */
const renderMarkdown = (
  lines: readonly string[],
  deps: TCoverageReportDeps,
  rows: readonly TCoverageRow[],
  totals: TCoverageTotals | undefined,
): readonly string[] => {
  if (totals === undefined) return []

  const failing =
    deps.thresholdPct === undefined
      ? []
      : rows.filter((row) =>
          rowFails(row, deps.thresholdPct as TCoverageThresholdPct),
        )

  const headline =
    failing.length > 0
      ? `**Coverage: ${failing.length} of ${totals.files} files below ${trimPct((deps.thresholdPct as TCoverageThresholdPct).linesPct)}%** — lines ${totals.linesPct.toFixed(2)}%, funcs ${totals.functionsPct.toFixed(2)}%`
      : `**Coverage: ${totals.linesPct.toFixed(2)}% lines, ${totals.functionsPct.toFixed(2)}% funcs across ${totals.files} files**`

  const tableRows =
    failing.length > 0
      ? failing.toSorted((a, b) => {
          const metricA = lowerMetric(a)
          const metricB = lowerMetric(b)
          return metricA.pct - metricB.pct || a.file.localeCompare(b.file)
        })
      : rowsBelow100(rows)
          .slice(0, MAX_BAR_ROWS)
          .map(({ row }) => row)

  const table =
    tableRows.length === 0
      ? []
      : [
          '| File | Lines | Funcs | Uncovered |',
          '| --- | --- | --- | --- |',
          ...tableRows.map(markdownRow),
        ]

  return [
    headline,
    '',
    ...table,
    '',
    '<details><summary>Full coverage table</summary>',
    '',
    '```text',
    ...lines,
    '```',
    '',
    '</details>',
  ]
}

/**
 * §1.3.1: the only place any coverage layout exists. Pure, taking the
 * styles it renders with as a dependency (§1.3.10) rather than creating
 * them, so the same input can be asserted with colour on and off.
 */
export const renderCoverageReport =
  (deps: TCoverageReportDeps) =>
  (lines: readonly string[]): readonly string[] => {
    // \u00a71.3.8: nothing to render for a run without `--coverage`, where
    // the event carries no lines at all. `full` always passes already-present
    // lines through unchanged (\u00a71.3.2), even when they do not parse as a
    // table, so that check is scoped to the other modes, which have nothing
    // meaningful to summarise without one.
    if (lines.length === 0) return []

    const rows = parseCoverageTable(lines)
    const totals = parseCoverageTotals(lines)

    if (deps.mode === 'full') return renderFull(lines, deps)
    if (deps.mode === 'failures')
      return renderFailures(lines, deps, rows, totals)
    if (deps.mode === 'summary') return renderSummary(deps, rows, totals)
    if (deps.mode === 'bar') return renderBar(lines, deps, rows, totals)
    return renderMarkdown(lines, deps, rows, totals)
  }
