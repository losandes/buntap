import { expect, test } from 'bun:test'
import { encodeRunnerStart } from '../protocol/encode-protocol-line.js'
import { detectInputMode } from './detect-input-mode.js'

test(
  [
    'given a runner-start protocol line',
    'when the input mode is detected',
    'it should select protocol mode',
  ].join(', '),
  () => {
    // given
    const line = encodeRunnerStart(['src/lib']).trim()

    // when
    const actual = detectInputMode(line)

    // then
    expect(actual).toBe('protocol')
  },
)

test(
  [
    "given bun's banner line",
    'when the input mode is detected',
    'it should select text mode',
  ].join(', '),
  () => {
    // given
    const line = 'bun test v1.3.14 (0d9b296a)'

    // when
    const actual = detectInputMode(line)

    // then
    expect(actual).toBe('text')
  },
)

test(
  [
    'given a line that parses as JSON but carries no v',
    'when the input mode is detected',
    'it should select text mode',
  ].join(', '),
  () => {
    // given
    const line = JSON.stringify({ hello: 'world' })

    // when
    const actual = detectInputMode(line)

    // then
    expect(actual).toBe('text')
  },
)
