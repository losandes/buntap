import { expect, test } from 'bun:test'
import type { TReporterDeps } from '../typedefs/reporter.js'
import type { TRunEvent } from '../typedefs/run-events.js'
import { agentReporter } from './agent-reporter.js'

const deps: TReporterDeps = { columns: 80, isTty: false, color: false }

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
