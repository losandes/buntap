import { expect, test } from 'bun:test'
import type { TReporterDeps } from '../typedefs/reporter.js'
import type { TRunEvent } from '../typedefs/run-events.js'
import { agentReporter } from './agent-reporter.js'

const deps: TReporterDeps = {
  columns: 80,
  isTty: false,
  color: false,
  coverageReport: 'full',
  thresholdPct: undefined,
}

test(
  [
    'given a passing test event',
    'when reported',
    'it should print nothing',
  ].join(', '),
  () => {
    // given
    const reporter = agentReporter(deps)
    const event: TRunEvent = {
      type: 'test',
      status: 'pass',
      file: 'a.test.ts',
      name: 'it works',
      path: ['it works'],
      durationMs: 1,
      diagnostics: [],
    }

    // when
    const { output } = reporter.next(reporter.initial, event)

    // then
    expect(output).toBe('')
  },
)

test(
  [
    'given a failing test event',
    'when reported',
    "it should print the file, the test's name and its diagnostics",
  ].join(', '),
  () => {
    // given
    const reporter = agentReporter(deps)
    const event: TRunEvent = {
      type: 'test',
      status: 'fail',
      file: 'src/b.test.ts',
      name: 'throws',
      path: ['throws'],
      durationMs: 0.11,
      diagnostics: ['error: boom', 'at <anonymous> (src/b.test.ts:3:59)'],
    }

    // when
    const { output } = reporter.next(reporter.initial, event)

    // then
    expect(output).toContain('src/b.test.ts')
    expect(output).toContain('throws')
    expect(output).toContain('error: boom')
  },
)

test(
  [
    'given an unhandled-error event',
    'when reported',
    'it should print the file and the message',
  ].join(', '),
  () => {
    // given
    const reporter = agentReporter(deps)
    const event: TRunEvent = {
      type: 'unhandled-error',
      file: 'src/e.test.ts',
      message: "Cannot find module './nope.ts'",
      diagnostics: ["error: Cannot find module './nope.ts'"],
    }

    // when
    const { output } = reporter.next(reporter.initial, event)

    // then
    expect(output).toContain('src/e.test.ts')
    expect(output).toContain("Cannot find module './nope.ts'")
  },
)

test(
  [
    'given a run-end event',
    'when the reporter ends',
    'it should print the one-line summary from the totals',
  ].join(', '),
  () => {
    // given
    const reporter = agentReporter(deps)
    const event: TRunEvent = {
      type: 'run-end',
      summarySeen: true,
      totals: {
        pass: 2,
        fail: 2,
        skip: 1,
        todo: 1,
        errors: 0,
        expectCalls: 3,
        tests: 6,
        files: 2,
        durationMs: 9,
      },
    }

    // when
    const { state } = reporter.next(reporter.initial, event)
    const actual = reporter.end(state)

    // then
    expect(actual).toBe('6 tests, 2 failed, 1 skipped, 1 todo in 9.00ms\n')
  },
)

test(
  [
    'given the reporter never saw a run-end',
    'when it ends',
    'it should default to zeroed totals',
  ].join(', '),
  () => {
    // given
    const reporter = agentReporter(deps)

    // when
    const actual = reporter.end(reporter.initial)

    // then
    expect(actual).toBe('0 tests, 0 failed, 0 skipped, 0 todo in 0.00ms\n')
  },
)

test(
  ['given a file-start event', 'when reported', 'it should print nothing'].join(
    ', ',
  ),
  () => {
    // given
    const reporter = agentReporter(deps)
    const event: TRunEvent = { type: 'file-start', path: 'a.test.ts' }

    // when
    const { output } = reporter.next(reporter.initial, event)

    // then
    expect(output).toBe('')
  },
)

test(
  [
    'given a coverage passthrough event',
    'when reported',
    'it should print a blank line then the lines verbatim',
  ].join(', '),
  () => {
    // given
    const reporter = agentReporter(deps)
    const event: TRunEvent = {
      type: 'passthrough',
      kind: 'coverage',
      lines: ['File | % Funcs | % Lines', 'src/add.ts | 25.00 | 100.00'],
    }

    // when
    const { output } = reporter.next(reporter.initial, event)

    // then
    expect(output).toBe(
      '\nFile | % Funcs | % Lines\nsrc/add.ts | 25.00 | 100.00\n',
    )
  },
)

test(
  [
    'given a coverage-gate-failed event',
    'when reported',
    'it should print a blank line then the failure signal verbatim',
  ].join(', '),
  () => {
    // given
    const reporter = agentReporter(deps)
    const event: TRunEvent = {
      type: 'coverage-gate-failed',
      thresholdPct: { functionsPct: 95, linesPct: 95 },
      failing: [
        { file: 'src/add.ts', functionsPct: 25, linesPct: 100, uncovered: [] },
      ],
    }

    // when
    const { output } = reporter.next(reporter.initial, event)

    // then
    expect(output).toBe(
      '\nCOVERAGE FAIL 1 file below the minimum (functions 95.00%, lines 95.00%)\n  src/add.ts functions 25.00%, lines 100.00%\n',
    )
  },
)

test(
  [
    'given a coverage-gate-failed event with uncovered lines',
    'when reported',
    'it should append the uncovered suffix to the failing row',
  ].join(', '),
  () => {
    // given
    const reporter = agentReporter(deps)
    const event: TRunEvent = {
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
    const { output } = reporter.next(reporter.initial, event)

    // then
    expect(output).toBe(
      '\nCOVERAGE FAIL 1 file below the minimum (functions 95.00%, lines 95.00%)\n  src/add.ts functions 25.00%, lines 100.00% (uncovered 4-7, 12, 20-22)\n',
    )
  },
)

const coverageFixture: readonly string[] = [
  '------------|---------|---------|-------------------',
  'File        | % Funcs | % Lines | Uncovered Line #s',
  '------------|---------|---------|-------------------',
  'All files   |   62.50 |   90.00 |',
  ' src/add.ts |   25.00 |   90.00 | 4-7',
  '------------|---------|---------|-------------------',
]

test(
  [
    "given a coverage passthrough event, in the agent reporter's default summary mode",
    'when reported',
    "it should print one summary line rather than bun's table",
  ].join(', '),
  () => {
    // given
    const reporter = agentReporter({
      ...deps,
      coverageReport: 'summary',
      thresholdPct: { functionsPct: 95, linesPct: 95 },
    })
    const event: TRunEvent = {
      type: 'passthrough',
      kind: 'coverage',
      lines: coverageFixture,
    }

    // when
    const { output } = reporter.next(reporter.initial, event)

    // then
    expect(output).toBe(
      '\ncoverage  lines 90.00%  funcs 62.50%  ·  1 files  ·  1 below 95%\n',
    )
  },
)

test(
  [
    'given a coverage passthrough event and an overridden --coverage-report=bar',
    'when reported',
    'it should render the bar mode instead of the default',
  ].join(', '),
  () => {
    // given
    const reporter = agentReporter({
      ...deps,
      coverageReport: 'bar',
      thresholdPct: { functionsPct: 95, linesPct: 95 },
    })
    const event: TRunEvent = {
      type: 'passthrough',
      kind: 'coverage',
      lines: coverageFixture,
    }

    // when
    const { output } = reporter.next(reporter.initial, event)

    // then
    expect(output).toContain('FAIL')
    expect(output).toContain('src/add.ts')
  },
)
