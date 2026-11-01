import { expect, test } from 'bun:test'
import type { TRunEvent } from '../typedefs/run-events.js'
import { evaluateCoverageGate } from './evaluate-coverage-gate.js'

const coverageEvent = (lines: readonly string[]): TRunEvent => ({
  type: 'passthrough',
  kind: 'coverage',
  lines,
})

const failingTableLines = [
  '------------|---------|---------|-------------------',
  'File        | % Funcs | % Lines | Uncovered Line #s',
  '------------|---------|---------|-------------------',
  'All files   |   62.50 |  100.00 |',
  ' src/add.ts |   25.00 |  100.00 |',
  '------------|---------|---------|-------------------',
]

const passingTableLines = [
  '------------|---------|---------|-------------------',
  'File        | % Funcs | % Lines | Uncovered Line #s',
  '------------|---------|---------|-------------------',
  'All files   |  100.00 |  100.00 |',
  ' src/add.ts |  100.00 |  100.00 |',
  '------------|---------|---------|-------------------',
]

test(
  [
    'given a coverage event with a failing row',
    'when evaluated against a threshold',
    'it should produce the coverage event followed by a gate-failed event',
  ].join(', '),
  () => {
    // given
    const event = coverageEvent(failingTableLines)
    const thresholdPct = { functionsPct: 95, linesPct: 95 }

    // when
    const actual = evaluateCoverageGate(thresholdPct)(event)

    // then
    expect(actual).toHaveLength(2)
    expect(actual[0]).toBe(event)
    expect(actual[1]).toEqual({
      type: 'coverage-gate-failed',
      thresholdPct,
      failing: [{ file: 'src/add.ts', functionsPct: 25, linesPct: 100 }],
    })
  },
)

test(
  [
    'given a coverage event with all rows at or above the threshold',
    'when evaluated',
    'it should produce only the coverage event',
  ].join(', '),
  () => {
    // given
    const event = coverageEvent(passingTableLines)
    const thresholdPct = { functionsPct: 95, linesPct: 95 }

    // when
    const actual = evaluateCoverageGate(thresholdPct)(event)

    // then
    expect(actual).toEqual([event])
  },
)

test(
  [
    'given a row exactly at the threshold',
    'when evaluated',
    'it should pass because equality is not a failure',
  ].join(', '),
  () => {
    // given
    const event = coverageEvent([
      '------------|---------|---------|-------------------',
      'File        | % Funcs | % Lines | Uncovered Line #s',
      '------------|---------|---------|-------------------',
      'All files   |   95.00 |   95.00 |',
      ' src/add.ts |   95.00 |   95.00 |',
      '------------|---------|---------|-------------------',
    ])
    const thresholdPct = { functionsPct: 95, linesPct: 95 }

    // when
    const actual = evaluateCoverageGate(thresholdPct)(event)

    // then
    expect(actual).toEqual([event])
  },
)

test(
  [
    'given no threshold is configured',
    'when a coverage event with a failing row is evaluated',
    'it should produce only the coverage event',
  ].join(', '),
  () => {
    // given
    const event = coverageEvent(failingTableLines)

    // when
    const actual = evaluateCoverageGate(undefined)(event)

    // then
    expect(actual).toEqual([event])
  },
)

test(
  [
    'given a non-coverage event',
    'when evaluated',
    'it should pass through untouched',
  ].join(', '),
  () => {
    // given
    const event: TRunEvent = { type: 'file-start', path: 'a.test.ts' }

    // when
    const actual = evaluateCoverageGate({
      functionsPct: 95,
      linesPct: 95,
    })(event)

    // then
    expect(actual).toEqual([event])
  },
)
