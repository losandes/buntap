import type { TCoverageRow, TCoverageTotals } from '../typedefs/coverage.js'

const splitCells = (line: string): readonly string[] =>
  line.split('|').map((cell) => cell.trim())

const findHeaderIndex = (rows: readonly (readonly string[])[]): number =>
  rows.findIndex((cells) => cells[0] === 'File')

const findAllFilesIndex = (
  rows: readonly (readonly string[])[],
  headerIndex: number,
): number =>
  rows.slice(headerIndex + 1).findIndex((cells) => cells[0] === 'All files')

const toUncovered = (cell: string | undefined): readonly string[] =>
  (cell ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

/**
 * Locates the `File` header row and reads the `% Funcs`/`% Lines` column
 * indexes from it, rather than assuming positions, so a transposed table
 * still parses correctly (§2.2). Rule lines, blanks, the `All files` row,
 * and any row whose percentage cells do not parse as finite numbers are
 * skipped.
 */
export const parseCoverageTable = (
  lines: readonly string[],
): readonly TCoverageRow[] => {
  const rows = lines.map(splitCells)
  const headerIndex = findHeaderIndex(rows)
  if (headerIndex === -1) return []

  const header = rows[headerIndex] as readonly string[]
  const funcsIndex = header.indexOf('% Funcs')
  const linesIndex = header.indexOf('% Lines')
  const uncoveredIndex = header.indexOf('Uncovered Line #s')
  if (funcsIndex === -1 || linesIndex === -1) return []

  const toRow = (cells: readonly string[]): TCoverageRow | undefined => {
    const file = cells[0]
    if (file === undefined || file === '' || file === 'All files')
      return undefined
    const functionsPct = Number(cells[funcsIndex])
    const linesPct = Number(cells[linesIndex])
    if (!(Number.isFinite(functionsPct) && Number.isFinite(linesPct)))
      return undefined
    const uncovered =
      uncoveredIndex === -1 ? [] : toUncovered(cells[uncoveredIndex])
    return { file, functionsPct, linesPct, uncovered }
  }

  return rows
    .slice(headerIndex + 1)
    .map(toRow)
    .filter((row): row is TCoverageRow => row !== undefined)
}

/**
 * §1.2.2: reads `% Funcs`/`% Lines` from the `All files` row and sets
 * `files` to the number of rows `parseCoverageTable` returns for the same
 * input. Returns `undefined` when there is no header row, no `All files`
 * row, or either percentage cell does not parse as a finite number.
 */
export const parseCoverageTotals = (
  lines: readonly string[],
): TCoverageTotals | undefined => {
  const rows = lines.map(splitCells)
  const headerIndex = findHeaderIndex(rows)
  if (headerIndex === -1) return undefined

  const header = rows[headerIndex] as readonly string[]
  const funcsIndex = header.indexOf('% Funcs')
  const linesIndex = header.indexOf('% Lines')
  if (funcsIndex === -1 || linesIndex === -1) return undefined

  const allFilesOffset = findAllFilesIndex(rows, headerIndex)
  if (allFilesOffset === -1) return undefined
  const allFilesRow = rows[
    headerIndex + 1 + allFilesOffset
  ] as readonly string[]

  const functionsPct = Number(allFilesRow[funcsIndex])
  const linesPct = Number(allFilesRow[linesIndex])
  if (!(Number.isFinite(functionsPct) && Number.isFinite(linesPct)))
    return undefined

  return { functionsPct, linesPct, files: parseCoverageTable(lines).length }
}
