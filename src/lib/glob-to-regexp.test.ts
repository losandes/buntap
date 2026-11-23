import { expect, test } from 'bun:test'
import { globToRegExp } from './glob-to-regexp.js'

for (const [glob, path, expected] of [
  ['**/bin.ts', 'bin.ts', true],
  ['**/bin.ts', 'src/bin.ts', true],
  ['src/*.ts', 'src/a.ts', true],
  ['src/*.ts', 'src/a/b.ts', false],
  ['**/*.{ts,tsx}', 'a/b.tsx', true],
  ['**/*.{ts,tsx}', 'a/b.js', false],
  ['src/m/x.ts', 'src/m/x.ts', true],
  ['src/m/x.ts', 'src/m/xx.ts', false],
  ['**/calc*.ts', 'src/calculator.ts', true],
  ['./src/?.ts', 'src/a.ts', true],
  ['src/?.ts', 'src/ab.ts', false],
  ['a/**', 'a/b/c', true],
  ['[x]+(a).ts', '[x]+(a).ts', true],
  ['{unfinished', '{unfinished', true],
  ['', '', true],
] as const) {
  test(
    [
      `given glob ${glob} and path ${path}`,
      'when matching the supported glob syntax',
      `it should return ${expected}`,
    ].join(', '),
    () => {
      // given
      // when
      const actual = globToRegExp(glob).test(path)
      // then
      expect(actual).toBe(expected)
    },
  )
}
