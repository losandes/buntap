import { expect, test } from 'bun:test'
import { main } from './cli.js'
import {
  coverageFixture,
  lowCoverageFixture,
  mixedResultsFixture,
} from './parse/bun-output.fixture.js'

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

const makeDeps = (
  input: string,
  overrides: Readonly<{
    readTextFile?: (path: string) => string | undefined
  }> = {},
) => {
  // The two accumulators in this test double: `main` calls `write` and
  // `writeError` as a side-effecting callback over time, so collecting their
  // output cannot be expressed as a reduce.
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
      readTextFile: overrides.readTextFile ?? (() => undefined),
    },
    stdout: () => stdout.join(''),
    stderr: () => stderr.join(''),
  }
}

test(
  [
    'given the mixed results fixture',
    'when run with no flags',
    'it should print TAP output and exit 1 for the failures',
  ].join(', '),
  async () => {
    // given
    const { deps, stdout } = makeDeps(mixedResultsFixture)

    // when
    const code = await main(deps)([])

    // then
    expect(stdout().split('\n')[0]).toBe('TAP version 14')
    expect(stdout()).toContain('not ok')
    expect(code).toBe(1)
  },
)

test(
  ['given a clean fixture', 'when run with --agent', 'it should exit 0'].join(
    ', ',
  ),
  async () => {
    // given
    const cleanFixture = [
      'bun test v1.3.14 (0d9b296a)',
      '',
      'src/a.test.ts:',
      '(pass) adds [0.01ms]',
      '',
      ' 1 pass',
      ' 0 fail',
      ' 1 expect() calls',
      'Ran 1 test across 1 file. [1.00ms]',
      '',
    ].join('\n')
    const { deps, stdout } = makeDeps(cleanFixture)

    // when
    const code = await main(deps)(['--agent'])

    // then
    expect(code).toBe(0)
    expect(stdout().split('\n').filter(Boolean)).toHaveLength(1)
  },
)

test(
  [
    'given no summary line on stdin',
    'when run',
    'it should emit an empty TAP document, a hint on stderr, and exit 2',
  ].join(', '),
  async () => {
    // given
    const { deps, stdout, stderr } = makeDeps('')

    // when
    const code = await main(deps)([])

    // then
    expect(code).toBe(2)
    expect(stdout()).toBe(
      'TAP version 14\n1..0 # no bun test summary found on stdin\n',
    )
    expect(stderr()).toContain('bun test 2>&1 | buntap')
  },
)

test(
  [
    'given an unknown flag',
    'when run',
    'it should print usage on stderr and exit 2',
  ].join(', '),
  async () => {
    // given
    const { deps, stderr } = makeDeps(mixedResultsFixture)

    // when
    const code = await main(deps)(['--wat'])

    // then
    expect(code).toBe(2)
    expect(stderr()).toContain("unknown flag '--wat'")
    expect(stderr()).toContain('Usage:')
  },
)

test(
  [
    'given --help',
    'when run',
    'it should print usage on stdout and exit 0',
  ].join(', '),
  async () => {
    // given
    const { deps, stdout } = makeDeps(mixedResultsFixture)

    // when
    const code = await main(deps)(['--help'])

    // then
    expect(code).toBe(0)
    expect(stdout()).toContain('Usage:')
  },
)

test(
  [
    'given --version',
    'when run',
    'it should print the version on stdout and exit 0',
  ].join(', '),
  async () => {
    // given
    const { deps, stdout } = makeDeps(mixedResultsFixture)

    // when
    const code = await main(deps)(['--version'])

    // then
    expect(code).toBe(0)
    expect(stdout().trim()).toMatch(/^\d+\.\d+\.\d+$/)
  },
)

test(
  [
    'given --color',
    'when run with --block',
    'it should emit ANSI escape codes',
  ].join(', '),
  async () => {
    // given
    const { deps, stdout } = makeDeps(mixedResultsFixture)

    // when
    await main(deps)(['--block', '--color'])

    // then
    expect(stdout()).toContain('\u001b[')
  },
)

test(
  [
    'given --no-color',
    'when run with --block',
    'it should emit no ANSI escape codes',
  ].join(', '),
  async () => {
    // given
    const { deps, stdout } = makeDeps(mixedResultsFixture)

    // when
    await main(deps)(['--block', '--no-color'])

    // then
    expect(stdout()).not.toContain('\u001b[')
  },
)

test(
  [
    'given an isTty terminal with colour auto',
    'when run with --block',
    'it should emit ANSI escape codes',
  ].join(', '),
  async () => {
    // given
    const { deps, stdout } = makeDeps(mixedResultsFixture)

    // when
    await main({ ...deps, isTty: true })(['--block'])

    // then
    expect(stdout()).toContain('\u001b[')
  },
)

test(
  [
    'given NO_COLOR is set and the terminal is a tty',
    'when run with --block',
    'it should still emit no colour',
  ].join(', '),
  async () => {
    // given
    const { deps, stdout } = makeDeps(mixedResultsFixture)

    // when
    await main({ ...deps, isTty: true, env: { NO_COLOR: '1' } })(['--block'])

    // then
    expect(stdout()).not.toContain('\u001b[')
  },
)

test(
  [
    'given the tap reporter',
    'when colour is forced on',
    'it should still never emit ANSI escape codes',
  ].join(', '),
  async () => {
    // given
    const { deps, stdout } = makeDeps(mixedResultsFixture)

    // when
    await main(deps)(['--color'])

    // then
    expect(stdout()).not.toContain('\u001b[')
  },
)

const reporterModeFlags = [
  { label: 'default TAP', flags: [] as readonly string[] },
  { label: '--nyan', flags: ['--nyan'] },
  { label: '--markdown', flags: ['--markdown'] },
  { label: '--block', flags: ['--block'] },
  { label: '--agent', flags: ['--agent'] },
]

for (const { label, flags } of reporterModeFlags) {
  test(
    [
      `given the low-coverage fixture with ${label}`,
      'when run with --coverage-threshold=0.95',
      'it should print the coverage data and the failure signal, and exit 3',
    ].join(', '),
    async () => {
      // given
      const { deps, stdout } = makeDeps(lowCoverageFixture)

      // when
      const code = await main(deps)([...flags, '--coverage-threshold=0.95'])

      // then
      expect(stdout()).toContain('src/add.ts')
      expect(stdout()).toContain('COVERAGE FAIL')
      expect(code).toBe(3)
    },
  )
}

test(
  [
    'given the low-coverage fixture',
    'when run with a threshold taken from a fake bunfig.toml',
    'it should resolve the gate from the file and exit 3',
  ].join(', '),
  async () => {
    // given
    const { deps, stdout } = makeDeps(lowCoverageFixture, {
      readTextFile: () => '[test]\ncoverageThreshold = 0.95\n',
    })

    // when
    const code = await main(deps)([])

    // then
    expect(stdout()).toContain('COVERAGE FAIL')
    expect(code).toBe(3)
  },
)

test(
  [
    'given the low-coverage fixture',
    'when run with no threshold configured anywhere',
    'it should still print the table but exit 0',
  ].join(', '),
  async () => {
    // given
    const { deps, stdout } = makeDeps(lowCoverageFixture)

    // when
    const code = await main(deps)([])

    // then
    expect(stdout()).toContain('src/add.ts')
    expect(stdout()).not.toContain('COVERAGE FAIL')
    expect(code).toBe(0)
  },
)

test(
  [
    'given the fully-covered fixture',
    'when run with --coverage-threshold=0.95',
    'it should exit 0',
  ].join(', '),
  async () => {
    // given
    const { deps } = makeDeps(coverageFixture)

    // when
    const code = await main(deps)(['--coverage-threshold=0.95'])

    // then
    expect(code).toBe(0)
  },
)
