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
        coverageReport: 'full',
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
      const defaults = {
        nyan: 'bar',
        markdown: 'markdown',
        block: 'bar',
        agent: 'summary',
      } as const

      expect(actual).toEqual({
        status: 'ok',
        data: {
          mode: 'run',
          reporter,
          colorMode: 'auto',
          coverageThresholdPct: undefined,
          coverageReport: defaults[reporter],
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
        coverageReport: 'full',
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
        coverageReport: 'full',
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
        coverageReport: 'bar',
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
        coverageReport: 'full',
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
        coverageReport: 'full',
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
        coverageReport: 'full',
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

const coverageReportModeCases = [
  'full',
  'failures',
  'summary',
  'bar',
  'markdown',
] as const

for (const mode of coverageReportModeCases) {
  test(
    [
      `given --coverage-report=${mode} with the block reporter`,
      'when parsed',
      'it should resolve to that mode',
    ].join(', '),
    () => {
      // given
      // when
      const actual = parseCliOptions([`--coverage-report=${mode}`, '--block'])

      // then
      expect(actual).toEqual({
        status: 'ok',
        data: {
          mode: 'run',
          reporter: 'block',
          colorMode: 'auto',
          coverageThresholdPct: undefined,
          coverageReport: mode,
        },
      })
    },
  )
}

test(
  [
    'given --coverage-report=diagram',
    'when parsed',
    'it should return a usage error naming the invalid value',
  ].join(', '),
  () => {
    // given
    // when
    const actual = parseCliOptions(['--coverage-report=diagram'])

    // then
    expect(actual).toEqual({
      status: 'error',
      error: "invalid --coverage-report value 'diagram'",
    })
  },
)

test(
  [
    'given a bare --coverage-report with no value',
    'when parsed',
    'it should be the usage error for an invalid, empty value',
  ].join(', '),
  () => {
    // given
    // when
    const actual = parseCliOptions(['--coverage-report'])

    // then
    expect(actual).toEqual({
      status: 'error',
      error: "invalid --coverage-report value ''",
    })
  },
)

const reporterDefaultModeCases = [
  { reporter: 'tap', flag: undefined, mode: 'full' },
  { reporter: 'agent', flag: '--agent', mode: 'summary' },
  { reporter: 'markdown', flag: '--markdown', mode: 'markdown' },
  { reporter: 'nyan', flag: '--nyan', mode: 'bar' },
  { reporter: 'block', flag: '--block', mode: 'bar' },
] as const

for (const { reporter, flag, mode } of reporterDefaultModeCases) {
  test(
    [
      `given the ${reporter} reporter with --coverage-report absent`,
      'when parsed',
      `it should default coverage reporting to ${mode}`,
    ].join(', '),
    () => {
      // given
      const argv = flag === undefined ? [] : [flag]

      // when
      const actual = parseCliOptions(argv)

      // then
      expect(actual.status).toBe('ok')
      expect(
        actual.status === 'ok' &&
          actual.data.mode === 'run' &&
          actual.data.coverageReport,
      ).toBe(mode)
    },
  )
}

test(
  [
    'given an explicit --coverage-report on a non-tap reporter',
    'when parsed',
    "it should override that reporter's default",
  ].join(', '),
  () => {
    // given
    // when
    const actual = parseCliOptions(['--agent', '--coverage-report=bar'])

    // then
    expect(actual.status).toBe('ok')
    expect(
      actual.status === 'ok' &&
        actual.data.mode === 'run' &&
        actual.data.coverageReport,
    ).toBe('bar')
  },
)

test(
  [
    'given --coverage-report=full with the tap reporter',
    'when parsed',
    'it should be accepted',
  ].join(', '),
  () => {
    // given
    // when
    const actual = parseCliOptions(['--coverage-report=full'])

    // then
    expect(actual).toEqual({
      status: 'ok',
      data: {
        mode: 'run',
        reporter: 'tap',
        colorMode: 'auto',
        coverageThresholdPct: undefined,
        coverageReport: 'full',
      },
    })
  },
)

const nonFullModesOnTap = ['failures', 'summary', 'bar', 'markdown'] as const

for (const mode of nonFullModesOnTap) {
  test(
    [
      `given --coverage-report=${mode} with the tap reporter`,
      'when parsed',
      'it should return the tap-pinned usage error',
    ].join(', '),
    () => {
      // given
      // when
      const actual = parseCliOptions([`--coverage-report=${mode}`])

      // then
      expect(actual).toEqual({
        status: 'error',
        error: 'the tap reporter always reports coverage in full',
      })
    },
  )
}
