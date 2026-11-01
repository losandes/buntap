import { expect, test } from 'bun:test'
import { parseBunfigThreshold } from './parse-bunfig-threshold.js'

test(
  [
    'given [test] with no coverageThreshold',
    'when parsed',
    'it should resolve to no gate',
  ].join(', '),
  () => {
    // given
    const toml = '[test]\nroot = "./src"\n'

    // when
    const actual = parseBunfigThreshold(toml)

    // then
    expect(actual).toEqual({ status: 'ok', data: undefined })
  },
)

test(
  [
    'given a scalar coverageThreshold of 0.95',
    'when parsed',
    'it should apply to both metrics',
  ].join(', '),
  () => {
    // given
    const toml = '[test]\ncoverageThreshold = 0.95\n'

    // when
    const actual = parseBunfigThreshold(toml)

    // then
    expect(actual).toEqual({
      status: 'ok',
      data: { functionsPct: 95, linesPct: 95 },
    })
  },
)

test(
  [
    'given an inline table with lines and functions',
    'when parsed',
    'it should read each metric independently',
  ].join(', '),
  () => {
    // given
    const toml =
      '[test]\ncoverageThreshold = { lines = 0.9, functions = 0.8 }\n'

    // when
    const actual = parseBunfigThreshold(toml)

    // then
    expect(actual).toEqual({
      status: 'ok',
      data: { functionsPct: 80, linesPct: 90 },
    })
  },
)

test(
  [
    'given an inline table with only lines',
    'when parsed',
    'it should default functions to 100',
  ].join(', '),
  () => {
    // given
    const toml = '[test]\ncoverageThreshold = { lines = 0.9 }\n'

    // when
    const actual = parseBunfigThreshold(toml)

    // then
    expect(actual).toEqual({
      status: 'ok',
      data: { functionsPct: 100, linesPct: 90 },
    })
  },
)

test(
  [
    'given an inline table with only functions',
    'when parsed',
    'it should default lines to 100',
  ].join(', '),
  () => {
    // given
    const toml = '[test]\ncoverageThreshold = { functions = 0.8 }\n'

    // when
    const actual = parseBunfigThreshold(toml)

    // then
    expect(actual).toEqual({
      status: 'ok',
      data: { functionsPct: 80, linesPct: 100 },
    })
  },
)

test(
  [
    'given an inline table with only statements',
    'when parsed',
    'it should activate the gate at 100/100 even though statements is never evaluated',
  ].join(', '),
  () => {
    // given
    const toml = '[test]\ncoverageThreshold = { statements = 0.9 }\n'

    // when
    const actual = parseBunfigThreshold(toml)

    // then
    expect(actual).toEqual({
      status: 'ok',
      data: { functionsPct: 100, linesPct: 100 },
    })
  },
)

test(
  [
    'given an inline table using singular keys only',
    'when parsed',
    'it should resolve to no gate',
  ].join(', '),
  () => {
    // given
    const toml = '[test]\ncoverageThreshold = { line = 0.9 }\n'

    // when
    const actual = parseBunfigThreshold(toml)

    // then
    expect(actual).toEqual({ status: 'ok', data: undefined })
  },
)

test(
  [
    'given an empty inline table',
    'when parsed',
    'it should resolve to no gate',
  ].join(', '),
  () => {
    // given
    const toml = '[test]\ncoverageThreshold = { }\n'

    // when
    const actual = parseBunfigThreshold(toml)

    // then
    expect(actual).toEqual({ status: 'ok', data: undefined })
  },
)

test(
  [
    'given a coverageThreshold that is a string literal',
    'when parsed',
    'it should resolve to an error settlement',
  ].join(', '),
  () => {
    // given
    const toml = '[test]\ncoverageThreshold = "high"\n'

    // when
    const actual = parseBunfigThreshold(toml)

    // then
    expect(actual.status).toBe('error')
  },
)

test(
  [
    'given a coverageThreshold that is an array',
    'when parsed',
    'it should resolve to an error settlement',
  ].join(', '),
  () => {
    // given
    const toml = '[test]\ncoverageThreshold = [0.9, 0.8]\n'

    // when
    const actual = parseBunfigThreshold(toml)

    // then
    expect(actual.status).toBe('error')
  },
)

test(
  [
    "given this repository's own bunfig line with a trailing example comment",
    'when parsed',
    'it should strip the comment and resolve to 95/95',
  ].join(', '),
  () => {
    // given
    const toml =
      '[test]\ncoverageThreshold = 0.95 # { line = 0.7, function = 0.8, statement = 0.9 }\n'

    // when
    const actual = parseBunfigThreshold(toml)

    // then
    expect(actual).toEqual({
      status: 'ok',
      data: { functionsPct: 95, linesPct: 95 },
    })
  },
)

test(
  [
    'given a coverageThreshold under a section other than [test]',
    'when parsed',
    'it should be ignored',
  ].join(', '),
  () => {
    // given
    const toml = '[build]\ncoverageThreshold = 0.95\n'

    // when
    const actual = parseBunfigThreshold(toml)

    // then
    expect(actual).toEqual({ status: 'ok', data: undefined })
  },
)
