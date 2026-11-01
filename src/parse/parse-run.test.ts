import { expect, test } from 'bun:test'
import type { TRunEvent } from '../typedefs/run-events.js'
import {
  consoleLogBeforePassFixture,
  coverageFixture,
  mixedResultsFixture,
  unhandledErrorFixture,
} from './bun-output.fixture.js'
import {
  finalizeParse,
  initialParseState,
  parseRun,
  stepLine,
} from './parse-run.js'

// A plain object, not an async generator: there is no await in the body, and
// wrapping each value of a synchronous iterator in Promise.resolve satisfies
// the AsyncIterable contract without Biome's useAwait flagging a needless
// `async function*`.
const linesOf = (text: string): AsyncIterable<string> => ({
  [Symbol.asyncIterator]: () => {
    const iterator = text.split('\n').slice(0, -1)[Symbol.iterator]()
    return { next: () => Promise.resolve(iterator.next()) }
  },
})

const collect = async (
  events: AsyncIterable<TRunEvent>,
): Promise<readonly TRunEvent[]> => {
  // The one accumulator in this test helper: a stream fold cannot be
  // expressed as a reduce because events arrive over time.
  let out: readonly TRunEvent[] = []
  for await (const event of events) out = [...out, event]
  return out
}

test(
  [
    'given the mixed pass/fail/skip/todo fixture',
    'when parsed',
    'it should emit one run-start, two file-starts and six test events',
  ].join(', '),
  async () => {
    // given
    const input = linesOf(mixedResultsFixture)

    // when
    const events = await collect(parseRun(input))

    // then
    expect(events.filter((event) => event.type === 'run-start')).toHaveLength(1)
    expect(events.filter((event) => event.type === 'file-start')).toHaveLength(
      2,
    )
    expect(events.filter((event) => event.type === 'test')).toHaveLength(6)
    expect(events.at(-1)).toEqual({
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
        durationMs: 14,
      },
    })
  },
)

test(
  [
    'given the mixed fixture',
    'when parsed',
    "it should attach bun's snippet and stack to the following fail event, not the preceding pass",
  ].join(', '),
  async () => {
    // given
    const input = linesOf(mixedResultsFixture)

    // when
    const events = await collect(parseRun(input))
    const testEvents = events.filter(
      (event): event is Extract<TRunEvent, { type: 'test' }> =>
        event.type === 'test',
    )
    const topLevel = testEvents.find((event) => event.name === 'top level')
    const throws = testEvents.find((event) => event.name === 'throws')

    // then
    expect(topLevel?.diagnostics).toEqual([])
    expect(
      throws?.diagnostics.some((line) => line.includes('error: boom')),
    ).toBe(true)
    expect(
      throws?.diagnostics.some((line) => line.includes('second line')),
    ).toBe(true)
  },
)

test(
  [
    'given the coverage fixture',
    'when parsed',
    'it should emit the coverage table as a single passthrough event and no test events contain a pipe',
  ].join(', '),
  async () => {
    // given
    const input = linesOf(coverageFixture)

    // when
    const events = await collect(parseRun(input))
    const passthroughs = events.filter(
      (event): event is Extract<TRunEvent, { type: 'passthrough' }> =>
        event.type === 'passthrough',
    )
    const coverageEvents = passthroughs.filter(
      (event) => event.kind === 'coverage',
    )
    const testEvents = events.filter(
      (event): event is Extract<TRunEvent, { type: 'test' }> =>
        event.type === 'test',
    )

    // then
    expect(coverageEvents).toHaveLength(1)
    expect(
      coverageEvents[0]?.lines.some((line) => line.includes('All files')),
    ).toBe(true)
    expect(testEvents.every((event) => !event.name.includes('|'))).toBe(true)
  },
)

test(
  [
    'given a module that fails to import',
    'when parsed',
    'it should emit an unhandled-error event with no matching fail event',
  ].join(', '),
  async () => {
    // given
    const input = linesOf(unhandledErrorFixture)

    // when
    const events = await collect(parseRun(input))
    const unhandled = events.find(
      (event): event is Extract<TRunEvent, { type: 'unhandled-error' }> =>
        event.type === 'unhandled-error',
    )

    // then
    expect(unhandled?.file).toBe('src/e.test.ts')
    expect(unhandled?.message).toBe(
      "Cannot find module './nope.ts' from '/private/tmp/buntap-fixtures-85186/src/e.test.ts'",
    )
    expect(events.some((event) => event.type === 'test')).toBe(false)
  },
)

test(
  [
    'given a test that logs before passing',
    'when parsed',
    "it should attach the log line to the pass event's diagnostics",
  ].join(', '),
  async () => {
    // given
    const input = linesOf(consoleLogBeforePassFixture)

    // when
    const events = await collect(parseRun(input))
    const passEvent = events.find(
      (event): event is Extract<TRunEvent, { type: 'test' }> =>
        event.type === 'test',
    )

    // then
    expect(passEvent?.diagnostics).toEqual(['hello from test'])
  },
)

test(
  [
    'given an empty stream',
    'when parsed',
    'it should emit a single run-end with summarySeen false',
  ].join(', '),
  async () => {
    // given
    const input = linesOf('')

    // when
    const events = await collect(parseRun(input))

    // then
    expect(events).toEqual([
      {
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
      },
    ])
  },
)

test(
  [
    'given stray output with no trailing result line',
    'when the stream ends',
    'it should flush it as a passthrough output event',
  ].join(', '),
  () => {
    // given
    const withBuffer = {
      ...initialParseState,
      diagnostics: ['stray line one', 'stray line two'],
    }

    // when
    const events = finalizeParse(withBuffer)

    // then
    expect(events[0]).toEqual({
      type: 'passthrough',
      kind: 'output',
      lines: ['stray line one', 'stray line two'],
    })
  },
)

test(
  [
    'given a coverage table never closed by a blank line',
    'when the stream ends',
    'it should flush the captured lines rather than drop them',
  ].join(', '),
  () => {
    // given
    const withOpenCoverage = {
      ...initialParseState,
      coverage: { active: true, lines: ['------|------', 'All files | 1 |'] },
    }

    // when
    const events = finalizeParse(withOpenCoverage)

    // then
    expect(events).toContainEqual({
      type: 'passthrough',
      kind: 'coverage',
      lines: ['------|------', 'All files | 1 |'],
    })
  },
)

test(
  [
    'given an unhandled-error block never closed by its final rule',
    'when the stream ends',
    'it should flush the captured lines as output rather than drop them',
  ].join(', '),
  () => {
    // given
    const withOpenBlock = {
      ...initialParseState,
      unhandledError: { active: true, openSeen: true, lines: ['error: boom'] },
    }

    // when
    const events = finalizeParse(withOpenBlock)

    // then
    expect(events).toContainEqual({
      type: 'passthrough',
      kind: 'output',
      lines: ['error: boom'],
    })
  },
)

test(
  [
    'given a dash rule encountered outside any capture block',
    'when stepped',
    'it should be buffered as a diagnostic, not treated specially',
  ].join(', '),
  () => {
    // given
    // when
    const result = stepLine(initialParseState, '------------------')

    // then
    expect(result.state.diagnostics).toEqual(['------------------'])
    expect(result.events).toEqual([])
  },
)

test(
  [
    'given an unhandled-error block whose content has no error: line',
    'when it closes',
    'it should fall back to the file as the message',
  ].join(', '),
  () => {
    // given
    const withOpenBlock = {
      ...initialParseState,
      currentFile: 'src/weird.test.ts',
      unhandledError: {
        active: true,
        openSeen: true,
        lines: ['some other diagnostic'],
      },
    }

    // when
    const result = stepLine(withOpenBlock, '-------------------------------')

    // then
    expect(result.events).toEqual([
      {
        type: 'unhandled-error',
        file: 'src/weird.test.ts',
        message: 'src/weird.test.ts',
        diagnostics: ['some other diagnostic'],
      },
    ])
  },
)
