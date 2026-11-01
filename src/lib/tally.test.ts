import { expect, test } from 'bun:test'
import type { TRunEvent } from '../typedefs/run-events.js'
import { foldTally, initialTally } from './tally.js'

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
