import { expect, test } from 'bun:test'
import { formatDuration } from './format-duration.js'

test(
  ['given undefined', 'when formatted', 'it should default to 0.00ms'].join(
    ', ',
  ),
  () => {
    // given
    const input = undefined

    // when
    const actual = formatDuration(input)

    // then
    expect(actual).toBe('0.00ms')
  },
)

test(
  [
    'given a whole number of milliseconds',
    'when formatted',
    'it should still show two decimal places',
  ].join(', '),
  () => {
    // given
    const input = 9

    // when
    const actual = formatDuration(input)

    // then
    expect(actual).toBe('9.00ms')
  },
)

test(
  [
    'given a fractional number of milliseconds',
    'when formatted',
    'it should keep two decimal places',
  ].join(', '),
  () => {
    // given
    const input = 0.115

    // when
    const actual = formatDuration(input)

    // then
    expect(actual).toBe('0.12ms')
  },
)
