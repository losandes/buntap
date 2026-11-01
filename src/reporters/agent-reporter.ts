import { formatDuration } from '../lib/format-duration.js'
import type { TReporter, TReporterDeps } from '../typedefs/reporter.js'
import type { TTotals } from '../typedefs/run-events.js'

export type TAgentState = Readonly<{ totals: TTotals | undefined }>

const zeroTotals: TTotals = {
  pass: 0,
  fail: 0,
  skip: 0,
  todo: 0,
  errors: 0,
  expectCalls: 0,
  tests: 0,
  files: 0,
  durationMs: undefined,
}

const renderFailure = (
  file: string | undefined,
  name: string,
  diagnostics: readonly string[],
): string =>
  [`FAIL ${file ?? '(unknown file)'} > ${name}`, ...diagnostics].join('\n')

/**
 * §1.4.7: nothing for a pass, full detail for a failure, one summary line at
 * the end. The summary comes from `run-end`'s own totals rather than a local
 * tally, because bun's counts already distinguish a counted `fail` from a
 * counted `error` in ways a per-event fold would have to reconstruct.
 */
export const agentReporter = (
  _deps: TReporterDeps,
): TReporter<TAgentState> => ({
  initial: { totals: undefined },

  next: (state, event) => {
    if (event.type === 'test' && event.status === 'fail') {
      return {
        state,
        output: `${renderFailure(event.file, event.name, event.diagnostics)}\n`,
      }
    }
    if (event.type === 'unhandled-error') {
      return {
        state,
        output: `${renderFailure(event.file, event.message, event.diagnostics)}\n`,
      }
    }
    if (event.type === 'run-end') {
      return { state: { totals: event.totals }, output: '' }
    }
    return { state, output: '' }
  },

  end: (state) => {
    const totals = state.totals ?? zeroTotals
    return `${totals.tests} tests, ${totals.fail} failed, ${totals.skip} skipped, ${totals.todo} todo in ${formatDuration(totals.durationMs)}\n`
  },
})
