import { expect, test } from 'bun:test'
import { classifyLine } from './classify-line.js'

test(
  ['given a blank line', 'when classified', 'it should be kind blank'].join(
    ', ',
  ),
  () => {
    // given
    const line = '   '

    // when
    const actual = classifyLine(line)

    // then
    expect(actual).toEqual({ kind: 'blank' })
  },
)

test(
  [
    'given the bun banner with a revision',
    'when classified',
    'it should extract version and revision',
  ].join(', '),
  () => {
    // given
    const line = 'bun test v1.3.14 (0d9b296a)'

    // when
    const actual = classifyLine(line)

    // then
    expect(actual).toEqual({
      kind: 'banner',
      version: '1.3.14',
      revision: '0d9b296a',
    })
  },
)

test(
  [
    'given the bun banner with no revision',
    'when classified',
    'it should leave revision undefined',
  ].join(', '),
  () => {
    // given
    const line = 'bun test v1.3.14'

    // when
    const actual = classifyLine(line)

    // then
    expect(actual).toEqual({
      kind: 'banner',
      version: '1.3.14',
      revision: undefined,
    })
  },
)

const fileHeaderCases = [
  { name: 'a .test.ts path', input: 'src/b.test.ts:' },
  { name: 'a .spec.tsx path', input: 'src/widget.spec.tsx:' },
  { name: 'an underscore _test.js path', input: 'src/widget_test.js:' },
  { name: 'an underscore _spec.mjs path', input: 'src/widget_spec.mjs:' },
]

for (const { name, input } of fileHeaderCases) {
  test(
    [`given ${name}`, 'when classified', 'it should be a file-header'].join(
      ', ',
    ),
    () => {
      // given
      // when
      const actual = classifyLine(input)

      // then
      expect(actual).toEqual({ kind: 'file-header', path: input.slice(0, -1) })
    },
  )
}

test(
  [
    'given a path with no recognised extension',
    'when classified',
    'it should not be a file-header',
  ].join(', '),
  () => {
    // given
    const line = 'src/notes.txt:'

    // when
    const actual = classifyLine(line)

    // then
    expect(actual).toEqual({ kind: 'text', raw: line })
  },
)

test(
  [
    'given a passing result with a duration',
    'when classified',
    'it should carry status and milliseconds',
  ].join(', '),
  () => {
    // given
    const line = '(pass) top level [0.04ms]'

    // when
    const actual = classifyLine(line)

    // then
    expect(actual).toEqual({
      kind: 'result',
      status: 'pass',
      name: 'top level',
      durationMs: 0.04,
    })
  },
)

test(
  [
    'given a failing result with a describe path',
    'when classified',
    'it should keep the full name',
  ].join(', '),
  () => {
    // given
    const line = '(fail) math > fails [0.06ms]'

    // when
    const actual = classifyLine(line)

    // then
    expect(actual).toEqual({
      kind: 'result',
      status: 'fail',
      name: 'math > fails',
      durationMs: 0.06,
    })
  },
)

test(
  [
    'given a skipped result with no duration',
    'when classified',
    'it should leave duration undefined',
  ].join(', '),
  () => {
    // given
    const line = '(skip) math > skipped'

    // when
    const actual = classifyLine(line)

    // then
    expect(actual).toEqual({
      kind: 'result',
      status: 'skip',
      name: 'math > skipped',
      durationMs: undefined,
    })
  },
)

test(
  ['given a todo result', 'when classified', 'it should be status todo'].join(
    ', ',
  ),
  () => {
    // given
    const line = '(todo) math > todo thing'

    // when
    const actual = classifyLine(line)

    // then
    expect(actual).toEqual({
      kind: 'result',
      status: 'todo',
      name: 'math > todo thing',
      durationMs: undefined,
    })
  },
)

test(
  [
    'given a result with a seconds duration',
    'when classified',
    'it should convert to milliseconds',
  ].join(', '),
  () => {
    // given
    const line = '(pass) slow test [1.5s]'

    // when
    const actual = classifyLine(line)

    // then
    expect(actual).toEqual({
      kind: 'result',
      status: 'pass',
      name: 'slow test',
      durationMs: 1500,
    })
  },
)

test(
  [
    'given the unhandled error banner text',
    'when classified',
    'it should be unhandled-error-banner',
  ].join(', '),
  () => {
    // given
    const line = '# Unhandled error between tests'

    // when
    const actual = classifyLine(line)

    // then
    expect(actual).toEqual({ kind: 'unhandled-error-banner' })
  },
)

test(
  ['given a bare dash rule', 'when classified', 'it should be dash-rule'].join(
    ', ',
  ),
  () => {
    // given
    const line = '-------------------------------'

    // when
    const actual = classifyLine(line)

    // then
    expect(actual).toEqual({ kind: 'dash-rule' })
  },
)

test(
  [
    'given a coverage table ruler',
    'when classified',
    'it should be coverage-rule',
  ].join(', '),
  () => {
    // given
    const line = '------------|---------|---------|-------------------'

    // when
    const actual = classifyLine(line)

    // then
    expect(actual).toEqual({ kind: 'coverage-rule' })
  },
)

const summaryCountCases = [
  { input: ' 2 pass', field: 'pass', value: 2 },
  { input: ' 2 fail', field: 'fail', value: 2 },
  { input: ' 1 skip', field: 'skip', value: 1 },
  { input: ' 1 todo', field: 'todo', value: 1 },
  { input: ' 1 error', field: 'errors', value: 1 },
] as const

for (const { input, field, value } of summaryCountCases) {
  test(
    [
      `given the summary line '${input}'`,
      'when classified',
      `it should extract field ${field}`,
    ].join(', '),
    () => {
      // given
      // when
      const actual = classifyLine(input)

      // then
      expect(actual).toEqual({ kind: 'summary-count', field, value })
    },
  )
}

test(
  [
    'given the expect() calls summary line',
    'when classified',
    'it should extract the expectCalls field',
  ].join(', '),
  () => {
    // given
    const line = ' 3 expect() calls'

    // when
    const actual = classifyLine(line)

    // then
    expect(actual).toEqual({
      kind: 'summary-count',
      field: 'expectCalls',
      value: 3,
    })
  },
)

test(
  [
    'given the Ran summary line with a duration',
    'when classified',
    'it should extract tests, files and durationMs',
  ].join(', '),
  () => {
    // given
    const line = 'Ran 6 tests across 2 files. [9.00ms]'

    // when
    const actual = classifyLine(line)

    // then
    expect(actual).toEqual({
      kind: 'summary-ran',
      tests: 6,
      files: 2,
      durationMs: 9,
    })
  },
)

test(
  [
    'given the Ran summary line in the singular',
    'when classified',
    'it should still parse',
  ].join(', '),
  () => {
    // given
    const line = 'Ran 1 test across 1 file.'

    // when
    const actual = classifyLine(line)

    // then
    expect(actual).toEqual({
      kind: 'summary-ran',
      tests: 1,
      files: 1,
      durationMs: undefined,
    })
  },
)

test(
  [
    'given an unrecognised line',
    'when classified',
    'it should fall back to text',
  ].join(', '),
  () => {
    // given
    const line = '1 | import { expect, test } from "bun:test";'

    // when
    const actual = classifyLine(line)

    // then
    expect(actual).toEqual({ kind: 'text', raw: line })
  },
)

const rollupHeaderCases = [
  { input: '1 tests skipped:', status: 'skip', count: 1 },
  { input: '1 tests todo:', status: 'todo', count: 1 },
  { input: '3 tests failed:', status: 'fail', count: 3 },
] as const

for (const { input, status, count } of rollupHeaderCases) {
  test(
    [
      `given the roll-up header '${input}'`,
      'when classified',
      `it should be kind rollup-header with status ${status}`,
    ].join(', '),
    () => {
      // given
      // when
      const actual = classifyLine(input)

      // then
      expect(actual).toEqual({ kind: 'rollup-header', status, count })
    },
  )
}

test(
  [
    "given a roll-up-shaped line bun does not print ('2 tests passed:')",
    'when classified',
    'it should still be kind text',
  ].join(', '),
  () => {
    // given
    const line = '2 tests passed:'

    // when
    const actual = classifyLine(line)

    // then
    expect(actual).toEqual({ kind: 'text', raw: line })
  },
)

test(
  [
    "given a roll-up-shaped line with an unrecognised word ('3 tests filtered out:')",
    'when classified',
    'it should still be kind text',
  ].join(', '),
  () => {
    // given
    const line = '3 tests filtered out:'

    // when
    const actual = classifyLine(line)

    // then
    expect(actual).toEqual({ kind: 'text', raw: line })
  },
)

test(
  [
    'given a result line that would appear inside a roll-up section',
    'when classified',
    'it should still be kind result, classification stays context-free',
  ].join(', '),
  () => {
    // given
    const line = '(fail) boom [0.21ms]'

    // when
    const actual = classifyLine(line)

    // then
    expect(actual).toEqual({
      kind: 'result',
      status: 'fail',
      name: 'boom',
      durationMs: 0.21,
    })
  },
)
