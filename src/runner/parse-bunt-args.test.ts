import { expect, test } from 'bun:test'
import { parseBuntArgs } from './parse-bunt-args.js'

for (const argv of [
  [],
  ['--paired-concurrency=0', '--', '-t'],
  ['--paired=true'],
]) {
  test(
    [
      `given no exact paired flag in ${JSON.stringify(argv)}`,
      'when parsing bunt arguments',
      'it should preserve argv without inspection',
    ].join(', '),
    () => {
      // given
      // when
      const actual = parseBuntArgs(argv)
      // then
      expect(actual).toEqual({
        status: 'ok',
        data: { mode: 'passthrough', argv },
      })
    },
  )
}

for (const argv of [['--paired-exempt'], ['--paired-exempt=']]) {
  test(
    [
      `given invalid exemption ${argv}`,
      'when parsing paired arguments',
      'it should reject the missing glob but leave unpaired argv alone',
    ].join(', '),
    () => {
      // given
      // when
      const actual = parseBuntArgs(['--paired', ...argv])
      // then
      expect(actual).toEqual({
        status: 'error',
        error:
          '--paired-exempt requires a glob, e.g. --paired-exempt=**/types.ts',
      })
      expect(parseBuntArgs(argv)).toEqual({
        status: 'ok',
        data: { mode: 'passthrough', argv },
      })
    },
  )
}

for (const exempt of [['**/types.ts'], ['**/types.ts', 'src/fixtures/*']]) {
  test(
    [
      `given exemption globs ${exempt}`,
      'when parsing paired arguments',
      'it should collect globs in order without forwarding them to bun',
    ].join(', '),
    () => {
      // given
      const argv = [
        '--paired',
        'src',
        '--timeout=5',
        ...exempt.map((glob) => `--paired-exempt=${glob}`),
      ]
      // when
      const actual = parseBuntArgs(argv)
      // then
      expect(actual).toEqual({
        status: 'ok',
        data: {
          mode: 'paired',
          argv,
          flags: ['--timeout=5'],
          filters: ['src'],
          exempt,
          concurrency: undefined,
        },
      })
    },
  )
}

for (const value of ['0', '-1', '1.5', 'abc', '', '1e2', '0x10', ' 2', '01']) {
  test(
    [
      `given invalid concurrency ${JSON.stringify(value)}`,
      'when parsing paired arguments',
      'it should return the exact concurrency error',
    ].join(', '),
    () => {
      // given
      const argv = ['--paired', `--paired-concurrency=${value}`]
      // when
      const actual = parseBuntArgs(argv)
      // then
      expect(actual).toEqual({
        status: 'error',
        error: `--paired-concurrency must be a positive integer, got "${value}"`,
      })
    },
  )
}

for (const { args, error } of [
  { args: ['--'], error: '--paired does not support a bare --' },
  {
    args: ['--', '--paired-concurrency=0'],
    error: '--paired does not support a bare --',
  },
  {
    args: ['--paired-concurrency=5', '--paired-concurrency=0'],
    error: '--paired-concurrency must be a positive integer, got "0"',
  },
  ...[
    '-t',
    '--test-name-pattern=x',
    '--test-name-pattern',
    '--test-name-pattern-extra',
  ].map((arg) => ({
    args: [arg],
    error:
      '--paired measures whole test files, so a test name pattern is not supported',
  })),
]) {
  test(
    [
      `given offending arguments ${JSON.stringify(args)}`,
      'when parsing paired arguments',
      'it should return the first usage error exactly',
    ].join(', '),
    () => {
      // given
      // when
      const actual = parseBuntArgs(['--paired', ...args])
      // then
      expect(actual).toEqual({ status: 'error', error })
    },
  )
}

for (const { options, concurrency } of [
  { options: [], concurrency: undefined },
  {
    options: ['--paired-concurrency=2', '--paired-concurrency=5'],
    concurrency: 5,
  },
]) {
  test(
    [
      `given paired flags and concurrency ${concurrency}`,
      'when parsing arguments',
      'it should separate flags and filters and strip coverage output flags',
    ].join(', '),
    () => {
      // given
      const argv = [
        'src/a',
        '--paired',
        '--timeout=100',
        '--coverage',
        '--coverage-reporter=lcov',
        '--coverage-dir=out',
        ...options,
        'src/b',
        '--paired',
      ]
      // when
      const actual = parseBuntArgs(argv)
      // then
      expect(actual).toEqual({
        status: 'ok',
        data: {
          mode: 'paired',
          argv,
          flags: ['--timeout=100'],
          filters: ['src/a', 'src/b'],
          exempt: [],
          concurrency,
        },
      })
    },
  )
}
