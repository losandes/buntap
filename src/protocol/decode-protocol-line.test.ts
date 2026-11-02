import { expect, test } from 'bun:test'
import { decodeProtocolLine } from './decode-protocol-line.js'
import {
  encodeRunEvent,
  encodeRunnerExit,
  encodeRunnerStart,
} from './encode-protocol-line.js'

test(
  [
    'given a line encodeRunnerStart produced',
    'when decoded',
    'it should round-trip to the same event',
  ].join(', '),
  () => {
    // given
    const line = encodeRunnerStart(['src/lib'])

    // when
    const actual = decodeProtocolLine(line)

    // then
    expect(actual).toEqual({
      status: 'ok',
      data: { v: 1, type: 'runner-start', argv: ['src/lib'] },
    })
  },
)

test(
  [
    'given a line encodeRunnerExit produced',
    'when decoded',
    'it should round-trip to the same event',
  ].join(', '),
  () => {
    // given
    const line = encodeRunnerExit(1, null)

    // when
    const actual = decodeProtocolLine(line)

    // then
    expect(actual).toEqual({
      status: 'ok',
      data: { v: 1, type: 'runner-exit', code: 1, signal: null },
    })
  },
)

test(
  [
    'given a line encodeRunEvent produced for a test result',
    'when decoded',
    'it should round-trip to the same event',
  ].join(', '),
  () => {
    // given
    const line = encodeRunEvent({
      type: 'test',
      status: 'pass',
      file: 'a.test.ts',
      name: 'it works',
      path: ['it works'],
      durationMs: 1,
      diagnostics: [],
    })

    // when
    const actual = decodeProtocolLine(line)

    // then
    expect(actual.status).toBe('ok')
    expect(actual.status === 'ok' && actual.data.type).toBe('test')
  },
)

test(
  ['given invalid JSON', 'when decoded', 'it should return an error'].join(
    ', ',
  ),
  () => {
    // given
    const line = 'not json'

    // when
    const actual = decodeProtocolLine(line)

    // then
    expect(actual.status).toBe('error')
  },
)

test(
  [
    'given raw bun text that happens to be on a line',
    'when decoded',
    'it should return an error rather than throw',
  ].join(', '),
  () => {
    // given
    const line = 'bun test v1.3.14 (0d9b296a)'

    // when
    const actual = decodeProtocolLine(line)

    // then
    expect(actual.status).toBe('error')
  },
)

test(
  [
    'given a JSON object with no v field',
    'when decoded',
    'it should return an error',
  ].join(', '),
  () => {
    // given
    const line = JSON.stringify({ type: 'run-start', version: '1.3.x' })

    // when
    const actual = decodeProtocolLine(line)

    // then
    expect(actual.status).toBe('error')
  },
)

test(
  [
    'given a v the reader does not recognise',
    'when decoded',
    'it should refuse the line rather than guess',
  ].join(', '),
  () => {
    // given
    const line = JSON.stringify({ v: 2, type: 'run-start' })

    // when
    const actual = decodeProtocolLine(line)

    // then
    expect(actual.status).toBe('error')
  },
)

test(
  [
    'given v:1 but a type this build does not know',
    'when decoded',
    'it should return an error',
  ].join(', '),
  () => {
    // given
    const line = JSON.stringify({ v: 1, type: 'something-new' })

    // when
    const actual = decodeProtocolLine(line)

    // then
    expect(actual.status).toBe('error')
  },
)

test(
  [
    'given v:1 and a recognised type missing a required field',
    'when decoded',
    'it should return an error rather than a malformed event',
  ].join(', '),
  () => {
    // given
    const line = JSON.stringify({ v: 1, type: 'file-start' })

    // when
    const actual = decodeProtocolLine(line)

    // then
    expect(actual.status).toBe('error')
  },
)

test(
  [
    'given a line encodeRunEvent produced for run-start',
    'when decoded',
    'it should round-trip to the same event',
  ].join(', '),
  () => {
    // given
    const line = encodeRunEvent({
      type: 'run-start',
      version: '1.3.x',
      revision: '0d9b296a',
    })

    // when
    const actual = decodeProtocolLine(line)

    // then
    expect(actual.status).toBe('ok')
    expect(actual.status === 'ok' && actual.data.type).toBe('run-start')
  },
)

test(
  [
    'given a line encodeRunEvent produced for file-start',
    'when decoded',
    'it should round-trip to the same event',
  ].join(', '),
  () => {
    // given
    const line = encodeRunEvent({ type: 'file-start', path: 'a.test.ts' })

    // when
    const actual = decodeProtocolLine(line)

    // then
    expect(actual.status).toBe('ok')
    expect(actual.status === 'ok' && actual.data.type).toBe('file-start')
  },
)

test(
  [
    'given a line encodeRunEvent produced for unhandled-error',
    'when decoded',
    'it should round-trip to the same event',
  ].join(', '),
  () => {
    // given
    const line = encodeRunEvent({
      type: 'unhandled-error',
      file: 'a.test.ts',
      message: 'boom',
      diagnostics: ['boom'],
    })

    // when
    const actual = decodeProtocolLine(line)

    // then
    expect(actual.status).toBe('ok')
    expect(actual.status === 'ok' && actual.data.type).toBe('unhandled-error')
  },
)

test(
  [
    'given a line encodeRunEvent produced for passthrough',
    'when decoded',
    'it should round-trip to the same event',
  ].join(', '),
  () => {
    // given
    const line = encodeRunEvent({
      type: 'passthrough',
      kind: 'coverage',
      lines: ['-----|'],
    })

    // when
    const actual = decodeProtocolLine(line)

    // then
    expect(actual.status).toBe('ok')
    expect(actual.status === 'ok' && actual.data.type).toBe('passthrough')
  },
)

test(
  [
    'given a line encodeRunEvent produced for run-end',
    'when decoded',
    'it should round-trip to the same event',
  ].join(', '),
  () => {
    // given
    const line = encodeRunEvent({
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
    })

    // when
    const actual = decodeProtocolLine(line)

    // then
    expect(actual.status).toBe('ok')
    expect(actual.status === 'ok' && actual.data.type).toBe('run-end')
  },
)

test(
  [
    'given a line encodeRunEvent produced for coverage-gate-failed',
    'when decoded',
    'it should round-trip to the same event',
  ].join(', '),
  () => {
    // given
    const line = encodeRunEvent({
      type: 'coverage-gate-failed',
      thresholdPct: { functionsPct: 95, linesPct: 95 },
      failing: [{ file: 'src/add.ts', functionsPct: 25, linesPct: 100 }],
    })

    // when
    const actual = decodeProtocolLine(line)

    // then
    expect(actual.status).toBe('ok')
    expect(actual.status === 'ok' && actual.data.type).toBe(
      'coverage-gate-failed',
    )
  },
)

test(
  [
    'given v:1 and a run-end whose totals field is not an object',
    'when decoded',
    'it should return an error',
  ].join(', '),
  () => {
    // given
    const line = JSON.stringify({
      v: 1,
      type: 'run-end',
      totals: 'not an object',
      summarySeen: true,
    })

    // when
    const actual = decodeProtocolLine(line)

    // then
    expect(actual.status).toBe('error')
  },
)

test(
  [
    'given v:1 and a coverage-gate-failed whose failing rows are malformed',
    'when decoded',
    'it should return an error',
  ].join(', '),
  () => {
    // given
    const line = JSON.stringify({
      v: 1,
      type: 'coverage-gate-failed',
      thresholdPct: { functionsPct: 95, linesPct: 95 },
      failing: [{ file: 123, functionsPct: 25, linesPct: 100 }],
    })

    // when
    const actual = decodeProtocolLine(line)

    // then
    expect(actual.status).toBe('error')
  },
)

test(
  [
    'given v:1 with a type field that is not a string',
    'when decoded',
    'it should return an error rather than inspect the shape',
  ].join(', '),
  () => {
    // given
    const line = JSON.stringify({ v: 1, type: 42 })

    // when
    const actual = decodeProtocolLine(line)

    // then
    expect(actual.status).toBe('error')
  },
)
