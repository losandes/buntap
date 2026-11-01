import { expect, test } from 'bun:test'
import type { TReporterDeps } from '../typedefs/reporter.js'
import type { TRunEvent } from '../typedefs/run-events.js'
import { blockReporter } from './block-reporter.js'

const deps: TReporterDeps = { columns: 80, isTty: false, color: false }

const testEvent = (
  status: 'pass' | 'fail' | 'skip' | 'todo',
  name: string,
  diagnostics: readonly string[] = [],
): TRunEvent => ({
  type: 'test',
  status,
  file: 'a.test.ts',
  name,
  path: [name],
  durationMs: 1,
  diagnostics,
})

test(
  [
    'given a passing test',
    'when reported',
    'it should print a PASS badge with the full name',
  ].join(', '),
  () => {
    // given
    const reporter = blockReporter(deps)

    // when
    const { output } = reporter.next(
      reporter.initial,
      testEvent('pass', 'it works'),
    )

    // then
    expect(output).toBe(' PASS  it works\n')
  },
)

test(
  [
    'given a failing test with diagnostics',
    'when reported',
    'it should print a FAIL badge and the indented diagnostics',
  ].join(', '),
  () => {
    // given
    const reporter = blockReporter(deps)

    // when
    const { output, state } = reporter.next(
      reporter.initial,
      testEvent('fail', 'it breaks', ['error: boom']),
    )

    // then
    expect(output).toBe(' FAIL  it breaks\n  error: boom\n')
    expect(state.failures).toEqual(['it breaks'])
  },
)

test(
  [
    'given a skipped test',
    'when reported',
    'it should print a SKIP badge',
  ].join(', '),
  () => {
    // given
    const reporter = blockReporter(deps)

    // when
    const { output } = reporter.next(
      reporter.initial,
      testEvent('skip', 'later'),
    )

    // then
    expect(output).toBe(' SKIP  later\n')
  },
)

test(
  ['given a todo test', 'when reported', 'it should print a TODO badge'].join(
    ', ',
  ),
  () => {
    // given
    const reporter = blockReporter(deps)

    // when
    const { output } = reporter.next(
      reporter.initial,
      testEvent('todo', 'someday'),
    )

    // then
    expect(output).toBe(' TODO  someday\n')
  },
)

test(
  [
    'given an unhandled-error event',
    'when reported',
    'it should print a FAIL badge named after the file',
  ].join(', '),
  () => {
    // given
    const reporter = blockReporter(deps)
    const event: TRunEvent = {
      type: 'unhandled-error',
      file: 'src/e.test.ts',
      message: 'boom',
      diagnostics: ['error: boom'],
    }

    // when
    const { output, state } = reporter.next(reporter.initial, event)

    // then
    expect(output).toBe(' FAIL  src/e.test.ts\n  error: boom\n')
    expect(state.failures).toEqual(['src/e.test.ts'])
  },
)

test(
  [
    'given a run-end event',
    'when reported',
    'it should print a blank line then a one-line summary with the totals',
  ].join(', '),
  () => {
    // given
    const reporter = blockReporter(deps)
    const event: TRunEvent = {
      type: 'run-end',
      summarySeen: true,
      totals: {
        pass: 2,
        fail: 1,
        skip: 0,
        todo: 0,
        errors: 0,
        expectCalls: 2,
        tests: 3,
        files: 1,
        durationMs: 5,
      },
    }

    // when
    const { output } = reporter.next(reporter.initial, event)

    // then
    expect(output).toBe('\n3 tests, 2 passed, 1 failed, 0 skipped in 5.00ms\n')
  },
)

test(
  [
    'given color is on',
    'when a pass is reported',
    'it should wrap the badge in the green background escape',
  ].join(', '),
  () => {
    // given
    const reporter = blockReporter({ ...deps, color: true })

    // when
    const { output } = reporter.next(
      reporter.initial,
      testEvent('pass', 'it works'),
    )

    // then
    expect(output).toContain('\u001b[42m')
  },
)

test(
  ['given the reporter end', 'it should produce no trailing output'].join(', '),
  () => {
    // given
    const reporter = blockReporter(deps)

    // when
    const actual = reporter.end(reporter.initial)

    // then
    expect(actual).toBe('')
  },
)

test(
  ['given a file-start event', 'when reported', 'it should print nothing'].join(
    ', ',
  ),
  () => {
    // given
    const reporter = blockReporter(deps)
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
    const reporter = blockReporter(deps)
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
    'it should print the failure signal verbatim',
  ].join(', '),
  () => {
    // given
    const reporter = blockReporter(deps)
    const event: TRunEvent = {
      type: 'coverage-gate-failed',
      thresholdPct: { functionsPct: 95, linesPct: 95 },
      failing: [{ file: 'src/add.ts', functionsPct: 25, linesPct: 100 }],
    }

    // when
    const { output } = reporter.next(reporter.initial, event)

    // then
    expect(output).toBe(
      'COVERAGE FAIL 1 file below the minimum (functions 95.00%, lines 95.00%)\n  src/add.ts functions 25.00%, lines 100.00%\n',
    )
  },
)
