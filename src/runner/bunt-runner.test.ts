import { expect, test } from 'bun:test'
import { mixedResultsFixture } from '../parse/bun-output.fixture.js'
import type { TChildHandle, TChildResult } from './bunt-runner.js'
import { runBunt } from './bunt-runner.js'

/**
 * `readLines` expects raw chunks that may split anywhere, including inside a
 * line — so a fixture must arrive as one undifferentiated chunk carrying its
 * own newlines, not pre-split lines with the separators already removed.
 */
const asChunk = (text: string): AsyncIterable<string> => {
  let done = false
  return {
    [Symbol.asyncIterator]: () => ({
      next: () => {
        if (done) return Promise.resolve({ done: true, value: undefined })
        done = true
        return Promise.resolve({ done: false, value: text })
      },
    }),
  }
}

const empty: AsyncIterable<string> = {
  [Symbol.asyncIterator]: () => ({
    next: () => Promise.resolve({ done: true, value: undefined }),
  }),
}

const fakeChild = (
  stdout: string,
  result: TChildResult,
  overrides: Readonly<{ kill?: (signal: NodeJS.Signals) => void }> = {},
): TChildHandle => ({
  stdout: asChunk(stdout),
  stderr: empty,
  exited: Promise.resolve(result),
  kill: overrides.kill ?? (() => undefined),
})

const makeDeps = (
  child: TChildHandle,
  overrides: Readonly<{
    onSignal?: (handler: (signal: NodeJS.Signals) => void) => () => void
  }> = {},
) => {
  // A side-effecting callback collecting output over time, like cli.test.ts's
  // own test double — not a reduce, because `write` is called as events arrive.
  let written: readonly string[] = []
  return {
    deps: {
      spawn: () => child,
      write: (chunk: string) => {
        written = [...written, chunk]
      },
      onSignal: overrides.onSignal ?? (() => () => undefined),
    },
    lines: () =>
      written
        .join('')
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line)),
  }
}

test(
  [
    'given argv',
    'when the runner starts',
    'it should emit a runner-start line before anything else',
  ].join(', '),
  async () => {
    // given
    const child = fakeChild('', { code: 0, signal: null })
    const { deps, lines } = makeDeps(child)

    // when
    await runBunt(deps)(['src/lib', '--coverage'])

    // then
    expect(lines()[0]).toEqual({
      v: 1,
      type: 'runner-start',
      argv: ['src/lib', '--coverage'],
    })
  },
)

test(
  [
    "given the child's merged output",
    'when run',
    'it should emit one protocol line per parsed event, carrying v:1',
  ].join(', '),
  async () => {
    // given
    const child = fakeChild(mixedResultsFixture, { code: 1, signal: null })
    const { deps, lines } = makeDeps(child)

    // when
    await runBunt(deps)([])

    // then
    const types = lines().map((line) => line.type)
    expect(types).toContain('run-start')
    expect(types).toContain('test')
    expect(types).toContain('run-end')
    expect(lines().every((line) => line.v === 1)).toBe(true)
  },
)

test(
  [
    "given a failing test's console output and error stack trace",
    'when run',
    'it should carry that output as a JSON diagnostics array on the test event, never as a bare stdout line of its own',
  ].join(', '),
  async () => {
    // given
    const child = fakeChild(mixedResultsFixture, { code: 1, signal: null })
    const { deps, lines } = makeDeps(child)

    // when
    await runBunt(deps)([])

    // then
    const testEvents = lines().filter((line) => line.type === 'test')
    const failing = testEvents.find((line) => line.name === 'throws')
    expect(Array.isArray(failing.diagnostics)).toBe(true)
    expect(
      failing.diagnostics.some((line: string) => line.includes('boom')),
    ).toBe(true)
  },
)

test(
  [
    "given the child's own exit code and signal",
    'when run',
    'it should emit runner-exit last, carrying both, and exit with that code',
  ].join(', '),
  async () => {
    // given
    const child = fakeChild(mixedResultsFixture, { code: 1, signal: null })
    const { deps, lines } = makeDeps(child)

    // when
    const code = await runBunt(deps)([])

    // then
    expect(lines().at(-1)).toEqual({
      v: 1,
      type: 'runner-exit',
      code: 1,
      signal: null,
    })
    expect(code).toBe(1)
  },
)

test(
  [
    'given a registered signal handler',
    'when invoked',
    'it should forward the signal to the child',
  ].join(', '),
  async () => {
    // given
    let forwarded: NodeJS.Signals | undefined
    const child = fakeChild('', {
      code: null,
      signal: 'SIGINT',
    })
    const childWithKill: TChildHandle = {
      ...child,
      kill: (signal) => {
        forwarded = signal
      },
    }
    let registeredHandler: ((signal: NodeJS.Signals) => void) | undefined
    const { deps } = makeDeps(childWithKill, {
      onSignal: (handler) => {
        registeredHandler = handler
        return () => undefined
      },
    })

    // when
    await runBunt(deps)([])
    registeredHandler?.('SIGINT')

    // then
    expect(forwarded).toBe('SIGINT')
  },
)
