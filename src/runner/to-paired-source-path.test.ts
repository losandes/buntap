import { expect, test } from 'bun:test'
import { toPairedSourcePath } from './to-paired-source-path.js'

for (const [input, expected] of [
  ['src/x.test.ts', 'src/x.ts'],
  ['src/x.test.tsx', 'src/x.tsx'],
  ['src/x.test.js', 'src/x.js'],
  ['src/x.spec.ts', undefined],
  ['src/x_test.ts', undefined],
  ['src/x.ts', undefined],
  ['a.test.ts/x.ts', undefined],
  ['a.test.ts/x.test.ts', 'a.test.ts/x.ts'],
  ['x.test.', undefined],
]) {
  test(
    [
      `given test path ${input}`,
      'when finding its paired source',
      `it should return ${expected}`,
    ].join(', '),
    () => {
      // given
      // when
      const actual = toPairedSourcePath(input ?? '')
      // then
      expect(actual).toBe(expected)
    },
  )
}
