import { expect, test } from 'bun:test'
import { lowCoverageFixture } from './bun-output.fixture.js'
import {
  parseCoverageTable,
  parseCoverageTotals,
} from './parse-coverage-table.js'

const coverageLinesOf = (fixture: string): readonly string[] =>
  fixture
    .split('\n')
    .filter((line) => line.includes('|') || line.startsWith('All files'))

test(
  [
    'given the low-coverage fixture table',
    'when parsed',
    'it should return one row per file and exclude All files',
  ].join(', '),
  () => {
    // given
    const lines = coverageLinesOf(lowCoverageFixture)

    // when
    const actual = parseCoverageTable(lines)

    // then
    expect(actual).toEqual([
      {
        file: 'src/add.ts',
        functionsPct: 25,
        linesPct: 100,
        uncovered: [],
      },
      {
        file: 'src/full.ts',
        functionsPct: 100,
        linesPct: 100,
        uncovered: [],
      },
    ])
  },
)

test(
  [
    'given a table with an Uncovered Line #s value present',
    'when parsed',
    'it should still read the percentages correctly',
  ].join(', '),
  () => {
    // given
    const lines = [
      '------------|---------|---------|-------------------',
      'File        | % Funcs | % Lines | Uncovered Line #s',
      '------------|---------|---------|-------------------',
      'All files   |   80.00 |   90.00 |',
      ' src/add.ts |   80.00 |   90.00 | 4-7',
      '------------|---------|---------|-------------------',
    ]

    // when
    const actual = parseCoverageTable(lines)

    // then
    expect(actual).toEqual([
      {
        file: 'src/add.ts',
        functionsPct: 80,
        linesPct: 90,
        uncovered: ['4-7'],
      },
    ])
  },
)

test(
  [
    'given a header whose % Funcs and % Lines columns are transposed',
    'when parsed',
    'it should read percentages by column name, not position',
  ].join(', '),
  () => {
    // given
    const lines = [
      '------------|---------|---------|-------------------',
      'File        | % Lines | % Funcs | Uncovered Line #s',
      '------------|---------|---------|-------------------',
      'All files   |   90.00 |   80.00 |',
      ' src/add.ts |   90.00 |   80.00 |',
      '------------|---------|---------|-------------------',
    ]

    // when
    const actual = parseCoverageTable(lines)

    // then
    expect(actual).toEqual([
      {
        file: 'src/add.ts',
        functionsPct: 80,
        linesPct: 90,
        uncovered: [],
      },
    ])
  },
)

test(
  [
    'given input that is not a coverage table at all',
    'when parsed',
    'it should return an empty array',
  ].join(', '),
  () => {
    // given
    const lines = ['some stray diagnostic text', 'another line']

    // when
    const actual = parseCoverageTable(lines)

    // then
    expect(actual).toEqual([])
  },
)

test(
  [
    'given a row with several uncovered ranges',
    'when parsed',
    'it should split on comma, trim, and drop empty elements',
  ].join(', '),
  () => {
    // given
    const lines = [
      '------------|---------|---------|-------------------',
      'File        | % Funcs | % Lines | Uncovered Line #s',
      '------------|---------|---------|-------------------',
      'All files   |   80.00 |   90.00 |',
      ' src/add.ts |   80.00 |   90.00 | 4-7, 12, , 20-22',
      '------------|---------|---------|-------------------',
    ]

    // when
    const actual = parseCoverageTable(lines)

    // then
    expect(actual).toEqual([
      {
        file: 'src/add.ts',
        functionsPct: 80,
        linesPct: 90,
        uncovered: ['4-7', '12', '20-22'],
      },
    ])
  },
)

test(
  [
    'given a table with no Uncovered Line #s column',
    'when parsed',
    'it should still return rows, each with an empty uncovered array',
  ].join(', '),
  () => {
    // given
    const lines = [
      '------------|---------|---------',
      'File        | % Funcs | % Lines',
      '------------|---------|---------',
      'All files   |   80.00 |   90.00',
      ' src/add.ts |   80.00 |   90.00',
      '------------|---------|---------',
    ]

    // when
    const actual = parseCoverageTable(lines)

    // then
    expect(actual).toEqual([
      {
        file: 'src/add.ts',
        functionsPct: 80,
        linesPct: 90,
        uncovered: [],
      },
    ])
  },
)

test(
  [
    'given a well-formed table',
    'when parseCoverageTotals is called',
    'it should read the All files row and count the rows parseCoverageTable returns',
  ].join(', '),
  () => {
    // given
    const lines = coverageLinesOf(lowCoverageFixture)

    // when
    const actual = parseCoverageTotals(lines)

    // then
    expect(actual).toEqual({ functionsPct: 62.5, linesPct: 100, files: 2 })
  },
)

test(
  [
    'given a table with no All files row',
    'when parseCoverageTotals is called',
    'it should return undefined',
  ].join(', '),
  () => {
    // given
    const lines = [
      '------------|---------|---------',
      'File        | % Funcs | % Lines',
      '------------|---------|---------',
      ' src/add.ts |   80.00 |   90.00',
      '------------|---------|---------',
    ]

    // when
    const actual = parseCoverageTotals(lines)

    // then
    expect(actual).toBeUndefined()
  },
)

test(
  [
    'given a table whose All files percentages are not numeric',
    'when parseCoverageTotals is called',
    'it should return undefined',
  ].join(', '),
  () => {
    // given
    const lines = [
      '------------|---------|---------',
      'File        | % Funcs | % Lines',
      '------------|---------|---------',
      'All files   |     n/a |     n/a',
      ' src/add.ts |   80.00 |   90.00',
      '------------|---------|---------',
    ]

    // when
    const actual = parseCoverageTotals(lines)

    // then
    expect(actual).toBeUndefined()
  },
)

test(
  [
    'given input with no header row',
    'when parseCoverageTotals is called',
    'it should return undefined',
  ].join(', '),
  () => {
    // given
    const lines = ['some stray diagnostic text', 'another line']

    // when
    const actual = parseCoverageTotals(lines)

    // then
    expect(actual).toBeUndefined()
  },
)
