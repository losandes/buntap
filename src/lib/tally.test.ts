import { expect, test } from 'bun:test'
import {
  failRollupFixture,
  skipTodoRollupFixture,
} from '../parse/bun-output.fixture.js'
import { parseRun } from '../parse/parse-run.js'
import type { TRunEvent } from '../typedefs/run-events.js'
import { foldTally, initialTally } from './tally.js'

const linesOf = (text: string): AsyncIterable<string> => ({
  [Symbol.asyncIterator]: () => {
    const iterator = text.split('\n').slice(0, -1)[Symbol.iterator]()
    return { next: () => Promise.resolve(iterator.next()) }
  },
})

test(
  [
    'given a pass event',
    'when folded into the tally',
    'it should increment total and pass',
  ].join(', '),
  () => {
    // given
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
    const actual = foldTally(initialTally, event)

    // then
    expect(actual).toEqual({ total: 1, pass: 1, fail: 0, skip: 0, todo: 0 })
  },
)

test(
  [
    'given a fail event',
    'when folded into the tally',
    'it should increment total and fail',
  ].join(', '),
  () => {
    // given
    const event: TRunEvent = {
      type: 'test',
      status: 'fail',
      file: 'a.test.ts',
      name: 'it breaks',
      path: ['it breaks'],
      durationMs: 1,
      diagnostics: [],
    }

    // when
    const actual = foldTally(initialTally, event)

    // then
    expect(actual).toEqual({ total: 1, pass: 0, fail: 1, skip: 0, todo: 0 })
  },
)

test(
  [
    'given an unhandled-error event',
    'when folded into the tally',
    'it should count as a failure',
  ].join(', '),
  () => {
    // given
    const event: TRunEvent = {
      type: 'unhandled-error',
      file: 'a.test.ts',
      message: 'boom',
      diagnostics: [],
    }

    // when
    const actual = foldTally(initialTally, event)

    // then
    expect(actual).toEqual({ total: 1, pass: 0, fail: 1, skip: 0, todo: 0 })
  },
)

test(
  [
    'given an event with no bearing on the tally',
    'when folded',
    'it should leave the tally unchanged',
  ].join(', '),
  () => {
    // given
    const event: TRunEvent = { type: 'file-start', path: 'a.test.ts' }

    // when
    const actual = foldTally(initialTally, event)

    // then
    expect(actual).toBe(initialTally)
  },
)

test(
  [
    // @1.3.1
    "given a fixture where bun reprints skipped/todo results in a trailing roll-up ('N tests skipped:'/'N tests todo:')",
    'when its events are folded into the tally end to end via parseRun',
    "it should reach a running total equal to the run-end's own totals.tests",
  ].join(', '),
  async () => {
    // given
    let events: readonly TRunEvent[] = []
    for await (const event of parseRun(linesOf(skipTodoRollupFixture))) {
      events = [...events, event]
    }
    const runEnd = events.find(
      (event): event is Extract<TRunEvent, { type: 'run-end' }> =>
        event.type === 'run-end',
    )

    // when
    const tally = events.reduce(foldTally, initialTally)

    // then
    expect(runEnd?.totals.tests).toBeDefined()
    expect(tally.total).toBe(runEnd?.totals.tests ?? -1)
  },
)

test(
  [
    // @1.3.1
    "given a fixture where bun reprints a failed result in a trailing roll-up ('1 tests failed:')",
    'when its events are folded into the tally end to end via parseRun',
    "it should reach a running total equal to the run-end's own totals.tests, not double-counted",
  ].join(', '),
  async () => {
    // given
    let events: readonly TRunEvent[] = []
    for await (const event of parseRun(linesOf(failRollupFixture))) {
      events = [...events, event]
    }
    const runEnd = events.find(
      (event): event is Extract<TRunEvent, { type: 'run-end' }> =>
        event.type === 'run-end',
    )

    // when
    const tally = events.reduce(foldTally, initialTally)

    // then
    expect(runEnd?.totals.tests).toBeDefined()
    expect(tally.total).toBe(runEnd?.totals.tests ?? -1)
    expect(tally.fail).toBe(1)
  },
)
