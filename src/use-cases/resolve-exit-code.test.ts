import { expect, test } from 'bun:test'
import type { TRunEvent } from '../typedefs/run-events.js'
import {
  initialExitState,
  nextExitState,
  resolveExitCode,
} from './resolve-exit-code.js'

test(
  [
    'given no events were folded',
    'when resolved',
    'it should exit 2 because no summary was seen',
  ].join(', '),
  () => {
    // given
    // when
    const actual = resolveExitCode(initialExitState)

    // then
    expect(actual).toBe(2)
  },
)

test(
  [
    'given a run-end with a summary and no failures',
    'when resolved',
    'it should exit 0',
  ].join(', '),
  () => {
    // given
    const event: TRunEvent = {
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
    const state = nextExitState(initialExitState, event)
    const actual = resolveExitCode(state)

    // then
    expect(actual).toBe(0)
  },
)

test(
  [
    'given a run-end with a nonzero fail total',
    'when resolved',
    'it should exit 1',
  ].join(', '),
  () => {
    // given
    const event: TRunEvent = {
      type: 'run-end',
      summarySeen: true,
      totals: {
        pass: 1,
        fail: 1,
        skip: 0,
        todo: 0,
        errors: 0,
        expectCalls: 1,
        tests: 2,
        files: 1,
        durationMs: 1,
      },
    }

    // when
    const state = nextExitState(initialExitState, event)
    const actual = resolveExitCode(state)

    // then
    expect(actual).toBe(1)
  },
)

test(
  [
    'given a run-end with a nonzero error total',
    'when resolved',
    'it should exit 1',
  ].join(', '),
  () => {
    // given
    const event: TRunEvent = {
      type: 'run-end',
      summarySeen: true,
      totals: {
        pass: 0,
        fail: 0,
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
    const state = nextExitState(initialExitState, event)
    const actual = resolveExitCode(state)

    // then
    expect(actual).toBe(1)
  },
)

test(
  [
    'given a fail test event seen before the run-end reports zero fails',
    'when resolved',
    'it should still exit 1',
  ].join(', '),
  () => {
    // given
    const failEvent: TRunEvent = {
      type: 'test',
      status: 'fail',
      file: 'a.test.ts',
      name: 'x',
      path: ['x'],
      durationMs: 1,
      diagnostics: [],
    }
    const endEvent: TRunEvent = {
      type: 'run-end',
      summarySeen: true,
      totals: {
        pass: 0,
        fail: 0,
        skip: 0,
        todo: 0,
        errors: 0,
        expectCalls: 0,
        tests: 1,
        files: 1,
        durationMs: 1,
      },
    }

    // when
    const afterFail = nextExitState(initialExitState, failEvent)
    const final = nextExitState(afterFail, endEvent)
    const actual = resolveExitCode(final)

    // then
    expect(actual).toBe(1)
  },
)

test(
  [
    'given an unhandled-error event',
    'when folded',
    'it should mark the state as having seen a failure',
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
    const actual = nextExitState(initialExitState, event)

    // then
    expect(actual.sawFailure).toBe(true)
  },
)

test(
  [
    'given an event with no bearing on exit state',
    'when folded',
    'it should leave the state unchanged',
  ].join(', '),
  () => {
    // given
    const event: TRunEvent = { type: 'file-start', path: 'a.test.ts' }

    // when
    const actual = nextExitState(initialExitState, event)

    // then
    expect(actual).toBe(initialExitState)
  },
)
