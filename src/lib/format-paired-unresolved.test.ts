import { expect, test } from 'bun:test'
import { formatPairedUnresolved } from './format-paired-unresolved.js'

for (const { untested, unmatched, expected } of [
  { untested: [], unmatched: [], expected: '' },
  {
    untested: ['src/a.ts'],
    unmatched: [],
    expected: '\nbuntap: 1 source has no tests:\n  src/a.ts\n',
  },
  {
    untested: [],
    unmatched: ['gone', 'README.md'],
    expected: '\nbuntap: 2 arguments matched no tests:\n  gone\n  README.md\n',
  },
  {
    untested: ['src/a.ts', 'src/b.ts'],
    unmatched: ['src/gone.ts'],
    expected:
      '\nbuntap: 2 sources have no tests:\n  src/a.ts\n  src/b.ts\nbuntap: 1 argument matched no tests:\n  src/gone.ts\n',
  },
]) {
  test(
    [
      `given unresolved lists ${JSON.stringify([untested, unmatched])}`,
      'when formatting the notice',
      'it should render exact blocks with singular and plural grammar',
    ].join(', '),
    () => {
      // given
      // when
      const actual = formatPairedUnresolved(untested, unmatched)
      // then
      expect(actual).toBe(expected)
    },
  )
}
