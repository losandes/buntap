import { expect, test } from 'bun:test'
import type { TReporterDeps } from '../typedefs/reporter.js'
import type { TRunEvent } from '../typedefs/run-events.js'
import { nyanReporter } from './nyan-reporter.js'

const deps: TReporterDeps = { columns: 80, isTty: true, color: true }

const passEvent = (name: string): TRunEvent => ({
  type: 'test',
  status: 'pass',
  file: 'a.test.ts',
  name,
  path: [name],
  durationMs: 1,
  diagnostics: [],
})

const failEvent = (name: string): TRunEvent => ({
  type: 'test',
  status: 'fail',
  file: 'a.test.ts',
  name,
  path: [name],
  durationMs: 1,
  diagnostics: ['error: boom'],
})

const skipEvent = (name: string): TRunEvent => ({
  type: 'test',
  status: 'skip',
  file: 'a.test.ts',
  name,
  path: [name],
  durationMs: undefined,
  diagnostics: [],
})

test(
  [
    'given a run-start event',
    'when reported',
    'it should hide the cursor and draw the initial scoreboard',
  ].join(', '),
  () => {
    // given
    const reporter = nyanReporter(deps)
    const event: TRunEvent = {
      type: 'run-start',
      version: '1.3.14',
      revision: undefined,
    }

    // when
    const { output, state } = reporter.next(reporter.initial, event)

    // then
    expect(output).toContain('\u001b[?25l')
    expect(state.initialized).toBe(true)
  },
)

test(
  [
    'given a run-start followed by one test',
    'when reported',
    'it should not hide the cursor a second time',
  ].join(', '),
  () => {
    // given
    const reporter = nyanReporter(deps)
    const started = reporter.next(reporter.initial, {
      type: 'run-start',
      version: '1.3.14',
      revision: undefined,
    })

    // when
    const { output } = reporter.next(started.state, passEvent('adds'))

    // then
    expect(output).not.toContain('\u001b[?25l')
  },
)

test(
  [
    'given no run-start was ever seen',
    'when the first test is reported',
    'it should still hide the cursor once, lazily',
  ].join(', '),
  () => {
    // given
    const reporter = nyanReporter(deps)

    // when
    const { output, state } = reporter.next(reporter.initial, passEvent('adds'))

    // then
    expect(output).toContain('\u001b[?25l')
    expect(state.initialized).toBe(true)
  },
)

test(
  [
    'given a passing test and a rainbow colour',
    'when drawn',
    'it should emit the 256-colour trajectory escape',
  ].join(', '),
  () => {
    // given
    const reporter = nyanReporter(deps)

    // when
    const { output } = reporter.next(reporter.initial, passEvent('adds'))

    // then
    // A 256-colour escape wraps a trajectory segment. Checked with includes
    // rather than a regex literal, which would need the same control
    // character strip-ansi.ts builds from a string to avoid Biome's lint.
    expect(output).toContain('\u001b[38;5;')
    expect(output.includes('_\u001b[0m') || output.includes('-\u001b[0m')).toBe(
      true,
    )
  },
)

test(
  [
    'given only passing tests so far',
    'when the cat is drawn',
    'it should use the passing face',
  ].join(', '),
  () => {
    // given
    const reporter = nyanReporter(deps)

    // when
    const { output } = reporter.next(reporter.initial, passEvent('adds'))

    // then
    expect(output).toContain('( ^ .^)')
  },
)

test(
  [
    'given any failure has been seen',
    'when the cat is drawn',
    'it should use the failing face even after later passes',
  ].join(', '),
  () => {
    // given
    const reporter = nyanReporter(deps)
    const afterFail = reporter.next(reporter.initial, failEvent('breaks'))

    // when
    const { output } = reporter.next(afterFail.state, passEvent('adds'))

    // then
    expect(output).toContain('( x .x)')
  },
)

test(
  [
    'given a skip but no failure',
    'when the cat is drawn',
    'it should use the skipped face',
  ].join(', '),
  () => {
    // given
    const reporter = nyanReporter(deps)

    // when
    const { output } = reporter.next(reporter.initial, skipEvent('later'))

    // then
    expect(output).toContain('( o .o)')
  },
)

test(
  [
    'given nothing has run yet',
    'when the scoreboard is drawn before any test',
    'it should use the idle face',
  ].join(', '),
  () => {
    // given
    const narrowDeps: TReporterDeps = { columns: 20, isTty: true, color: true }
    const reporter = nyanReporter(narrowDeps)

    // when
    const { output } = reporter.next(reporter.initial, {
      type: 'run-start',
      version: '1.3.14',
      revision: undefined,
    })

    // then
    expect(output).not.toContain('( ^ .^)')
    expect(output).not.toContain('( x .x)')
  },
)

test(
  [
    'given more tests than the trajectory window is wide',
    'when drawn repeatedly',
    'it should trim the oldest segment from each line',
  ].join(', '),
  () => {
    // given
    const narrowDeps: TReporterDeps = { columns: 20, isTty: true, color: true }
    const reporter = nyanReporter(narrowDeps)

    // when
    const final = Array.from({ length: 20 }, (_, i) =>
      passEvent(`test ${i}`),
    ).reduce(
      (state, event) => reporter.next(state, event).state,
      reporter.initial,
    )

    // then
    const maxWidth = Math.max(Math.floor(narrowDeps.columns * 0.75) - 11, 1)
    expect(final.trajectories.every((line) => line.length <= maxWidth)).toBe(
      true,
    )
  },
)

test(
  [
    'given a tick that alternates',
    'when two tests are drawn in a row',
    'it should flip between the two tail frames',
  ].join(', '),
  () => {
    // given
    const reporter = nyanReporter(deps)

    // when
    const first = reporter.next(reporter.initial, passEvent('a'))
    const second = reporter.next(first.state, passEvent('b'))

    // then
    expect(first.output.includes('~|') || first.output.includes('^|')).toBe(
      true,
    )
    expect(second.output.includes('~|') || second.output.includes('^|')).toBe(
      true,
    )
    expect(first.output.includes('~|')).not.toBe(second.output.includes('~|'))
  },
)

test(
  [
    'given a run with one failure',
    'when the run ends',
    'it should re-show the cursor and dump the collected failure before the summary',
  ].join(', '),
  () => {
    // given
    const reporter = nyanReporter(deps)
    const afterFail = reporter.next(reporter.initial, failEvent('breaks'))
    const endEvent: TRunEvent = {
      type: 'run-end',
      summarySeen: true,
      totals: {
        pass: 0,
        fail: 1,
        skip: 0,
        todo: 0,
        errors: 0,
        expectCalls: 1,
        tests: 1,
        files: 1,
        durationMs: 9,
      },
    }

    // when
    const { output } = reporter.next(afterFail.state, endEvent)

    // then
    expect(output.startsWith('\u001b[?25h')).toBe(true)
    expect(output).toContain('FAIL a.test.ts > breaks')
    expect(output).toContain('error: boom')
    expect(
      output
        .trim()
        .endsWith('1 tests, 0 passed, 1 failed, 0 skipped in 9.00ms'),
    ).toBe(true)
  },
)

test(
  [
    'given a clean run',
    'when it ends',
    'it should print a blank line then the summary with no failure dump',
  ].join(', '),
  () => {
    // given
    const reporter = nyanReporter(deps)
    const endEvent: TRunEvent = {
      type: 'run-end',
      summarySeen: true,
      totals: {
        pass: 1,
        fail: 0,
        skip: 0,
        todo: 0,
        errors: 0,
        expectCalls: 1,
        tests: 1,
        files: 1,
        durationMs: 1,
      },
    }

    // when
    const { output } = reporter.next(reporter.initial, endEvent)

    // then
    expect(output).toBe(
      '\u001b[?25h\n1 tests, 1 passed, 0 failed, 0 skipped in 1.00ms\n',
    )
  },
)

test(
  [
    'given an unhandled-error event',
    'when reported',
    'it should count as a failure and be dumped at the end',
  ].join(', '),
  () => {
    // given
    const reporter = nyanReporter(deps)
    const event: TRunEvent = {
      type: 'unhandled-error',
      file: 'src/e.test.ts',
      message: 'boom',
      diagnostics: ['error: boom'],
    }
    const afterError = reporter.next(reporter.initial, event)
    const endEvent: TRunEvent = {
      type: 'run-end',
      summarySeen: true,
      totals: {
        pass: 0,
        fail: 1,
        skip: 0,
        todo: 0,
        errors: 1,
        expectCalls: 0,
        tests: 1,
        files: 1,
        durationMs: 1,
      },
    }

    // when
    const { output } = reporter.next(afterError.state, endEvent)

    // then
    expect(afterError.output).toContain('( x .x)')
    expect(output).toContain('FAIL src/e.test.ts > boom')
  },
)

test(
  [
    'given a file-start or passthrough event',
    'when reported',
    'it should print nothing',
  ].join(', '),
  () => {
    // given
    const reporter = nyanReporter(deps)

    // when
    const fileStart = reporter.next(reporter.initial, {
      type: 'file-start',
      path: 'a.test.ts',
    })
    const passthrough = reporter.next(reporter.initial, {
      type: 'passthrough',
      kind: 'output',
      lines: ['noise'],
    })

    // then
    expect(fileStart.output).toBe('')
    expect(passthrough.output).toBe('')
  },
)

test(
  ['given the reporter end', 'it should produce no trailing output'].join(', '),
  () => {
    // given
    const reporter = nyanReporter(deps)

    // when
    const actual = reporter.end(reporter.initial)

    // then
    expect(actual).toBe('')
  },
)
