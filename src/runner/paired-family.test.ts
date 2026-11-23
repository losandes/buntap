import { expect, test } from 'bun:test'
import {
  isSourceFileName,
  isTestFileName,
  listFamily,
  toOwnerSource,
} from './paired-family.js'

for (const [path, source, isTest] of [
  ['a.ts', true, false],
  ['a.tsx', true, false],
  ['a.mjs', true, false],
  ['a.test.ts', false, true],
  ['a.spec.ts', false, true],
  ['a_test.js', false, true],
  ['README.md', false, false],
] as const) {
  test(
    [
      `given path ${path}`,
      'when classifying file names',
      'it should distinguish sources and tests',
    ].join(', '),
    () => {
      // given
      // when
      const actual = [isSourceFileName(path), isTestFileName(path)]
      // then
      expect(actual).toEqual([source, isTest])
    },
  )
}

for (const { path, files, expected } of [
  { path: 'src/calc.test.ts', files: ['src/calc.ts'], expected: 'src/calc.ts' },
  {
    path: 'src/calc.driver.test.ts',
    files: ['src/calc.ts'],
    expected: 'src/calc.ts',
  },
  {
    path: 'src/calc.driver.test.ts',
    files: ['src/calc.ts', 'src/calc.driver.ts'],
    expected: 'src/calc.driver.ts',
  },
  { path: 'src/calc.test.ts', files: [], expected: undefined },
  { path: 'src/calc.spec.ts', files: ['src/calc.ts'], expected: undefined },
  {
    path: 'src/x.test.driver.test.ts',
    files: ['src/x.test.ts'],
    expected: undefined,
  },
  { path: 'calc..test.ts', files: ['calc.ts'], expected: undefined },
  { path: 'x.driver.test.ts', files: [], expected: undefined },
]) {
  test(
    [
      `given test ${path} beside ${files}`,
      'when finding its owner',
      'it should prefer an exact source and otherwise use one variant segment',
    ].join(', '),
    () => {
      // given
      // when
      const actual = toOwnerSource((file) => files.includes(file))(path)
      // then
      expect(actual).toBe(expected)
    },
  )
}

for (const { source, files, expected } of [
  {
    source: 'src/calc.ts',
    files: ['src/calc.ts'],
    expected: ['src/calc.driver.test.ts', 'src/calc.test.ts'],
  },
  {
    source: 'src/calc.ts',
    files: ['src/calc.ts', 'src/calc.driver.ts'],
    expected: ['src/calc.test.ts'],
  },
  { source: 'src/calc.tsx', files: ['src/calc.tsx'], expected: [] },
  {
    source: 'calc.ts',
    files: ['calc.ts'],
    expected: ['calc.driver.test.ts', 'calc.test.ts'],
  },
]) {
  test(
    [
      `given source ${source} beside ${files}`,
      'when listing its family',
      'it should select sorted same-extension tests with that owner only',
    ].join(', '),
    () => {
      // given
      const deps = {
        fileExists: (file: string) => files.includes(file),
        listDir: () => [
          'calculator.test.ts',
          'calc.test.ts',
          'calc.driver.test.ts',
          'calc.a.b.test.ts',
          'calc.spec.ts',
          'calc.ts',
        ],
      }
      // when
      const actual = listFamily(deps)(source)
      // then
      expect(actual).toEqual(expected)
    },
  )
}
