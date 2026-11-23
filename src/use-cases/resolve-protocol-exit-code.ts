import { signalToNumber } from '../lib/signal-to-number.js'
import type {
  TPairedUnresolvedPayload,
  TRunnerExitPayload,
  TRunnerStartPayload,
} from '../protocol/protocol-event.js'
import type { TRunEvent, TTotals } from '../typedefs/run-events.js'
import {
  initialExitState,
  nextExitState,
  type TExitState,
} from './resolve-exit-code.js'

export type TRunnerExitInfo = Readonly<{
  code: number | null
  signal: string | null
}>

export type TProtocolExitState = Readonly<{
  exitState: TExitState
  untested: readonly string[]
  unmatched: readonly string[]
  paired: boolean
  totals: TTotals | undefined
  runnerExit: TRunnerExitInfo | undefined
}>

export const initialProtocolExitState: TProtocolExitState = {
  exitState: initialExitState,
  untested: [],
  unmatched: [],
  paired: false,
  totals: undefined,
  runnerExit: undefined,
}

/**
 * Pure fold over the decoded protocol stream: `runner-start` records paired
 * mode, `paired-unresolved` accumulates notices, `runner-exit` records the
 * child's own outcome (§1.2.4), and every
 * other event folds through the same `nextExitState` the text-mode driver
 * uses (§1.3.3), additionally remembering the last `run-end`'s totals so the
 * verdict line can name a count (§1.3.5).
 */
export const nextProtocolExitState = (
  state: TProtocolExitState,
  event:
    | TRunEvent
    | TRunnerStartPayload
    | TRunnerExitPayload
    | TPairedUnresolvedPayload,
): TProtocolExitState => {
  if (event.type === 'runner-start')
    return event.argv.includes('--paired') === state.paired
      ? state
      : { ...state, paired: event.argv.includes('--paired') }
  if (event.type === 'paired-unresolved')
    return {
      ...state,
      untested: [...state.untested, ...event.untested],
      unmatched: [...state.unmatched, ...event.unmatched],
    }
  if (event.type === 'runner-exit') {
    return {
      ...state,
      runnerExit: { code: event.code, signal: event.signal },
    }
  }

  return {
    ...state,
    exitState: nextExitState(state.exitState, event),
    totals: event.type === 'run-end' ? event.totals : state.totals,
  }
}

export type TProtocolVerdict = Readonly<{ code: number; message: string }>

const pluralTests = (count: number): string =>
  `${count} test${count === 1 ? '' : 's'}`

/**
 * §2.2: resolved top to bottom, the first matching row wins. Failures and
 * the coverage gate outrank the runner's own exit because, when buntap
 * already has an actionable verdict, the runner's code can only agree or
 * confuse it; the runner's code and its absence matter only when buntap
 * parsed no failures at all.
 */
export const resolveProtocolVerdict = (
  state: TProtocolExitState,
): TProtocolVerdict => {
  const fail = (state.totals?.fail ?? 0) + (state.totals?.errors ?? 0)
  if (state.exitState.sawFailure) {
    return { code: 1, message: `${pluralTests(fail)} failed` }
  }

  if (state.untested.length > 0) {
    const count = state.untested.length
    return {
      code: 4,
      message: `${count} ${count === 1 ? 'source has' : 'sources have'} no tests`,
    }
  }

  if (state.exitState.coverageGateFailed) {
    return { code: 3, message: 'coverage below the configured minimum' }
  }

  const { runnerExit } = state
  if (runnerExit !== undefined && runnerExit.signal !== null) {
    const signalNumber = signalToNumber(runnerExit.signal) ?? 0
    return {
      code: 128 + signalNumber,
      message: `bun was killed by ${runnerExit.signal}`,
    }
  }

  if (
    runnerExit !== undefined &&
    runnerExit.code !== null &&
    runnerExit.code !== 0
  ) {
    return {
      code: state.paired && runnerExit.code === 4 ? 2 : runnerExit.code,
      message: `bun exited ${runnerExit.code} before reporting any tests`,
    }
  }

  if (runnerExit === undefined) {
    return {
      code: 2,
      message: 'the runner stopped without reporting its exit code',
    }
  }

  return { code: 0, message: `${pluralTests(state.totals?.pass ?? 0)} passed` }
}
