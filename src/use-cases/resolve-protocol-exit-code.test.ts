import { expect, test } from 'bun:test'
import type { TProtocolEvent } from '../protocol/protocol-event.js'
import {
  initialProtocolExitState,
  nextProtocolExitState,
  resolveProtocolVerdict,
} from './resolve-protocol-exit-code.js'

const runEndEvent = (
  overrides: Readonly<Partial<Record<'pass' | 'fail' | 'errors', number>>>,
): TProtocolEvent => ({
  v: 1,
  type: 'run-end',
  summarySeen: true,
  totals: {
    pass: overrides.pass ?? 0,
    fail: overrides.fail ?? 0,
    skip: 0,
    todo: 0,
    errors: overrides.errors ?? 0,
    expectCalls: 0,
    tests: (overrides.pass ?? 0) + (overrides.fail ?? 0),
    files: 1,
    durationMs: 1,
  },
})

test(
  [
    'given a runner-start event',
    'when folded',
    'it should leave the state unchanged',
  ].join(', '),
  () => {
    // given
    const event: TProtocolEvent = { v: 1, type: 'runner-start', argv: [] }

    // when
    const actual = nextProtocolExitState(initialProtocolExitState, event)

    // then
    expect(actual).toBe(initialProtocolExitState)
  },
)

test(
  [
    'given no events were folded at all',
    'when resolved',
    'it should exit 2 because no runner-exit line arrived',
  ].join(', '),
  () => {
    // given
    // when
    const actual = resolveProtocolVerdict(initialProtocolExitState)

    // then
    expect(actual).toEqual({
      code: 2,
      message: 'the runner stopped without reporting its exit code',
    })
  },
)

test(
  [
    'given a run-end reporting failures and a runner-exit of 0',
    'when resolved',
    'it should exit 1 because failures outrank the runner exit code',
  ].join(', '),
  () => {
    // given
    const afterEnd = nextProtocolExitState(
      initialProtocolExitState,
      runEndEvent({ pass: 1, fail: 2 }),
    )
    const afterExit = nextProtocolExitState(afterEnd, {
      type: 'runner-exit',
      code: 0,
      signal: null,
    })

    // when
    const actual = resolveProtocolVerdict(afterExit)

    // then
    expect(actual).toEqual({ code: 1, message: '2 tests failed' })
  },
)

test(
  [
    'given no failures but the coverage gate tripped',
    'when resolved',
    'it should exit 3',
  ].join(', '),
  () => {
    // given
    const afterGate = nextProtocolExitState(initialProtocolExitState, {
      type: 'coverage-gate-failed',
      thresholdPct: { functionsPct: 95, linesPct: 95 },
      failing: [{ file: 'src/add.ts', functionsPct: 25, linesPct: 100 }],
    })
    const afterEnd = nextProtocolExitState(afterGate, runEndEvent({ pass: 1 }))
    const afterExit = nextProtocolExitState(afterEnd, {
      type: 'runner-exit',
      code: 0,
      signal: null,
    })

    // when
    const actual = resolveProtocolVerdict(afterExit)

    // then
    expect(actual).toEqual({
      code: 3,
      message: 'coverage below the configured minimum',
    })
  },
)

test(
  [
    'given no failures and the runner was killed by a signal',
    'when resolved',
    'it should exit 128 plus the signal number',
  ].join(', '),
  () => {
    // given
    const afterEnd = nextProtocolExitState(
      initialProtocolExitState,
      runEndEvent({ pass: 1 }),
    )
    const afterExit = nextProtocolExitState(afterEnd, {
      type: 'runner-exit',
      code: null,
      signal: 'SIGINT',
    })

    // when
    const actual = resolveProtocolVerdict(afterExit)

    // then
    expect(actual).toEqual({ code: 130, message: 'bun was killed by SIGINT' })
  },
)

test(
  [
    'given no failures and the runner exited nonzero with no signal',
    'when resolved',
    "it should exit the runner's own code",
  ].join(', '),
  () => {
    // given
    const afterExit = nextProtocolExitState(initialProtocolExitState, {
      type: 'runner-exit',
      code: 1,
      signal: null,
    })

    // when
    const actual = resolveProtocolVerdict(afterExit)

    // then
    expect(actual).toEqual({
      code: 1,
      message: 'bun exited 1 before reporting any tests',
    })
  },
)

test(
  [
    'given no runner-exit line arrived at all',
    'when resolved',
    'it should exit 2 and name the truncation',
  ].join(', '),
  () => {
    // given
    const afterEnd = nextProtocolExitState(
      initialProtocolExitState,
      runEndEvent({ pass: 1 }),
    )

    // when
    const actual = resolveProtocolVerdict(afterEnd)

    // then
    expect(actual).toEqual({
      code: 2,
      message: 'the runner stopped without reporting its exit code',
    })
  },
)

test(
  [
    'given no failures, a zero runner exit, and a run-end with passes',
    'when resolved',
    'it should exit 0 and count the passes',
  ].join(', '),
  () => {
    // given
    const afterEnd = nextProtocolExitState(
      initialProtocolExitState,
      runEndEvent({ pass: 247 }),
    )
    const afterExit = nextProtocolExitState(afterEnd, {
      type: 'runner-exit',
      code: 0,
      signal: null,
    })

    // when
    const actual = resolveProtocolVerdict(afterExit)

    // then
    expect(actual).toEqual({ code: 0, message: '247 tests passed' })
  },
)
