import { expect, test } from 'bun:test'
import { toThresholdPct } from './to-threshold-pct.js'

test(
  [
    'given a fraction between 0 and 1',
    'when converted',
    'it should scale to a percentage',
  ].join(', '),
  () => {
    // given
    const value = 0.95

    // when
    const actual = toThresholdPct(value)

    // then
    expect(actual).toBe(95)
  },
)

test(
  [
    'given 1',
    'when converted',
    'it should resolve to 100 because 1 means 100% in bunfig',
  ].join(', '),
  () => {
    // given
    const value = 1

    // when
    const actual = toThresholdPct(value)

    // then
    expect(actual).toBe(100)
  },
)

test(
  [
    'given a value already expressed as a percentage',
    'when converted',
    'it should pass through unchanged',
  ].join(', '),
  () => {
    // given
    const value = 95

    // when
    const actual = toThresholdPct(value)

    // then
    expect(actual).toBe(95)
  },
)

test(
  [
    'given a value above 100',
    'when converted',
    'it should resolve to undefined',
  ].join(', '),
  () => {
    // given
    const value = 101

    // when
    const actual = toThresholdPct(value)

    // then
    expect(actual).toBeUndefined()
  },
)

test(
  [
    'given a negative value',
    'when converted',
    'it should resolve to undefined',
  ].join(', '),
  () => {
    // given
    const value = -1

    // when
    const actual = toThresholdPct(value)

    // then
    expect(actual).toBeUndefined()
  },
)

test(
  [
    'given a non-finite value',
    'when converted',
    'it should resolve to undefined',
  ].join(', '),
  () => {
    // given
    const value = Number.NaN

    // when
    const actual = toThresholdPct(value)

    // then
    expect(actual).toBeUndefined()
  },
)
