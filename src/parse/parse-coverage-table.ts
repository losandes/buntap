import type { TCoverageRow } from '../typedefs/coverage.js'

const splitCells = (line: string): readonly string[] =>
  line.split('|').map((cell) => cell.trim())

const findHeaderIndex = (rows: readonly (readonly string[])[]): number =>
  rows.findIndex((cells) => cells[0] === 'File')

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
  if (funcsIndex === -1 || linesIndex === -1) return []

  const toRow = (cells: readonly string[]): TCoverageRow | undefined => {
    const file = cells[0]
    if (file === undefined || file === '' || file === 'All files')
      return undefined
    const functionsPct = Number(cells[funcsIndex])
    const linesPct = Number(cells[linesIndex])
    if (!(Number.isFinite(functionsPct) && Number.isFinite(linesPct)))
      return undefined
    return { file, functionsPct, linesPct }
  }

  return rows
    .slice(headerIndex + 1)
    .map(toRow)
    .filter((row): row is TCoverageRow => row !== undefined)
}
