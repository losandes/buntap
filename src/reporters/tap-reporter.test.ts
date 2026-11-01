import { expect, test } from 'bun:test'
import type { TRunEvent } from '../typedefs/run-events.js'
import { tapReporter } from './tap-reporter.js'

const { initial, next, end } = tapReporter

test(
  [
    'given a run-start event',
    'when reported',
    'it should print the TAP version header',
  ].join(', '),
  () => {
    // given
    const event: TRunEvent = {
      type: 'run-start',
      version: '1.3.14',
      revision: '0d9b296a',
    }

    // when
    const { output, state } = next(initial, event)

    // then
    expect(output).toBe('TAP version 14\n')
    expect(state.versionEmitted).toBe(true)
  },
)

test(
  [
    'given a file-start event',
    'when reported',
    'it should print a comment with the path',
  ].join(', '),
  () => {
    // given
    const event: TRunEvent = { type: 'file-start', path: 'src/a.test.ts' }

    // when
    const { output } = next(initial, event)

    // then
    expect(output).toBe('# src/a.test.ts\n')
  },
)

test(
  [
    'given a passing test with no diagnostics',
    'when reported',
    'it should print a bare ok line numbered from 1',
  ].join(', '),
  () => {
    // given
    const event: TRunEvent = {
      type: 'test',
      status: 'pass',
      file: 'a.test.ts',
      name: 'top level',
      path: ['top level'],
      durationMs: 0.04,
      diagnostics: [],
    }

    // when
    const { output, state } = next(initial, event)

    // then
    expect(output).toBe('ok 1 - top level\n')
    expect(state.lineCount).toBe(1)
  },
)

test(
  [
    'given a passing test that logged',
    'when reported',
    'it should print the log as trailing comments',
  ].join(', '),
  () => {
    // given
    const event: TRunEvent = {
      type: 'test',
      status: 'pass',
      file: 'a.test.ts',
      name: 'with log',
      path: ['with log'],
      durationMs: 0.06,
      diagnostics: ['hello from test'],
    }

    // when
    const { output } = next(initial, event)

    // then
    expect(output).toBe('ok 1 - with log\n# hello from test\n')
  },
)

test(
  [
    'given a skipped test',
    'when reported',
    'it should append the SKIP directive',
  ].join(', '),
  () => {
    // given
    const event: TRunEvent = {
      type: 'test',
      status: 'skip',
      file: 'a.test.ts',
      name: 'math > skipped',
      path: ['math', 'skipped'],
      durationMs: undefined,
      diagnostics: [],
    }

    // when
    const { output } = next(initial, event)

    // then
    expect(output).toBe('ok 1 - math > skipped # SKIP\n')
  },
)

test(
  [
    'given a todo test',
    'when reported',
    'it should append the TODO directive',
  ].join(', '),
  () => {
    // given
    const event: TRunEvent = {
      type: 'test',
      status: 'todo',
      file: 'a.test.ts',
      name: 'math > todo thing',
      path: ['math', 'todo thing'],
      durationMs: undefined,
      diagnostics: [],
    }

    // when
    const { output } = next(initial, event)

    // then
    expect(output).toBe('ok 1 - math > todo thing # TODO\n')
  },
)

test(
  [
    'given a failing test with diagnostics',
    'when reported',
    'it should print not ok and a YAML block with the error message, severity and details',
  ].join(', '),
  () => {
    // given
    const event: TRunEvent = {
      type: 'test',
      status: 'fail',
      file: 'b.test.ts',
      name: 'throws',
      path: ['throws'],
      durationMs: 0.11,
      diagnostics: [
        'error: boom',
        'second line',
        '      at <anonymous> (b.test.ts:3:59)',
      ],
    }

    // when
    const { output } = next(initial, event)

    // then
    expect(output).toBe(
      [
        'not ok 1 - throws',
        '  ---',
        '  message: "boom"',
        '  severity: fail',
        '  duration_ms: 0.11',
        '  data:',
        '    details: |',
        '      error: boom',
        '      second line',
        '            at <anonymous> (b.test.ts:3:59)',
        '  ...',
        '',
      ].join('\n'),
    )
  },
)

test(
  [
    'given a failing test with no error: line in its diagnostics',
    'when reported',
    'it should fall back to the test name as the message',
  ].join(', '),
  () => {
    // given
    const event: TRunEvent = {
      type: 'test',
      status: 'fail',
      file: 'b.test.ts',
      name: 'math > fails',
      path: ['math', 'fails'],
      durationMs: 0.08,
      diagnostics: [],
    }

    // when
    const { output } = next(initial, event)

    // then
    expect(output).toBe(
      [
        'not ok 1 - math > fails',
        '  ---',
        '  message: "math > fails"',
        '  severity: fail',
        '  duration_ms: 0.08',
        '  ...',
        '',
      ].join('\n'),
    )
  },
)

test(
  [
    'given a description with a backslash, a hash and a newline',
    'when reported',
    'it should escape all three',
  ].join(', '),
  () => {
    // given
    const event: TRunEvent = {
      type: 'test',
      status: 'pass',
      file: 'a.test.ts',
      name: 'a \\ b # c\nd',
      path: ['a \\ b # c\nd'],
      durationMs: undefined,
      diagnostics: [],
    }

    // when
    const { output } = next(initial, event)

    // then
    expect(output).toBe('ok 1 - a \\\\ b \\# c d\n')
  },
)

test(
  [
    'given an unhandled-error event',
    'when reported',
    'it should print not ok named after the file with a YAML block',
  ].join(', '),
  () => {
    // given
    const event: TRunEvent = {
      type: 'unhandled-error',
      file: 'src/e.test.ts',
      message: "Cannot find module './nope.ts'",
      diagnostics: ["error: Cannot find module './nope.ts'"],
    }

    // when
    const { output } = next(initial, event)

    // then
    expect(output).toBe(
      [
        'not ok 1 - src/e.test.ts',
        '  ---',
        '  message: "Cannot find module \'./nope.ts\'"',
        '  severity: fail',
        '  duration_ms: 0',
        '  data:',
        '    details: |',
        "      error: Cannot find module './nope.ts'",
        '  ...',
        '',
      ].join('\n'),
    )
  },
)

test(
  [
    'given a passthrough event with lines',
    'when reported',
    'it should print each line as a TAP comment',
  ].join(', '),
  () => {
    // given
    const event: TRunEvent = {
      type: 'passthrough',
      kind: 'coverage',
      lines: ['------|------', 'All files | 100 |'],
    }

    // when
    const { output } = next(initial, event)

    // then
    expect(output).toBe('# ------|------\n# All files | 100 |\n')
  },
)

test(
  [
    'given a passthrough event with no lines',
    'when reported',
    'it should print nothing',
  ].join(', '),
  () => {
    // given
    const event: TRunEvent = { type: 'passthrough', kind: 'output', lines: [] }

    // when
    const { output } = next(initial, event)

    // then
    expect(output).toBe('')
  },
)

test(
  [
    'given a coverage-gate-failed event',
    'when reported',
    'it should print the failure signal as TAP comments',
  ].join(', '),
  () => {
    // given
    const event: TRunEvent = {
      type: 'coverage-gate-failed',
      thresholdPct: { functionsPct: 95, linesPct: 95 },
      failing: [{ file: 'src/add.ts', functionsPct: 25, linesPct: 100 }],
    }

    // when
    const { output } = next(initial, event)

    // then
    expect(output).toBe(
      '# COVERAGE FAIL 1 file below the minimum (functions 95.00%, lines 95.00%)\n#   src/add.ts functions 25.00%, lines 100.00%\n',
    )
  },
)

test(
  [
    'given a run-end event with a summary',
    'when reported',
    'it should print the plan and the totals as comments',
  ].join(', '),
  () => {
    // given
    const state = { lineCount: 6, versionEmitted: true }
    const event: TRunEvent = {
      type: 'run-end',
      summarySeen: true,
      totals: {
        pass: 2,
        fail: 2,
        skip: 1,
        todo: 1,
        errors: 0,
        expectCalls: 3,
        tests: 6,
        files: 2,
        durationMs: 9,
      },
    }

    // when
    const { output } = next(state, event)

    // then
    expect(output).toBe(
      [
        '1..6',
        '# tests 6',
        '# pass 2',
        '# fail 2',
        '# skip 1',
        '# todo 1',
        '# duration_ms 9',
        '',
      ].join('\n'),
    )
  },
)

test(
  [
    'given a run-end event with no summary seen and the version already printed',
    'when reported',
    'it should print only the empty plan with the hint',
  ].join(', '),
  () => {
    // given
    const state = { lineCount: 0, versionEmitted: true }
    const event: TRunEvent = {
      type: 'run-end',
      summarySeen: false,
      totals: {
        pass: 0,
        fail: 0,
        skip: 0,
        todo: 0,
        errors: 0,
        expectCalls: 0,
        tests: 0,
        files: 0,
        durationMs: undefined,
      },
    }

    // when
    const { output } = next(state, event)

    // then
    expect(output).toBe('1..0 # no bun test summary found on stdin\n')
  },
)

test(
  [
    'given a run-end event with no summary seen and the version never printed',
    'when reported',
    'it should print the version header too',
  ].join(', '),
  () => {
    // given
    const event: TRunEvent = {
      type: 'run-end',
      summarySeen: false,
      totals: {
        pass: 0,
        fail: 0,
        skip: 0,
        todo: 0,
        errors: 0,
        expectCalls: 0,
        tests: 0,
        files: 0,
        durationMs: undefined,
      },
    }

    // when
    const { output } = next(initial, event)

    // then
    expect(output).toBe(
      'TAP version 14\n1..0 # no bun test summary found on stdin\n',
    )
  },
)

test(
  ['given the reporter end', 'it should produce no trailing output'].join(', '),
  () => {
    // given
    // when
    const actual = end(initial)

    // then
    expect(actual).toBe('')
  },
)
