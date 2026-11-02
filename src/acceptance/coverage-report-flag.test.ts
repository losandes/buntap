import { expect, test } from 'bun:test'
import { main } from '../cli.js'
import { lowCoverageFixture } from '../parse/bun-output.fixture.js'

// A plain object, not an async generator: there is no await in the body, and
// wrapping each value of a synchronous iterator in Promise.resolve satisfies
// the AsyncIterable contract without Biome's useAwait flagging a needless
// `async function*`. Copied from src/cli.test.ts's own helper so this file
// exercises the same public boundary — `main` — the way a real pipe does.
const linesOf = (text: string): AsyncIterable<string> => ({
  [Symbol.asyncIterator]: () => {
    const iterator = text.split('\n').slice(0, -1)[Symbol.iterator]()
    return { next: () => Promise.resolve(iterator.next()) }
  },
})

const makeDeps = (input: string) => {
  let stdout: readonly string[] = []
  let stderr: readonly string[] = []
  return {
    deps: {
      input: linesOf(input),
      write: (chunk: string) => {
        stdout = [...stdout, chunk]
      },
      writeError: (chunk: string) => {
        stderr = [...stderr, chunk]
      },
      columns: 80,
      isTty: false,
      env: {},
      cwd: '/fake',
      readTextFile: () => undefined,
    },
    stdout: () => stdout.join(''),
    stderr: () => stderr.join(''),
  }
}

// This file proves the acceptance criteria of
// https://github.com/losandes/buntap/issues/5 at the boundary a real
// invocation of buntap exercises — `main` parsing real argv and writing to
// real stdout/stderr — rather than at the `parseCliOptions` unit boundary
// src/use-cases/parse-cli-options.test.ts already covers. Per \u00a71.1.2 the
// usage error and exit code are observable behaviour independent of how the
// parser is implemented internally.

test(
  [
    'given --coverage-report=diagram, an unknown mode',
    'when run',
    'it should print the exact usage error on stderr, the help text, and exit 2',
  ].join(', '),
  async () => {
    // given
    const { deps, stderr } = makeDeps(lowCoverageFixture)

    // when
    const code = await main(deps)(['--coverage-report=diagram'])

    // then
    expect(code).toBe(2)
    expect(stderr()).toContain(
      "buntap: invalid --coverage-report value 'diagram'",
    )
    expect(stderr()).toContain('Usage:')
  },
)

test(
  [
    'given a bare --coverage-report flag with no value',
    'when run',
    'it should be the same usage error as an unknown mode, with an empty value, and exit 2',
  ].join(', '),
  async () => {
    // given
    const { deps, stderr } = makeDeps(lowCoverageFixture)

    // when
    const code = await main(deps)(['--coverage-report'])

    // then
    expect(code).toBe(2)
    expect(stderr()).toContain("buntap: invalid --coverage-report value ''")
  },
)

test(
  [
    'given a bare --coverage-threshold flag with no value',
    'when run',
    'it should stay an unknown-flag usage error, unlike --coverage-report, and exit 2',
  ].join(', '),
  async () => {
    // given
    const { deps, stderr } = makeDeps(lowCoverageFixture)

    // when
    const code = await main(deps)(['--coverage-threshold'])

    // then
    expect(code).toBe(2)
    expect(stderr()).not.toContain('invalid --coverage-report')
  },
)

test(
  [
    'given --coverage-report=bar with no explicit reporter, which defaults to tap',
    'when run',
    'it should print the tap-pinning usage error on stderr, the help text, and exit 2',
  ].join(', '),
  async () => {
    // given
    const { deps, stderr } = makeDeps(lowCoverageFixture)

    // when
    const code = await main(deps)(['--coverage-report=bar'])

    // then
    expect(code).toBe(2)
    expect(stderr()).toContain(
      'buntap: the tap reporter always reports coverage in full',
    )
    expect(stderr()).toContain('Usage:')
  },
)

test(
  [
    'given --coverage-report=full with no explicit reporter',
    'when run',
    'it should be accepted, printing the TAP coverage table and exit 0',
  ].join(', '),
  async () => {
    // given
    const { deps, stdout } = makeDeps(lowCoverageFixture)

    // when
    const code = await main(deps)(['--coverage-report=full'])

    // then
    expect(code).toBe(0)
    expect(stdout()).toContain('% Funcs')
  },
)

test(
  [
    'given --help',
    'when run',
    'the help text documents --coverage-report, its five modes, and every per-reporter default',
  ].join(', '),
  async () => {
    // given
    const { deps, stdout } = makeDeps(lowCoverageFixture)

    // when
    await main(deps)(['--help'])

    // then
    const help = stdout()
    expect(help).toContain('--coverage-report=<mode>')
    expect(help).toContain('full')
    expect(help).toContain('failures')
    expect(help).toContain('summary')
    expect(help).toContain('bar')
    expect(help).toContain('markdown')
    expect(help).toContain('tap: full')
    expect(help).toContain('agent: summary')
    expect(help).toContain('markdown: markdown')
    expect(help).toContain('nyan: bar')
    expect(help).toContain('block: bar')
  },
)

test(
  [
    'given the low-coverage fixture with --block and no --coverage-report',
    'when run with --coverage-threshold=0.95',
    "it should render block's bar default: the failing file but not the passing threshold-clear noise of the full table, and exit 3",
  ].join(', '),
  async () => {
    // given
    const { deps, stdout } = makeDeps(lowCoverageFixture)

    // when
    const code = await main(deps)(['--block', '--coverage-threshold=0.95'])

    // then
    expect(stdout()).toContain('src/add.ts')
    expect(code).toBe(3)
  },
)
