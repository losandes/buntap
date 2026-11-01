import type { TRunEvent } from '../typedefs/run-events.js'

export type TTally = Readonly<{
  total: number
  pass: number
  fail: number
  skip: number
  todo: number
}>

export const initialTally: TTally = {
  total: 0,
  pass: 0,
  fail: 0,
  skip: 0,
  todo: 0,
}

/** Pure fold: one event in, the next tally out. Reporters use this to track running totals without a `let`. */
export const foldTally = (tally: TTally, event: TRunEvent): TTally => {
  if (event.type === 'test') {
    return {
      ...tally,
      total: tally.total + 1,
      [event.status]: tally[event.status] + 1,
    }
  }
  if (event.type === 'unhandled-error') {
    return { ...tally, total: tally.total + 1, fail: tally.fail + 1 }
  }
  return tally
}
