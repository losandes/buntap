import { expect, test } from 'bun:test'
import { signalToNumber } from './signal-to-number.js'

test(
  [
    'given SIGINT',
    'when converted to a number',
    'it should return the POSIX signal number 2',
  ].join(', '),
  () => {
    // given
    // when
    const actual = signalToNumber('SIGINT')

    // then
    expect(actual).toBe(2)
  },
)

test(
  [
    'given SIGTERM',
    'when converted to a number',
    'it should return the POSIX signal number 15',
  ].join(', '),
  () => {
    // given
    // when
    const actual = signalToNumber('SIGTERM')

    // then
    expect(actual).toBe(15)
  },
)

test(
  [
    'given a name that is not a known signal',
    'when converted to a number',
    'it should return undefined',
  ].join(', '),
  () => {
    // given
    // when
    const actual = signalToNumber('NOT_A_SIGNAL')

    // then
    expect(actual).toBeUndefined()
  },
)
