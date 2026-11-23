import { expect, test } from 'bun:test'
import {
  findUnmatchedFilters,
  resolvePairedArguments,
  toCwdRelative,
} from './resolve-paired-arguments.js'

const files = [
  'src/a.ts',
  'src/a.test.ts',
  'src/a.driver.test.ts',
  'src/lonely.ts',
  'README.md',
]
const deps = {
  cwd: '/fake',
  pathKind: (path: string): 'file' | 'directory' | undefined =>
    files.includes(path) ? 'file' : path === 'src' ? 'directory' : undefined,
  fileExists: (path: string) => files.includes(path),
  listDir: () => files.map((path) => path.replace('src/', '')),
  readTextFile: () => undefined,
}

for (const arg of ['./src/a.ts', '/fake/src/a.ts', 'src/a.ts']) {
  test(
    [
      `given source argument ${arg}`,
      'when resolving paired arguments',
      'it should normalize the source and select the same family without discovery',
    ].join(', '),
    () => {
      // given
      // when
      const actual = resolvePairedArguments(deps)({
        filters: [arg, arg],
        exempt: [],
      })
      // then
      expect(toCwdRelative('/fake')(arg)).toBe('src/a.ts')
      expect(actual).toEqual({
        discoveryFilters: [],
        familyTests: ['src/a.driver.test.ts', 'src/a.test.ts'],
        untested: [],
      })
    },
  )
}

for (const { exempt, toml, untested } of [
  { exempt: [], toml: '', untested: ['./src/lonely.ts'] },
  { exempt: ['**/lonely.ts'], toml: '', untested: [] },
  {
    exempt: [],
    toml: '[test]\ncoveragePathIgnorePatterns = "**/lonely.ts"',
    untested: [],
  },
]) {
  test(
    [
      `given a lonely source with exemptions ${exempt} and ${toml}`,
      'when resolving a mixed selection',
      'it should preserve discovery filters and record only non-exempt sources verbatim',
    ].join(', '),
    () => {
      // given
      const filters = [
        'src/a.test.ts',
        'src',
        'gone.ts',
        'README.md',
        './src/lonely.ts',
        'src/a.ts',
      ]
      // when
      const actual = resolvePairedArguments({
        ...deps,
        readTextFile: () => toml,
      })({ filters, exempt })
      // then
      expect(actual.discoveryFilters).toEqual(filters.slice(0, 4))
      expect(actual.untested).toEqual(untested)
      expect(actual.familyTests).toEqual([
        'src/a.driver.test.ts',
        'src/a.test.ts',
      ])
    },
  )
}

for (const { filters, expected } of [
  {
    filters: [
      './src/',
      '/fake/src/',
      'a.test',
      '../fake/src',
      'SRC',
      'gone.ts',
      'README.md',
    ],
    expected: ['SRC', 'gone.ts', 'README.md'],
  },
  { filters: ['src'], expected: [] },
  { filters: [], expected: [] },
]) {
  test(
    [
      `given filters ${filters}`,
      'when comparing them with discovery paths',
      'it should list unmatched filters using bun substring semantics',
    ].join(', '),
    () => {
      // given
      // when
      const actual = findUnmatchedFilters('/fake')(filters, ['src/a.test.ts'])
      // then
      expect(actual).toEqual(expected)
    },
  )
}
