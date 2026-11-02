import { expect, test } from 'bun:test'
import type { TReporterDeps } from '../typedefs/reporter.js'
import type { TRunEvent } from '../typedefs/run-events.js'
import { markdownReporter } from './markdown-reporter.js'

const deps: TReporterDeps = {
  columns: 80,
  isTty: false,
  color: false,
  coverageReport: 'full',
  thresholdPct: undefined,
}

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
    'given a coverage passthrough event',
    'when the reporter ends',
    'it should print a Coverage section between Errors and Totals',
  ].join(', '),
  () => {
    // given
    const coverageEvent: TRunEvent = {
      type: 'passthrough',
      kind: 'coverage',
      lines: [
        'File | % Funcs | % Lines',
        'All files | 62.50 | 100.00',
        ' src/add.ts | 25.00 | 100.00',
      ],
    }

    // when
    const output = fold([...mixedEvents, coverageEvent])

    // then
    const errorsIndex = output.indexOf('## Errors')
    const coverageIndex = output.indexOf('## Coverage')
    const totalsIndex = output.indexOf('## Totals')
    expect(errorsIndex).toBeGreaterThan(-1)
    expect(coverageIndex).toBeGreaterThan(errorsIndex)
    expect(totalsIndex).toBeGreaterThan(coverageIndex)
    expect(output).toContain(
      'File | % Funcs | % Lines\nAll files | 62.50 | 100.00\n src/add.ts | 25.00 | 100.00',
    )
  },
)

test(
  [
    'given a coverage event and a gate-failed event',
    'when the reporter ends',
    'it should not be printed until end(), and should print the failure signal below the fence',
  ].join(', '),
  () => {
    // given
    const reporter = markdownReporter(deps)
    const coverageEvent: TRunEvent = {
      type: 'passthrough',
      kind: 'coverage',
      lines: ['File | % Funcs | % Lines', ' src/add.ts | 25.00 | 100.00'],
    }
    const gateEvent: TRunEvent = {
      type: 'coverage-gate-failed',
      thresholdPct: { functionsPct: 95, linesPct: 95 },
      failing: [
        { file: 'src/add.ts', functionsPct: 25, linesPct: 100, uncovered: [] },
      ],
    }

    // when
    const afterCoverage = reporter.next(reporter.initial, coverageEvent)
    const afterGate = reporter.next(afterCoverage.state, gateEvent)
    const output = reporter.end(afterGate.state)

    // then
    expect(afterCoverage.output).toBe('')
    expect(afterGate.output).toBe('')
    expect(output).toContain(
      '**COVERAGE FAIL** 1 file below the minimum (functions 95.00%, lines 95.00%)',
    )
    expect(output).toContain('- `src/add.ts` functions 25.00%, lines 100.00%')
    const fenceEnd = output.indexOf('```\n', output.indexOf('```text'))
    const gateIndex = output.indexOf('**COVERAGE FAIL**')
    expect(gateIndex).toBeGreaterThan(fenceEnd)
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

const coverageFixture: readonly string[] = [
  '------------|---------|---------|-------------------',
  'File        | % Funcs | % Lines | Uncovered Line #s',
  '------------|---------|---------|-------------------',
  'All files   |   62.50 |   90.00 |',
  ' src/add.ts |   25.00 |   90.00 | 4-7',
  '------------|---------|---------|-------------------',
]

test(
  [
    "given a coverage passthrough event, in the markdown reporter's default markdown mode",
    'when the reporter ends',
    "it should print the headline and worst-first table, with bun's table folded",
  ].join(', '),
  () => {
    // given
    const reporter = markdownReporter({
      ...deps,
      coverageReport: 'markdown',
      thresholdPct: { functionsPct: 95, linesPct: 95 },
    })
    const event: TRunEvent = {
      type: 'passthrough',
      kind: 'coverage',
      lines: coverageFixture,
    }
    const afterCoverage = reporter.next(reporter.initial, event)

    // when
    const output = reporter.end(afterCoverage.state)

    // then
    expect(afterCoverage.output).toBe('')
    expect(output).toContain('**Coverage: 1 of 1 files below 95%**')
    expect(output).toContain('<details><summary>Full coverage table</summary>')
  },
)

test(
  [
    'given a coverage passthrough event and an overridden --coverage-report=summary',
    'when the reporter ends',
    'it should print the summary line instead of the default markdown mode',
  ].join(', '),
  () => {
    // given
    const reporter = markdownReporter({
      ...deps,
      coverageReport: 'summary',
      thresholdPct: { functionsPct: 95, linesPct: 95 },
    })
    const event: TRunEvent = {
      type: 'passthrough',
      kind: 'coverage',
      lines: coverageFixture,
    }
    const afterCoverage = reporter.next(reporter.initial, event)

    // when
    const output = reporter.end(afterCoverage.state)

    // then
    expect(output).toContain(
      'coverage  lines 90.00%  funcs 62.50%  ·  1 files  ·  1 below 95%',
    )
  },
)
