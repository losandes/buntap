import { expect, test } from 'bun:test'
import { parseCliOptions } from './parse-cli-options.js'

test(
  [
    'given no flags',
    'when parsed',
    'it should default to the tap reporter with auto colour',
  ].join(', '),
  () => {
    // given
    const argv: readonly string[] = []

    // when
    const actual = parseCliOptions(argv)

    // then
    expect(actual).toEqual({
      status: 'ok',
      data: {
        mode: 'run',
        reporter: 'tap',
        colorMode: 'auto',
        coverageThresholdPct: undefined,
      },
    })
  },
)

const reporterFlagCases = [
  { flag: '--nyan', reporter: 'nyan' },
  { flag: '--markdown', reporter: 'markdown' },
  { flag: '--block', reporter: 'block' },
  { flag: '--agent', reporter: 'agent' },
] as const

for (const { flag, reporter } of reporterFlagCases) {
  test(
    [
      `given the flag ${flag}`,
      'when parsed',
      `it should select the ${reporter} reporter`,
    ].join(', '),
    () => {
      // given
      // when
      const actual = parseCliOptions([flag])

      // then
      expect(actual).toEqual({
        status: 'ok',
        data: {
          mode: 'run',
          reporter,
          colorMode: 'auto',
          coverageThresholdPct: undefined,
        },
      })
    },
  )
}

test(
  ['given --color', 'when parsed', 'it should force colour on'].join(', '),
  () => {
    // given
    // when
    const actual = parseCliOptions(['--color'])

    // then
    expect(actual).toEqual({
      status: 'ok',
      data: {
        mode: 'run',
        reporter: 'tap',
        colorMode: 'on',
        coverageThresholdPct: undefined,
      },
    })
  },
)

test(
  ['given --no-color', 'when parsed', 'it should force colour off'].join(', '),
  () => {
    // given
    // when
    const actual = parseCliOptions(['--no-color'])

    // then
    expect(actual).toEqual({
      status: 'ok',
      data: {
        mode: 'run',
        reporter: 'tap',
        colorMode: 'off',
        coverageThresholdPct: undefined,
      },
    })
  },
)

test(
  ['given --help', 'when parsed', 'it should return help mode'].join(', '),
  () => {
    // given
    // when
    const actual = parseCliOptions(['--help'])

    // then
    expect(actual).toEqual({ status: 'ok', data: { mode: 'help' } })
  },
)

test(
  ['given --version', 'when parsed', 'it should return version mode'].join(
    ', ',
  ),
  () => {
    // given
    // when
    const actual = parseCliOptions(['--version'])

    // then
    expect(actual).toEqual({ status: 'ok', data: { mode: 'version' } })
  },
)

test(
  [
    'given two reporter flags together',
    'when parsed',
    'it should return an error settlement',
  ].join(', '),
  () => {
    // given
    // when
    const actual = parseCliOptions(['--nyan', '--markdown'])

    // then
    expect(actual).toEqual({
      status: 'error',
      error: 'only one reporter flag may be given',
    })
  },
)

test(
  [
    'given the same reporter flag twice',
    'when parsed',
    'it should not treat it as a conflict',
  ].join(', '),
  () => {
    // given
    // when
    const actual = parseCliOptions(['--nyan', '--nyan'])

    // then
    expect(actual).toEqual({
      status: 'ok',
      data: {
        mode: 'run',
        reporter: 'nyan',
        colorMode: 'auto',
        coverageThresholdPct: undefined,
      },
    })
  },
)

test(
  [
    'given an unknown flag',
    'when parsed',
    'it should return an error settlement naming it',
  ].join(', '),
  () => {
    // given
    // when
    const actual = parseCliOptions(['--wat'])

    // then
    expect(actual).toEqual({ status: 'error', error: "unknown flag '--wat'" })
  },
)

test(
  [
    'given --coverage-threshold=95',
    'when parsed',
    'it should resolve to 95/95',
  ].join(', '),
  () => {
    // given
    // when
    const actual = parseCliOptions(['--coverage-threshold=95'])

    // then
    expect(actual).toEqual({
      status: 'ok',
      data: {
        mode: 'run',
        reporter: 'tap',
        colorMode: 'auto',
        coverageThresholdPct: { functionsPct: 95, linesPct: 95 },
      },
    })
  },
)

test(
  [
    'given --coverage-threshold=0.95',
    'when parsed',
    'it should resolve to the same 95/95 as the percentage form',
  ].join(', '),
  () => {
    // given
    // when
    const actual = parseCliOptions(['--coverage-threshold=0.95'])

    // then
    expect(actual).toEqual({
      status: 'ok',
      data: {
        mode: 'run',
        reporter: 'tap',
        colorMode: 'auto',
        coverageThresholdPct: { functionsPct: 95, linesPct: 95 },
      },
    })
  },
)

test(
  [
    'given --coverage-threshold=1',
    'when parsed',
    'it should resolve to 100/100',
  ].join(', '),
  () => {
    // given
    // when
    const actual = parseCliOptions(['--coverage-threshold=1'])

    // then
    expect(actual).toEqual({
      status: 'ok',
      data: {
        mode: 'run',
        reporter: 'tap',
        colorMode: 'auto',
        coverageThresholdPct: { functionsPct: 100, linesPct: 100 },
      },
    })
  },
)

const invalidThresholdCases = ['101', '-1', 'abc']

for (const raw of invalidThresholdCases) {
  test(
    [
      `given --coverage-threshold=${raw}`,
      'when parsed',
      'it should return a usage error',
    ].join(', '),
    () => {
      // given
      // when
      const actual = parseCliOptions([`--coverage-threshold=${raw}`])

      // then
      expect(actual.status).toBe('error')
    },
  )
}

test(
  [
    'given a bare --coverage-threshold with no value',
    'when parsed',
    'it should remain an unknown flag',
  ].join(', '),
  () => {
    // given
    // when
    const actual = parseCliOptions(['--coverage-threshold'])

    // then
    expect(actual).toEqual({
      status: 'error',
      error: "unknown flag '--coverage-threshold'",
    })
  },
)
