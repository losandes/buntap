import { expect, test } from 'bun:test'
import type { TReporterDeps } from '../typedefs/reporter.js'
import type { TRunEvent } from '../typedefs/run-events.js'
import { markdownReporter } from './markdown-reporter.js'

const deps: TReporterDeps = { columns: 80, isTty: false, color: false }

const fold = (events: readonly TRunEvent[]): string => {
  const reporter = markdownReporter(deps)
  const finalState = events.reduce(
    (state, event) => reporter.next(state, event).state,
    reporter.initial,
  )
  return reporter.end(finalState)
}

const mixedEvents: readonly TRunEvent[] = [
  { type: 'run-start', version: '1.3.14', revision: undefined },
  { type: 'file-start', path: 'src/a.test.ts' },
  {
    type: 'test',
    status: 'pass',
    file: 'src/a.test.ts',
    name: 'math > adds',
    path: ['math', 'adds'],
    durationMs: 1,
    diagnostics: [],
  },
  {
    type: 'test',
    status: 'fail',
    file: 'src/a.test.ts',
    name: 'math > fails',
    path: ['math', 'fails'],
    durationMs: 2,
    diagnostics: ['error: expect(received).toBe(expected)'],
  },
  {
    type: 'run-end',
    summarySeen: true,
    totals: {
      pass: 1,
      fail: 1,
      skip: 0,
      todo: 0,
      errors: 0,
      expectCalls: 2,
      tests: 2,
      files: 1,
      durationMs: 9,
    },
  },
]

test(
  [
    'given a mixed run',
    'when the reporter ends',
    'it should nest the describe path under the file as bullets',
  ].join(', '),
  () => {
    // given
    // when
    const output = fold(mixedEvents)

    // then
    expect(output).toContain(
      '- src/a.test.ts\n  - math\n    - adds\n    - fails',
    )
  },
)

test(
  [
    'given a mixed run',
    'when the reporter ends',
    'it should list each failure under an Errors heading with a fenced block',
  ].join(', '),
  () => {
    // given
    // when
    const output = fold(mixedEvents)

    // then
    expect(output).toContain('## Errors')
    expect(output).toContain('#### math > fails')
    expect(output).toContain(
      '```text\nerror: expect(received).toBe(expected)\n```',
    )
  },
)

test(
  [
    'given a mixed run',
    'when the reporter ends',
    'it should include a Totals section with the run totals',
  ].join(', '),
  () => {
    // given
    // when
    const output = fold(mixedEvents)

    // then
    expect(output).toContain('## Totals')
    expect(output).toContain('- **total**: 2')
    expect(output).toContain('- **passed**: 1')
    expect(output).toContain('- **failed**: 1')
    expect(output).toContain('- **skipped**: 0')
    expect(output).toContain('- **duration**: 9.00ms')
  },
)

test(
  [
    'given an all-passing run',
    'when the reporter ends',
    'it should omit the Errors heading entirely',
  ].join(', '),
  () => {
    // given
    const events: readonly TRunEvent[] = [
      { type: 'file-start', path: 'src/a.test.ts' },
      {
        type: 'test',
        status: 'pass',
        file: 'src/a.test.ts',
        name: 'adds',
        path: ['adds'],
        durationMs: 1,
        diagnostics: [],
      },
      {
        type: 'run-end',
        summarySeen: true,
        totals: {
          pass: 1,
          fail: 0,
          skip: 0,
          todo: 0,
          errors: 0,
          expectCalls: 1,
          tests: 1,
          files: 1,
          durationMs: 1,
        },
      },
    ]

    // when
    const output = fold(events)

    // then
    expect(output).not.toContain('## Errors')
  },
)

test(
  [
    'given an unhandled-error event',
    'when the reporter ends',
    'it should appear as a bullet and an Errors entry',
  ].join(', '),
  () => {
    // given
    const events: readonly TRunEvent[] = [
      {
        type: 'unhandled-error',
        file: 'src/e.test.ts',
        message: 'boom',
        diagnostics: ['error: boom'],
      },
      {
        type: 'run-end',
        summarySeen: true,
        totals: {
          pass: 0,
          fail: 1,
          skip: 0,
          todo: 0,
          errors: 1,
          expectCalls: 0,
          tests: 1,
          files: 1,
          durationMs: 1,
        },
      },
    ]

    // when
    const output = fold(events)

    // then
    expect(output).toContain('- src/e.test.ts')
    expect(output).toContain('#### src/e.test.ts')
  },
)

test(
  [
    'given no events at all',
    'when the reporter ends',
    'it should still produce a valid heading and zeroed totals',
  ].join(', '),
  () => {
    // given
    // when
    const output = fold([])

    // then
    expect(output).toContain('# Tests')
    expect(output).toContain('- **total**: 0')
  },
)

test(
  [
    'given the generated document',
    'when inspected',
    'it should follow the house markdown rules it claims to',
  ].join(', '),
  () => {
    // given
    // when
    const output = fold(mixedEvents)
    const lines = output.split('\n')

    // then
    expect(lines.every((line) => !/[ \t]$/.test(line))).toBe(true)
    expect((output.match(/```/g) ?? []).length % 2).toBe(0)
    expect(output).toContain('```text')
    expect(
      lines.some((line, i) => line === '## Errors' && lines[i - 1] === ''),
    ).toBe(true)
    expect(
      lines.some((line, i) => line === '## Totals' && lines[i - 1] === ''),
    ).toBe(true)
  },
)
