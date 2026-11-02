import { expect, test } from 'bun:test'
import type { TCoverageGateFailedEvent } from '../typedefs/run-events.js'
import { formatCoverageGateFailure } from './format-coverage-gate.js'

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
