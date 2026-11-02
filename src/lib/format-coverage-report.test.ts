import { expect, test } from 'bun:test'
import { stripAnsi } from '../parse/strip-ansi.js'
import type { TCoverageThresholdPct } from '../typedefs/coverage.js'
import { createConsoleStyles } from './console-styles.js'
import { renderCoverageReport } from './format-coverage-report.js'

// Shared fixture (§4.3): two files below a 95 threshold, one passing it but
// below 100.
const fixtureLines: readonly string[] = [
  '--------------------------|---------|---------|-------------------',
  'File                      | % Funcs | % Lines | Uncovered Line #s',
  '--------------------------|---------|---------|-------------------',
  'All files                 |   96.80 |   94.10 |',
  ' src/parse/parse-run.ts   |   97.00 |   82.40 | 118-140, 203',
  ' src/runner/bunt-runner.ts|   91.00 |   99.10 | 77, 91-94',
  ' src/cli.test.ts          |  100.00 |   99.52 | 393-394',
  '--------------------------|---------|---------|-------------------',
]

const threshold95: TCoverageThresholdPct = { functionsPct: 95, linesPct: 95 }

const modes = ['full', 'failures', 'summary', 'bar', 'markdown'] as const

test(
  [
    'given the shared fixture and a 95 threshold',
    'when rendered in full with colour off',
    "it should emit bun's table unchanged",
  ].join(', '),
  () => {
    // given
    const deps = {
      mode: 'full' as const,
      styles: createConsoleStyles(false),
      thresholdPct: threshold95,
    }

    // when
    const actual = renderCoverageReport(deps)(fixtureLines)

    // then
    expect(actual).toEqual(fixtureLines)
  },
)

test(
  [
    'given the shared fixture and a 95 threshold',
    'when rendered in failures with colour off',
    'it should keep the header, the rule lines, All files, and only the failing rows',
  ].join(', '),
  () => {
    // given
    const deps = {
      mode: 'failures' as const,
      styles: createConsoleStyles(false),
      thresholdPct: threshold95,
    }

    // when
    const actual = renderCoverageReport(deps)(fixtureLines)

    // then
    expect(actual).toEqual([
      '--------------------------|---------|---------|-------------------',
      'File                      | % Funcs | % Lines | Uncovered Line #s',
      '--------------------------|---------|---------|-------------------',
      'All files                 |   96.80 |   94.10 |',
      ' src/parse/parse-run.ts   |   97.00 |   82.40 | 118-140, 203',
      ' src/runner/bunt-runner.ts|   91.00 |   99.10 | 77, 91-94',
      '--------------------------|---------|---------|-------------------',
    ])
  },
)

test(
  [
    'given the shared fixture and no row failing a 10 threshold',
    'when rendered in failures',
    'it should fall back to the summary line',
  ].join(', '),
  () => {
    // given
    const deps = {
      mode: 'failures' as const,
      styles: createConsoleStyles(false),
      thresholdPct: { functionsPct: 10, linesPct: 10 },
    }

    // when
    const actual = renderCoverageReport(deps)(fixtureLines)

    // then
    expect(actual).toEqual([
      'coverage  lines 94.10%  funcs 96.80%  ·  3 files  ·  all above 10%',
    ])
  },
)

test(
  [
    'given the shared fixture and no threshold configured',
    'when rendered in failures',
    'it should fall back to the summary line',
  ].join(', '),
  () => {
    // given
    const deps = {
      mode: 'failures' as const,
      styles: createConsoleStyles(false),
      thresholdPct: undefined,
    }

    // when
    const actual = renderCoverageReport(deps)(fixtureLines)

    // then
    expect(actual).toEqual([
      'coverage  lines 94.10%  funcs 96.80%  ·  3 files  ·  no minimum configured',
    ])
  },
)

test(
  [
    'given the shared fixture and a 95 threshold',
    'when rendered in summary',
    'it should print one line naming the two failing files',
  ].join(', '),
  () => {
    // given
    const deps = {
      mode: 'summary' as const,
      styles: createConsoleStyles(false),
      thresholdPct: threshold95,
    }

    // when
    const actual = renderCoverageReport(deps)(fixtureLines)

    // then
    expect(actual).toEqual([
      'coverage  lines 94.10%  funcs 96.80%  ·  3 files  ·  2 below 95%',
    ])
  },
)

test(
  [
    'given the shared fixture and no threshold configured',
    'when rendered in summary',
    'it should say no minimum is configured',
  ].join(', '),
  () => {
    // given
    const deps = {
      mode: 'summary' as const,
      styles: createConsoleStyles(false),
      thresholdPct: undefined,
    }

    // when
    const actual = renderCoverageReport(deps)(fixtureLines)

    // then
    expect(actual).toEqual([
      'coverage  lines 94.10%  funcs 96.80%  ·  3 files  ·  no minimum configured',
    ])
  },
)

test(
  [
    'given the shared fixture and a 95 threshold',
    'when rendered in bar',
    'it should print a header, a blank line, one row per file ordered worst-first, and the summary line last',
  ].join(', '),
  () => {
    // given
    const deps = {
      mode: 'bar' as const,
      styles: createConsoleStyles(false),
      thresholdPct: threshold95,
    }

    // when
    const actual = renderCoverageReport(deps)(fixtureLines)

    // then
    expect(actual).toEqual([
      'coverage  95% minimum',
      '',
      '                src/parse/parse-run.ts  lines   82.40%  ████████████████████░░░┊░  FAIL  118-140, 203',
      '             src/runner/bunt-runner.ts  funcs   91.00%  ██████████████████████░┊░  FAIL  77, 91-94',
      '                       src/cli.test.ts  lines   99.52%  ███████████████████████┊█  ok    393-394',
      'coverage  lines 94.10%  funcs 96.80%  ·  3 files  ·  2 below 95%',
    ])
  },
)

test(
  [
    'given more than ten files below 100%',
    'when rendered in bar',
    'it should cap at ten rows and note how many more were dropped',
  ].join(', '),
  () => {
    // given
    const header =
      '--------------------------|---------|---------|-------------------'
    const headerRow =
      'File                      | % Funcs | % Lines | Uncovered Line #s'
    const rows = Array.from(
      { length: 12 },
      (_, i) => ` src/file${i}.ts | ${90 - i} | ${90 - i} |`,
    )
    const lines = [
      header,
      headerRow,
      header,
      'All files | 50.00 | 50.00 |',
      ...rows,
      header,
    ]
    const deps = {
      mode: 'bar' as const,
      styles: createConsoleStyles(false),
      thresholdPct: undefined,
    }

    // when
    const actual = renderCoverageReport(deps)(lines)

    // then
    expect(actual.length).toBe(1 + 1 + 10 + 1 + 1)
    expect(actual).toContain('… and 2 more files below 100%')
    expect(actual.at(-2)).toBe('… and 2 more files below 100%')
  },
)

test(
  [
    'given the shared fixture and a 95 threshold',
    'when rendered in markdown',
    "it should print a worst-first table of the failing rows behind a headline, with bun's table folded",
  ].join(', '),
  () => {
    // given
    const deps = {
      mode: 'markdown' as const,
      styles: createConsoleStyles(false),
      thresholdPct: threshold95,
    }

    // when
    const actual = renderCoverageReport(deps)(fixtureLines)

    // then
    expect(actual).toEqual([
      '**Coverage: 2 of 3 files below 95%** — lines 94.10%, funcs 96.80%',
      '',
      '| File | Lines | Funcs | Uncovered |',
      '| --- | --- | --- | --- |',
      '| `src/parse/parse-run.ts` | 82.40% | 97.00% | 118-140, 203 |',
      '| `src/runner/bunt-runner.ts` | 99.10% | 91.00% | 77, 91-94 |',
      '',
      '<details><summary>Full coverage table</summary>',
      '',
      '```text',
      ...fixtureLines,
      '```',
      '',
      '</details>',
    ])
  },
)

test(
  [
    'given the shared fixture and no threshold configured',
    'when rendered in markdown',
    'it should print an across-files headline and a table of rows below 100%',
  ].join(', '),
  () => {
    // given
    const deps = {
      mode: 'markdown' as const,
      styles: createConsoleStyles(false),
      thresholdPct: undefined,
    }

    // when
    const actual = renderCoverageReport(deps)(fixtureLines)

    // then
    expect(actual[0]).toBe(
      '**Coverage: 94.10% lines, 96.80% funcs across 3 files**',
    )
    expect(actual).toContain(
      '| `src/cli.test.ts` | 99.52% | 100.00% | 393-394 |',
    )
  },
)

test(
  ['given markdown mode', 'it should emit no ANSI even with colour on'].join(
    ', ',
  ),
  () => {
    // given
    const deps = {
      mode: 'markdown' as const,
      styles: createConsoleStyles(true),
      thresholdPct: threshold95,
    }

    // when
    const actual = renderCoverageReport(deps)(fixtureLines)

    // then
    for (const line of actual) {
      expect(stripAnsi(line)).toBe(line)
    }
  },
)

for (const mode of modes) {
  test(
    [
      `given the shared fixture and mode ${mode}`,
      'when rendered with colour on',
      'it should print the same plain text as with colour off, once ANSI is stripped',
    ].join(', '),
    () => {
      // given
      const plain = renderCoverageReport({
        mode,
        styles: createConsoleStyles(false),
        thresholdPct: threshold95,
      })(fixtureLines)
      const colored = renderCoverageReport({
        mode,
        styles: createConsoleStyles(true),
        thresholdPct: threshold95,
      })(fixtureLines)

      // when
      const stripped = colored.map(stripAnsi)

      // then
      expect(stripped).toEqual([...plain])
    },
  )
}

for (const mode of modes) {
  test(
    [
      `given no rows and no totals, mode ${mode}`,
      'when rendered',
      'it should emit nothing',
    ].join(', '),
    () => {
      // given
      const deps = {
        mode,
        styles: createConsoleStyles(false),
        thresholdPct: threshold95,
      }

      // when
      const actual = renderCoverageReport(deps)([])

      // then
      expect(actual).toEqual([])
    },
  )
}
