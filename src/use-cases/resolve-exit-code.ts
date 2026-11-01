import type { TRunEvent } from '../typedefs/run-events.js'

export type TExitState = Readonly<{ sawFailure: boolean; summarySeen: boolean }>

export const initialExitState: TExitState = {
  sawFailure: false,
  summarySeen: false,
}

/** Pure fold: one event in, the next exit state out. */
export const nextExitState = (
  state: TExitState,
  event: TRunEvent,
): TExitState => {
  if (event.type === 'test' && event.status === 'fail')
    return { ...state, sawFailure: true }
  if (event.type === 'unhandled-error') return { ...state, sawFailure: true }
  if (event.type === 'run-end') {
    return {
      sawFailure:
        state.sawFailure || event.totals.fail > 0 || event.totals.errors > 0,
      summarySeen: event.summarySeen,
    }
  }
  return state
}

/** §1.5.3: 2 when no summary was seen on stdin, 1 when any failure or error was reported, 0 otherwise. */
export const resolveExitCode = (state: TExitState): number => {
  if (!state.summarySeen) return 2
  return state.sawFailure ? 1 : 0
}
