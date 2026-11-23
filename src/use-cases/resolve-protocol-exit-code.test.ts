import { expect, test } from 'bun:test'
import type { TProtocolEvent } from '../protocol/protocol-event.js'
import {
  initialProtocolExitState,
  nextProtocolExitState,
  resolveProtocolVerdict,
} from './resolve-protocol-exit-code.js'

for (const { paired, runnerCode, untested, failure, gate, signal, code } of [
  { paired: true, runnerCode: 4, untested: [], code: 2 },
  { paired: true, runnerCode: 4, untested: ['x.ts'], code: 4 },
  { paired: true, runnerCode: 0, untested: ['x.ts'], code: 4 },
  { paired: false, runnerCode: 4, untested: [], code: 4 },
  { paired: true, runnerCode: 5, untested: [], code: 5 },
  { paired: true, runnerCode: 0, untested: [], code: 0 },
  {
    paired: true,
    runnerCode: 4,
    untested: ['x.ts', 'y.ts'],
    gate: true,
    code: 4,
  },
  { paired: true, runnerCode: 4, untested: ['x.ts'], failure: true, code: 1 },
  {
    paired: true,
    runnerCode: 4,
    untested: ['x.ts'],
    signal: 'SIGINT',
    code: 4,
  },
  { paired: true, runnerCode: 4, untested: [], gate: true, code: 3 },
  { paired: true, runnerCode: 4, untested: [], signal: 'SIGINT', code: 130 },
] as readonly Readonly<{
  paired: boolean
  runnerCode: number
  untested: readonly string[]
  failure?: boolean
  gate?: boolean
  signal?: string
  code: number
}>[]) {
  test(
    [
      `given paired=${paired} runner=${runnerCode} untested=${untested} failure=${failure} gate=${gate} signal=${signal}`,
      'when resolving protocol state',
      `it should return reserved verdict ${code} with the original runner code in the message`,
    ].join(', '),
    () => {
      // given
      const started = nextProtocolExitState(initialProtocolExitState, {
        type: 'runner-start',
        argv: paired ? ['--paired'] : [],
      })
      const unresolved = nextProtocolExitState(started, {
        type: 'paired-unresolved',
        untested,
        unmatched: ['gone'],
      })
      const state = {
        ...unresolved,
        runnerExit: { code: runnerCode, signal: signal ?? null },
        exitState: {
          sawFailure: failure ?? false,
          coverageGateFailed: gate ?? false,
          summarySeen: false,
        },
      }
      // when
      const actual = resolveProtocolVerdict(state)
      // then
      expect(started.paired).toBe(paired)
      expect(actual.code).toBe(code)
      if (code === 4 && untested.length > 0)
        expect(actual.message).toBe(
          `${untested.length} ${untested.length === 1 ? 'source has' : 'sources have'} no tests`,
        )
      if (code === 2 || (code === 4 && untested.length === 0) || code === 5)
        expect(actual.message).toBe(
          `bun exited ${runnerCode} before reporting any tests`,
        )
    },
  )
}

test(
  [
    'given repeated unresolved events',
    'when folding their lists',
    'it should concatenate both lists in arrival order',
  ].join(', '),
  () => {
    // given
    const first = nextProtocolExitState(initialProtocolExitState, {
      type: 'paired-unresolved',
      untested: ['a.ts'],
      unmatched: ['gone'],
    })
    // when
    const actual = nextProtocolExitState(first, {
      type: 'paired-unresolved',
      untested: ['b.ts'],
      unmatched: ['missing'],
    })
    // then
    expect(actual.untested).toEqual(['a.ts', 'b.ts'])
    expect(actual.unmatched).toEqual(['gone', 'missing'])
  },
)

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
      failing: [
        { file: 'src/add.ts', functionsPct: 25, linesPct: 100, uncovered: [] },
      ],
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
