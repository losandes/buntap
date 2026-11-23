import { expect, test } from 'bun:test'
import { planPairedUnits } from './plan-paired-units.js'

for (const { selected, expected } of [
  { selected: [], expected: [] },
  {
    selected: ['src/a.test.ts'],
    expected: [
      { source: 'src/a.ts', tests: ['src/a.driver.test.ts', 'src/a.test.ts'] },
    ],
  },
  {
    selected: ['src/a.test.ts', 'src/a.driver.test.ts', 'src/a.test.ts'],
    expected: [
      { source: 'src/a.ts', tests: ['src/a.driver.test.ts', 'src/a.test.ts'] },
    ],
  },
  {
    selected: ['src/b.spec.ts', 'src/a.driver.test.ts', 'src/c_test.ts'],
    expected: [
      { source: undefined, tests: ['src/b.spec.ts'] },
      { source: 'src/a.ts', tests: ['src/a.driver.test.ts', 'src/a.test.ts'] },
      { source: undefined, tests: ['src/c_test.ts'] },
    ],
  },
]) {
  test(
    [
      `given selected tests ${selected}`,
      'when planning paired units',
      'it should expand whole families once while preserving unit order',
    ].join(', '),
    () => {
      // given
      const deps = {
        fileExists: (path: string) => path === 'src/a.ts',
        listDir: () => ['a.test.ts', 'a.driver.test.ts'],
      }
      // when
      const actual = planPairedUnits(deps)(selected)
      // then
      expect(actual).toEqual(expected)
    },
  )
}
