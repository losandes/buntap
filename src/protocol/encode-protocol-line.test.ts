import { expect, test } from 'bun:test'
import type { TRunEvent } from '../typedefs/run-events.js'
import {
  encodeRunEvent,
  encodeRunnerExit,
  encodeRunnerStart,
} from './encode-protocol-line.js'

test(
  [
    'given an argv',
    'when encoded as a runner-start line',
    'it should be one newline-terminated JSON object carrying v:1',
  ].join(', '),
  () => {
    // given
    const argv = ['src/lib', '--coverage']

    // when
    const actual = encodeRunnerStart(argv)

    // then
    expect(actual.endsWith('\n')).toBe(true)
    expect(JSON.parse(actual)).toEqual({
      v: 1,
      type: 'runner-start',
      argv,
    })
  },
)

test(
  [
    'given a code and a null signal',
    'when encoded as a runner-exit line',
    'it should carry both fields verbatim',
  ].join(', '),
  () => {
    // given
    // when
    const actual = encodeRunnerExit(1, null)

    // then
    expect(JSON.parse(actual)).toEqual({
      v: 1,
      type: 'runner-exit',
      code: 1,
      signal: null,
    })
  },
)

test(
  [
    'given a null code and a signal name',
    'when encoded as a runner-exit line',
    'it should carry both fields verbatim',
  ].join(', '),
  () => {
    // given
    // when
    const actual = encodeRunnerExit(null, 'SIGINT')

    // then
    expect(JSON.parse(actual)).toEqual({
      v: 1,
      type: 'runner-exit',
      code: null,
      signal: 'SIGINT',
    })
  },
)

test(
  [
    'given a run event the parser already produces',
    'when encoded',
    'it should preserve the event shape unchanged and add only v',
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
    const actual = encodeRunEvent(event)

    // then
    expect(JSON.parse(actual)).toEqual({ v: 1, ...event })
  },
)

test(
  [
    'given console output in a test diagnostic',
    'when encoded',
    'it should cross as a JSON string, not bare text',
  ].join(', '),
  () => {
    // given
    const event: TRunEvent = {
      type: 'test',
      status: 'fail',
      file: 'a.test.ts',
      name: 'it fails',
      path: ['it fails'],
      durationMs: 1,
      diagnostics: ['(fail) looks like a result line but is not one'],
    }

    // when
    const line = encodeRunEvent(event)
    const decoded = JSON.parse(line)

    // then
    expect(Array.isArray(decoded.diagnostics)).toBe(true)
    expect(decoded.diagnostics[0]).toBe(
      '(fail) looks like a result line but is not one',
    )
  },
)
