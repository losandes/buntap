import { expect, test } from 'bun:test'
import type { TCoverageGateFailedEvent } from '../typedefs/run-events.js'
import {
  formatCoverageGateFailure,
  formatUncoveredSuffix,
} from './format-coverage-gate.js'

test(
  [
    'given one failing file',
    'when formatted',
    'it should use the singular noun',
  ].join(', '),
  () => {
    // given
    const event: TCoverageGateFailedEvent = {
      type: 'coverage-gate-failed',
      thresholdPct: { functionsPct: 95, linesPct: 95 },
      failing: [
        { file: 'src/add.ts', functionsPct: 25, linesPct: 100, uncovered: [] },
      ],
    }

    // when
    const actual = formatCoverageGateFailure(event)

    // then
    expect(actual).toEqual([
      'COVERAGE FAIL 1 file below the minimum (functions 95.00%, lines 95.00%)',
      '  src/add.ts functions 25.00%, lines 100.00%',
    ])
  },
)

test(
  [
    'given more than one failing file',
    'when formatted',
    'it should use the plural noun and one line per file, in table order',
  ].join(', '),
  () => {
    // given
    const event: TCoverageGateFailedEvent = {
      type: 'coverage-gate-failed',
      thresholdPct: { functionsPct: 95, linesPct: 95 },
      failing: [
        { file: 'src/add.ts', functionsPct: 25, linesPct: 100, uncovered: [] },
        { file: 'src/sub.ts', functionsPct: 50, linesPct: 60, uncovered: [] },
      ],
    }

    // when
    const actual = formatCoverageGateFailure(event)

    // then
    expect(actual).toEqual([
      'COVERAGE FAIL 2 files below the minimum (functions 95.00%, lines 95.00%)',
      '  src/add.ts functions 25.00%, lines 100.00%',
      '  src/sub.ts functions 50.00%, lines 60.00%',
    ])
  },
)

test(
  [
    'given a whole-number percentage',
    'when formatted',
    'it should render two decimal places',
  ].join(', '),
  () => {
    // given
    const event: TCoverageGateFailedEvent = {
      type: 'coverage-gate-failed',
      thresholdPct: { functionsPct: 100, linesPct: 100 },
      failing: [
        { file: 'src/add.ts', functionsPct: 0, linesPct: 100, uncovered: [] },
      ],
    }

    // when
    const actual = formatCoverageGateFailure(event)

    // then
    expect(actual).toEqual([
      'COVERAGE FAIL 1 file below the minimum (functions 100.00%, lines 100.00%)',
      '  src/add.ts functions 0.00%, lines 100.00%',
    ])
  },
)

test(
  [
    'given one failing file with a single uncovered range',
    'when formatted',
    'it should append the uncovered suffix to that row',
  ].join(', '),
  () => {
    // given
    const event: TCoverageGateFailedEvent = {
      type: 'coverage-gate-failed',
      thresholdPct: { functionsPct: 95, linesPct: 95 },
      failing: [
        {
          file: 'src/add.ts',
          functionsPct: 25,
          linesPct: 100,
          uncovered: ['12'],
        },
      ],
    }

    // when
    const actual = formatCoverageGateFailure(event)

    // then
    expect(actual).toEqual([
      'COVERAGE FAIL 1 file below the minimum (functions 95.00%, lines 95.00%)',
      '  src/add.ts functions 25.00%, lines 100.00% (uncovered 12)',
    ])
  },
)

test(
  [
    'given one failing file with several uncovered ranges',
    'when formatted',
    'it should join the ranges with a comma in the uncovered suffix',
  ].join(', '),
  () => {
    // given
    const event: TCoverageGateFailedEvent = {
      type: 'coverage-gate-failed',
      thresholdPct: { functionsPct: 95, linesPct: 95 },
      failing: [
        {
          file: 'src/add.ts',
          functionsPct: 25,
          linesPct: 100,
          uncovered: ['4-7', '12', '20-22'],
        },
      ],
    }

    // when
    const actual = formatCoverageGateFailure(event)

    // then
    expect(actual).toEqual([
      'COVERAGE FAIL 1 file below the minimum (functions 95.00%, lines 95.00%)',
      '  src/add.ts functions 25.00%, lines 100.00% (uncovered 4-7, 12, 20-22)',
    ])
  },
)

test(
  [
    'given two failing files where one has uncovered ranges and the other has none',
    'when formatted',
    'it should append the suffix only to the row that has uncovered ranges',
  ].join(', '),
  () => {
    // given
    const event: TCoverageGateFailedEvent = {
      type: 'coverage-gate-failed',
      thresholdPct: { functionsPct: 95, linesPct: 95 },
      failing: [
        {
          file: 'src/add.ts',
          functionsPct: 25,
          linesPct: 100,
          uncovered: ['4-7', '12', '20-22'],
        },
        { file: 'src/sub.ts', functionsPct: 50, linesPct: 60, uncovered: [] },
      ],
    }

    // when
    const actual = formatCoverageGateFailure(event)

    // then
    expect(actual).toEqual([
      'COVERAGE FAIL 2 files below the minimum (functions 95.00%, lines 95.00%)',
      '  src/add.ts functions 25.00%, lines 100.00% (uncovered 4-7, 12, 20-22)',
      '  src/sub.ts functions 50.00%, lines 60.00%',
    ])
  },
)

test(
  [
    'given an empty uncovered array',
    'when formatUncoveredSuffix is called',
    'it should return an empty string',
  ].join(', '),
  () => {
    // given
    const uncovered: readonly string[] = []

    // when
    const actual = formatUncoveredSuffix(uncovered)

    // then
    expect(actual).toBe('')
  },
)
