import { expect, test } from 'bun:test'
import { parseDiscoveredFiles } from './parse-discovered-files.js'

// Verbatim bun 1.4.4 discovery captures from the reviewed plan.
const normal = `bun test v1.4.4 (38afee6c8)

src/add.test.ts:

src/lonely.test.ts:

error: regex "(?!)" matched 0 tests. Searched 2 files (skipping 2 tests) [188.00ms]`
const suppressed = `bun test v1.4.4 (38afee6c8)

error: regex "(?!)" matched 0 tests. Searched 4 files (skipping 4 tests) [215.00ms]`

for (const { name, text, expected } of [
  {
    name: 'normal discovery',
    text: normal,
    expected: { status: 'ok', data: ['src/add.test.ts', 'src/lonely.test.ts'] },
  },
  {
    name: 'suppressed headers',
    text: suppressed,
    expected: {
      status: 'error',
      error:
        'could not list the test files bun matched (bun searched 4, bunt recognised 0)',
    },
  },
  {
    name: 'ANSI and duplicate headers',
    text: `\u001b[32msrc/a.test.ts:\u001b[0m\nsrc/a.test.ts:\nSearched 1 file`,
    expected: { status: 'ok', data: ['src/a.test.ts'] },
  },
  {
    name: 'unmatched filter',
    text: 'The following filters did not match any test files:\n zzz\n33 files were searched',
    expected: { status: 'ok', data: [] },
  },
  { name: 'empty output', text: '', expected: { status: 'ok', data: [] } },
] as const) {
  test(
    [
      `given ${name}`,
      'when parsing discovered test files',
      'it should preserve unique header order or report a count mismatch',
    ].join(', '),
    () => {
      // given
      // when
      const actual = parseDiscoveredFiles(text.split('\n'))
      // then
      expect(actual).toEqual(expected)
    },
  )
}
