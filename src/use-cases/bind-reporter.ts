import type { TReporter, TReporterInstance } from '../typedefs/reporter.js'

/**
 * Erases a `TReporter<TState>`'s state parameter so the driver can hold a
 * single `TReporterInstance` type regardless of which reporter was selected.
 */
export const bindReporter = <TState>(
  reporter: TReporter<TState>,
): TReporterInstance => {
  // The one permitted accumulator in this module: a stream fold cannot be
  // expressed as a reduce because events arrive over time, and the state
  // must not escape this closure.
  let state = reporter.initial
  return {
    next: (event) => {
      const step = reporter.next(state, event)
      state = step.state
      return step.output
    },
    end: () => reporter.end(state),
  }
}
