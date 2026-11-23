import { expect, test } from 'bun:test'
import { main } from '../cli.js'
import { formatPairedCoverageTable } from '../lib/format-paired-coverage-table.js'
import { parseCoverageTable } from '../parse/parse-coverage-table.js'
import { decodeProtocolLine } from '../protocol/decode-protocol-line.js'
import { buntMain } from '../runner/bunt-main.js'
import type { TPairedRunnerDeps } from '../runner/paired-runner.js'

const iterable = (values: readonly string[]): AsyncIterable<string> => ({
  [Symbol.asyncIterator]: () => {
    const iterator = values[Symbol.iterator]()
    return { next: () => Promise.resolve(iterator.next()) }
  },
})
const ignore = () => undefined

type TScenario = Readonly<{
  name: string
  filters: readonly string[]
  code: number
  tests: readonly string[]
  untested?: readonly string[]
  unmatched?: readonly string[]
  flags?: readonly string[]
  toml?: string
  fails?: boolean
  pct?: number
  incomplete?: boolean
  single?: boolean
  variantOnly?: boolean
}>
const family = ['src/calc.driver.test.ts', 'src/calc.test.ts']
const scenarios: readonly TScenario[] = [
  {
    name: '@SC1 A changed source runs its whole family of tests',
    filters: ['src/calc.ts'],
    code: 0,
    tests: family,
  },
  {
    name: '@SC2 A mix of sources, tests and unmatched paths is resolved one argument at a time',
    filters: ['src/calc.ts', 'src/calculator.test.ts', './src/lonely.ts'],
    code: 4,
    tests: ['src/calculator.test.ts', ...family],
    untested: ['./src/lonely.ts'],
  },
  {
    name: '@SC3 An untested source is named even when the other tests pass',
    filters: ['src/calc.ts', './src/lonely.ts'],
    code: 4,
    tests: family,
    untested: ['./src/lonely.ts'],
  },
  {
    name: '@SC3 An untested source is named even when another test fails',
    filters: ['src/calc.ts', 'src/lonely.ts'],
    code: 1,
    tests: family,
    untested: ['src/lonely.ts'],
    fails: true,
  },
  {
    name: '@SC4 An untested source alongside passing tests is not a success',
    filters: ['src/calc.ts', 'src/lonely.ts'],
    code: 4,
    tests: family,
    untested: ['src/lonely.ts'],
  },
  {
    name: '@SC4 A commit that touches only untested sources is not reported as a test failure',
    filters: ['src/lonely.ts', 'src/other.ts'],
    code: 4,
    tests: [],
    untested: ['src/lonely.ts', 'src/other.ts'],
  },
  {
    name: '@SC4 Passing with no tests does not excuse an untested source',
    filters: ['src/lonely.ts'],
    flags: ['--pass-with-no-tests'],
    code: 4,
    tests: [],
    untested: ['src/lonely.ts'],
  },
  {
    name: '@SC5 Nothing to run passes when the caller asked for that',
    filters: ['src/gone.ts'],
    flags: ['--pass-with-no-tests'],
    code: 0,
    tests: [],
    unmatched: ['src/gone.ts'],
  },
  {
    name: '@SC5 Nothing to run fails when the caller did not ask for that',
    filters: ['src/gone.ts'],
    code: 1,
    tests: [],
    unmatched: ['src/gone.ts'],
  },
  {
    name: "@SC6 Coverage is judged across all of a source's tests",
    filters: ['src/calc.ts'],
    code: 0,
    tests: family,
  },
  {
    name: '@SC6 Naming one test file does not judge the source on that file alone',
    filters: ['src/calc.test.ts'],
    code: 0,
    tests: family,
  },
  {
    name: '@SC6 A source that its tests do not cover is still a gap',
    filters: ['src/calc.ts'],
    code: 3,
    tests: family,
    pct: 50,
  },
  {
    name: '@SC7 A declared source without tests does not change the result',
    filters: ['src/calc.ts', 'src/lonely.ts'],
    flags: ['--paired-exempt=**/lonely.ts'],
    code: 0,
    tests: family,
  },
  {
    name: '@SC7 A source the project excludes from coverage needs no declaration',
    filters: ['src/calc.ts', 'src/lonely.ts'],
    toml: '[test]\ncoveragePathIgnorePatterns = ["**/lonely.ts"]',
    code: 0,
    tests: family,
  },
  {
    name: '@SC8 A deleted path is mentioned and does not fail the run',
    filters: ['src/calc.ts', 'src/gone.ts'],
    code: 0,
    tests: family,
    unmatched: ['src/gone.ts'],
  },
  {
    name: '@SC9 A directory argument still selects the tests beneath it',
    filters: ['src'],
    code: 0,
    tests: ['src/calc.test.ts', 'src/calculator.test.ts'],
    single: true,
  },
  {
    name: '@SC4 runner-only exit four is reserved',
    filters: ['src/calc.ts'],
    code: 2,
    tests: family,
    incomplete: true,
  },
  {
    name: '@SC4 untested source wins over runner exit four',
    filters: ['src/calc.ts', 'src/lonely.ts'],
    code: 4,
    tests: family,
    incomplete: true,
    untested: ['src/lonely.ts'],
  },
  {
    name: '@SC6 variant-only family contributes coverage',
    filters: ['src/calc.ts'],
    code: 0,
    tests: ['src/calc.driver.test.ts'],
    variantOnly: true,
  },
]

for (const scenario of scenarios) {
  test(
    [
      `given ${scenario.name}`,
      'when bunt protocol output is piped into buntap',
      `it should run the selected families and return ${scenario.code}`,
    ].join(', '),
    async () => {
      // given
      const files = [
        'src/calc.ts',
        'src/calculator.ts',
        'src/lonely.ts',
        'src/other.ts',
        ...family.filter(
          (file) =>
            !(
              (scenario.single && file.includes('driver')) ||
              (scenario.variantOnly && file === 'src/calc.test.ts')
            ),
        ),
        'src/calculator.test.ts',
      ]
      let protocol = ''
      let calls: readonly (readonly string[])[] = []
      const deps: TPairedRunnerDeps = {
        cwd: '/fake',
        pathKind: (path) =>
          files.includes(path)
            ? 'file'
            : path === 'src'
              ? 'directory'
              : undefined,
        fileExists: (path) => files.includes(path),
        listDir: () => files.map((file) => file.slice(4)),
        readTextFile: () => scenario.toml,
        now: () => 0,
        defaultConcurrency: 2,
        onSignal: () => ignore,
        write: (chunk) => {
          protocol += chunk
        },
        writeError: ignore,
        spawn: (argv) => {
          calls = [...calls, argv]
          const discovery = argv.includes('--test-name-pattern=(?!)')
          const discovered = files.filter(
            (file) =>
              file.endsWith('.test.ts') &&
              scenario.filters.some((filter) => file.includes(filter)),
          )
          const tests = argv
            .filter((arg) => arg.startsWith('./'))
            .map((arg) => arg.slice(2))
          const source = tests[0]?.includes('calculator')
            ? 'src/calculator.ts'
            : 'src/calc.ts'
          const text = discovery
            ? `${discovered.map((file) => `${file}:`).join('\n')}\n`
            : scenario.incomplete
              ? ''
              : [
                  'bun test v1.4.4 (38afee6c8)',
                  '',
                  ...tests.flatMap((file) => [
                    `${file}:`,
                    `(${scenario.fails ? 'fail' : 'pass'}) ${file} [1.00ms]`,
                  ]),
                  ...formatPairedCoverageTable([
                    {
                      file: source,
                      functionsPct: scenario.pct ?? 100,
                      linesPct: scenario.pct ?? 100,
                      uncovered: [],
                    },
                  ]),
                  '',
                  ` ${scenario.fails ? 0 : tests.length} pass`,
                  ` ${scenario.fails ? tests.length : 0} fail`,
                  `Ran ${tests.length} tests across ${tests.length} files. [1.00ms]`,
                  '',
                ].join('\n')
          const code = discovery
            ? discovered.length === 0 && !argv.includes('--pass-with-no-tests')
              ? 1
              : 0
            : scenario.incomplete
              ? 4
              : scenario.fails
                ? 1
                : 0
          return {
            stdout: iterable([text]),
            stderr: iterable([]),
            exited: Promise.resolve({ code, signal: null }),
            kill: ignore,
          }
        },
      }
      const runnerCode = await buntMain(deps)([
        '--paired',
        ...scenario.filters,
        ...(scenario.flags ?? []),
      ])
      let stdout = ''
      let stderr = ''
      // when
      const actual = await main({
        input: iterable(protocol.trimEnd().split('\n')),
        write: (chunk) => {
          stdout += chunk
        },
        writeError: (chunk) => {
          stderr += chunk
        },
        cwd: '/fake',
        readTextFile: () => undefined,
        columns: 80,
        isTty: false,
        env: {},
      })([
        '--agent',
        '--no-color',
        '--coverage-threshold=90',
        '--coverage-report=full',
      ])
      // then
      expect(actual).toBe(scenario.code)
      expect(runnerCode).toBe(scenario.code === 3 ? 0 : scenario.code)
      const runCalls = calls.filter(
        (argv) => !argv.includes('--test-name-pattern=(?!)'),
      )
      expect(
        runCalls.flatMap((argv) =>
          argv.filter((arg) => arg.startsWith('./')).map((arg) => arg.slice(2)),
        ),
      ).toEqual([...scenario.tests])
      expect(calls.flat()).not.toContain('src/calc.ts')
      const events = protocol
        .trimEnd()
        .split('\n')
        .flatMap((line) => {
          const decoded = decodeProtocolLine(line)
          return decoded.status === 'ok' ? [decoded.data] : []
        })
      expect(
        events.flatMap((event) =>
          event.type === 'file-start' ? [event.path] : [],
        ),
      ).toEqual([...(scenario.incomplete ? [] : scenario.tests)])
      if (
        (scenario.untested?.length ?? 0) + (scenario.unmatched?.length ?? 0) >
        0
      ) {
        expect(events[1]?.type).toBe('paired-unresolved')
      } else {
        expect(events.some((event) => event.type === 'paired-unresolved')).toBe(
          false,
        )
      }
      const rows = parseCoverageTable(
        events.flatMap((event) =>
          event.type === 'passthrough' && event.kind === 'coverage'
            ? event.lines
            : [],
        ),
      )
      const sources = [
        ...new Set(
          scenario.tests.map((file) =>
            file.includes('calculator') ? 'src/calculator.ts' : 'src/calc.ts',
          ),
        ),
      ].toSorted()
      expect(rows).toEqual(
        scenario.incomplete
          ? []
          : sources.map((file) => ({
              file,
              functionsPct: scenario.pct ?? 100,
              linesPct: scenario.pct ?? 100,
              uncovered: [],
            })),
      )
      for (const path of scenario.untested ?? [])
        expect(stderr).toContain(`  ${path}\n`)
      for (const path of scenario.unmatched ?? [])
        expect(stderr).toContain(`  ${path}\n`)
      if ((scenario.untested?.length ?? 0) === 0)
        expect(stderr).not.toContain('source has no tests')
      if (scenario.code === 3) expect(stdout).toContain('COVERAGE FAIL')
      if (scenario.code === 2)
        expect(stderr).toEndWith(
          'buntap: bun exited 4 before reporting any tests - exiting 2\n',
        )
      if (scenario.tests.length === 0 && scenario.code === 0)
        expect(stdout).toContain('0 tests')
      if (scenario.tests.length > 0 && !scenario.incomplete) {
        expect(stdout).toContain(scenario.pct === 50 ? '50' : '100')
        expect(stdout).toContain(
          `${scenario.tests.length} tests, ${scenario.fails ? scenario.tests.length : 0} failed`,
        )
        expect(runCalls[0]).toEqual([
          '--coverage',
          '--',
          ...scenario.tests
            .slice(
              0,
              scenario.single
                ? 1
                : scenario.tests[0]?.includes('calculator')
                  ? 1
                  : scenario.tests.length,
            )
            .map((file) => `./${file}`),
        ])
      }
    },
  )
}
