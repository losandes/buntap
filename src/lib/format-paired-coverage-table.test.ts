import { expect, test } from 'bun:test'
import {
  parseCoverageTable,
  parseCoverageTotals,
} from '../parse/parse-coverage-table.js'
import { formatPairedCoverageTable } from './format-paired-coverage-table.js'

test(
  [
    'given paired rows with different coverage and uncovered ranges',
    'when formatting a synthetic coverage table',
    'it should follow the table contract and round trip through both parsers',
  ].join(', '),
  () => {
    // given
    const rows = [
      {
        file: 'src/add.ts',
        functionsPct: 50,
        linesPct: 75,
        uncovered: ['4', '8-10'],
      },
      { file: 'src/sub.ts', functionsPct: 100, linesPct: 100, uncovered: [] },
    ]
    // when
    const actual = formatPairedCoverageTable(rows)
    // then
    expect(actual).toEqual([
      '------------|---------|---------|-------------------',
      'File        | % Funcs | % Lines | Uncovered Line #s',
      '------------|---------|---------|-------------------',
      'All files   |   75.00 |   87.50 |',
      ' src/add.ts |   50.00 |   75.00 | 4,8-10',
      ' src/sub.ts |  100.00 |  100.00 | ',
      '------------|---------|---------|-------------------',
    ])
    expect(parseCoverageTable(actual)).toEqual(rows)
    expect(parseCoverageTotals(actual)).toEqual({
      functionsPct: 75,
      linesPct: 87.5,
      files: 2,
    })
  },
)

test(
  [
    'given short source paths',
    'when formatting coverage',
    'it should keep the All files column wide enough',
  ].join(', '),
  () => {
    // given
    const rows = [{ file: 'x.ts', functionsPct: 0, linesPct: 0, uncovered: [] }]
    // when
    const actual = formatPairedCoverageTable(rows)
    // then
    expect(actual[0]).toBe('----------|---------|---------|-------------------')
    expect(parseCoverageTable(actual)).toEqual(rows)
  },
)

test(
  [
    'given no paired rows',
    'when formatting coverage',
    'it should emit no table',
  ].join(', '),
  () => {
    // given
    // when
    const actual = formatPairedCoverageTable([])
    // then
    expect(actual).toEqual([])
  },
)
