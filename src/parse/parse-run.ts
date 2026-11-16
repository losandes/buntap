import type { TRunEvent, TTotals } from '../typedefs/run-events.js'
import type { TClassifiedLine } from './classify-line.js'
import { classifyLine } from './classify-line.js'
import { stripAnsi } from './strip-ansi.js'

type TTotalsAccumulator = Readonly<{
  pass: number
  fail: number
  skip: number
  todo: number
  errors: number
  expectCalls: number
}>

type TCoverageCapture = Readonly<{ active: boolean; lines: readonly string[] }>

type TUnhandledErrorCapture = Readonly<{
  active: boolean
  openSeen: boolean
  lines: readonly string[]
}>

export type TParseState = Readonly<{
  currentFile: string | undefined
  diagnostics: readonly string[]
  coverage: TCoverageCapture
  unhandledError: TUnhandledErrorCapture
  totals: TTotalsAccumulator
  rollup: boolean
}>

export type TStepResult = Readonly<{
  state: TParseState
  events: readonly TRunEvent[]
}>

export const initialParseState: TParseState = {
  currentFile: undefined,
  diagnostics: [],
  coverage: { active: false, lines: [] },
  unhandledError: { active: false, openSeen: false, lines: [] },
  totals: { pass: 0, fail: 0, skip: 0, todo: 0, errors: 0, expectCalls: 0 },
  rollup: false,
}

const flushDiagnostics = (state: TParseState): TStepResult =>
  state.diagnostics.length === 0
    ? { state, events: [] }
    : {
        state: { ...state, diagnostics: [] },
        events: [
          { type: 'passthrough', kind: 'output', lines: state.diagnostics },
        ],
      }

const stepCoverage = (state: TParseState, line: string): TStepResult => {
  if (classifyLine(line).kind === 'blank') {
    return {
      state: { ...state, coverage: { active: false, lines: [] } },
      events: [
        { type: 'passthrough', kind: 'coverage', lines: state.coverage.lines },
      ],
    }
  }
  return {
    state: {
      ...state,
      coverage: { active: true, lines: [...state.coverage.lines, line] },
    },
    events: [],
  }
}

const extractUnhandledMessage = (
  lines: readonly string[],
  file: string | undefined,
): string => {
  const errorLine = lines.find((candidate) => candidate.startsWith('error:'))
  return errorLine
    ? errorLine.slice('error:'.length).trim()
    : (file ?? 'unhandled error')
}

const stepUnhandledError = (state: TParseState, line: string): TStepResult => {
  if (classifyLine(line).kind === 'dash-rule') {
    if (!state.unhandledError.openSeen) {
      return {
        state: {
          ...state,
          unhandledError: { ...state.unhandledError, openSeen: true },
        },
        events: [],
      }
    }
    const lines = state.unhandledError.lines
    return {
      state: {
        ...state,
        unhandledError: { active: false, openSeen: false, lines: [] },
      },
      events: [
        {
          type: 'unhandled-error',
          file: state.currentFile,
          message: extractUnhandledMessage(lines, state.currentFile),
          diagnostics: lines,
        },
      ],
    }
  }
  return {
    state: {
      ...state,
      unhandledError: {
        ...state.unhandledError,
        lines: [...state.unhandledError.lines, line],
      },
    },
    events: [],
  }
}

const stepClassified = (
  state: TParseState,
  classified: TClassifiedLine,
  line: string,
): TStepResult => {
  switch (classified.kind) {
    case 'blank':
      return { state, events: [] }

    case 'banner':
      return {
        state,
        events: [
          {
            type: 'run-start',
            version: classified.version,
            revision: classified.revision,
          },
        ],
      }

    case 'file-header': {
      const flushed = flushDiagnostics(state)
      return {
        state: { ...flushed.state, currentFile: classified.path },
        events: [
          ...flushed.events,
          { type: 'file-start', path: classified.path },
        ],
      }
    }

    case 'result': {
      const { diagnostics } = state
      return {
        state: { ...state, diagnostics: [] },
        events: [
          {
            type: 'test',
            status: classified.status,
            file: state.currentFile,
            name: classified.name,
            path: classified.name.split(' > '),
            durationMs: classified.durationMs,
            diagnostics,
          },
        ],
      }
    }

    case 'unhandled-error-banner': {
      const flushed = flushDiagnostics(state)
      return {
        state: {
          ...flushed.state,
          unhandledError: { active: true, openSeen: false, lines: [] },
        },
        events: flushed.events,
      }
    }

    case 'coverage-rule': {
      const flushed = flushDiagnostics(state)
      return {
        state: { ...flushed.state, coverage: { active: true, lines: [line] } },
        events: flushed.events,
      }
    }

    case 'dash-rule':
      return {
        state: { ...state, diagnostics: [...state.diagnostics, line] },
        events: [],
      }

    case 'summary-count': {
      const flushed = flushDiagnostics(state)
      return {
        state: {
          ...flushed.state,
          totals: {
            ...flushed.state.totals,
            [classified.field]: classified.value,
          },
        },
        events: flushed.events,
      }
    }

    case 'summary-ran': {
      const flushed = flushDiagnostics(state)
      const totals: TTotals = {
        ...flushed.state.totals,
        tests: classified.tests,
        files: classified.files,
        durationMs: classified.durationMs,
      }
      return {
        state: flushed.state,
        events: [
          ...flushed.events,
          { type: 'run-end', totals, summarySeen: true },
        ],
      }
    }

    case 'text':
      return {
        state: { ...state, diagnostics: [...state.diagnostics, line] },
        events: [],
      }

    case 'rollup-header': {
      const flushed = flushDiagnostics(state)
      return {
        state: { ...flushed.state, rollup: true },
        events: flushed.events,
      }
    }
  }
}

/**
 * One pure transition: the current state plus one raw input line in, the next
 * state plus zero or more events out.
 *
 * Bun's console reporter reprints every skipped, todo, and failed result a
 * second time in a trailing roll-up ("N tests skipped:" and friends) once a
 * run is large enough. Those lines are restatements, not tests, so a result
 * inside an open roll-up emits nothing; anything that is not blank and not
 * another roll-up header closes the roll-up, so an unrecognised shape loses
 * at most the restatements and never a real test.
 */
export const stepLine = (state: TParseState, rawLine: string): TStepResult => {
  const line = stripAnsi(rawLine)

  if (state.coverage.active) return stepCoverage(state, line)
  if (state.unhandledError.active) return stepUnhandledError(state, line)

  const classified = classifyLine(line)

  if (state.rollup && classified.kind === 'result') return { state, events: [] }

  const stepped = stepClassified(state, classified, line)

  return !stepped.state.rollup ||
    classified.kind === 'blank' ||
    classified.kind === 'rollup-header'
    ? stepped
    : { state: { ...stepped.state, rollup: false }, events: stepped.events }
}

const zeroTotals: TTotals = {
  pass: 0,
  fail: 0,
  skip: 0,
  todo: 0,
  errors: 0,
  expectCalls: 0,
  tests: 0,
  files: 0,
  durationMs: undefined,
}

/** Events produced when the input ends without ever reaching a `summary-ran` line. */
export const finalizeParse = (state: TParseState): readonly TRunEvent[] => {
  const flushed = flushDiagnostics(state)
  const strayCoverage: readonly TRunEvent[] =
    state.coverage.active && state.coverage.lines.length > 0
      ? [{ type: 'passthrough', kind: 'coverage', lines: state.coverage.lines }]
      : []
  const strayUnhandled: readonly TRunEvent[] =
    state.unhandledError.active && state.unhandledError.lines.length > 0
      ? [
          {
            type: 'passthrough',
            kind: 'output',
            lines: state.unhandledError.lines,
          },
        ]
      : []
  return [
    ...flushed.events,
    ...strayCoverage,
    ...strayUnhandled,
    { type: 'run-end', totals: zeroTotals, summarySeen: false },
  ]
}

/**
 * The parser's stream fold: each line advances the immutable state produced
 * by `stepLine`, and the fold stops once a `run-end` event has been produced —
 * which guarantees run-end is emitted exactly once and is always last (§2.2).
 *
 * The `let state` is deliberate. This was previously a `yield*` recursion,
 * one nested async generator per input line, and every value then had to be
 * delegated back up through that whole chain: a run of a few thousand lines
 * overflowed the call stack ("Maximum call stack size exceeded"). The
 * reassignment is confined to this loop; every state value is still built
 * immutably by `stepLine`.
 *
 * The iterator is driven by hand rather than with `for await`, so stopping at
 * run-end does not call `return()` on the source: as before, whatever follows
 * the summary is left unread rather than torn down.
 */
export async function* parseRun(
  lines: Readonly<AsyncIterable<string>>,
): AsyncGenerator<TRunEvent> {
  const iterator = lines[Symbol.asyncIterator]()
  let state = initialParseState
  while (true) {
    const next = await iterator.next()
    if (next.done === true) {
      yield* finalizeParse(state)
      return
    }
    const step = stepLine(state, next.value)
    yield* step.events
    if (step.events.some((event) => event.type === 'run-end')) return
    state = step.state
  }
}
