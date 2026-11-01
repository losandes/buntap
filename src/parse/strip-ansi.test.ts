import { expect, test } from 'bun:test'
import { stripAnsi } from './strip-ansi.js'

test(
  [
    'given a line with no escape codes',
    'when stripped',
    'it should return it unchanged',
  ].join(', '),
  () => {
    // given
    const input = '(pass) top level [0.04ms]'

    // when
    const actual = stripAnsi(input)

    // then
    expect(actual).toBe(input)
  },
)

test(
  [
    'given a line wrapped in a colour code',
    'when stripped',
    'it should remove the escape sequences',
  ].join(', '),
  () => {
    // given
    const input = '\u001b[32m(pass)\u001b[0m top level'

    // when
    const actual = stripAnsi(input)

    // then
    expect(actual).toBe('(pass) top level')
  },
)

test(
  [
    'given a cursor-movement sequence',
    'when stripped',
    'it should remove it too',
  ].join(', '),
  () => {
    // given
    const input = '\u001b[4A rainbow'

    // when
    const actual = stripAnsi(input)

    // then
    expect(actual).toBe(' rainbow')
  },
)
