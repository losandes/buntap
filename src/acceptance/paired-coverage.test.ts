import { expect, test } from 'bun:test'
import { main } from '../cli.js'
import type { TChildHandle } from '../runner/bunt-runner.js'
import { runPaired } from '../runner/paired-runner.js'

const chunks = (text: string): AsyncIterable<string> => ({
  [Symbol.asyncIterator]: () => {
    const iterator = [text][Symbol.iterator]()
    return { next: () => Promise.resolve(iterator.next()) }
  },
})
const linesOf = (text: string): AsyncIterable<string> => ({
  [Symbol.asyncIterator]: () => {
    const iterator = text.trimEnd().split('\n')[Symbol.iterator]()
    return { next: () => Promise.resolve(iterator.next()) }
  },
})
const ignore = () => undefined

const child = (text: string): TChildHandle => ({
  stdout: chunks(text),
  stderr: chunks(''),
  // Simulate bun's own threshold causing nonzero exits, even on passing tests.
  exited: Promise.resolve({ code: 1, signal: null }),
  kill: ignore,
})

type TScenario = Readonly<{
  name: string
  functions: number
  lines: number
  minimum: number | undefined
  override?: number
  gap: boolean
  code: number
  other?: boolean
  outside?: boolean
  fails?: boolean
  absent?: boolean
}>
const scenarios: readonly TScenario[] = [
  {
    name: '@SC1 a source file is judged only by its own paired test file',
    functions: 60,
    lines: 60,
    minimum: 90,
    other: true,
    gap: true,
    code: 3,
  },
  {
    name: '@SC1 a source file that its paired test file covers well',
    functions: 95,
    lines: 95,
    minimum: 90,
    gap: false,
    code: 0,
  },
  {
    name: '@SC2 a source file whose paired test file is outside the run',
    functions: 10,
    lines: 10,
    minimum: 90,
    outside: true,
    gap: false,
    code: 0,
  },
  {
    name: '@SC3 a coverage gap with every test passing',
    functions: 60,
    lines: 60,
    minimum: 90,
    gap: true,
    code: 3,
  },
  {
    name: '@SC3 a failing test takes precedence over a coverage gap',
    functions: 60,
    lines: 60,
    minimum: 90,
    fails: true,
    gap: true,
    code: 1,
  },
  {
    name: '@SC4 a source file exactly at the coverage minimum',
    functions: 90,
    lines: 90,
    minimum: 90,
    gap: false,
    code: 0,
  },
  {
    name: '@SC4 a source file below the coverage minimum on one measure',
    functions: 95,
    lines: 89,
    minimum: 90,
    gap: true,
    code: 3,
  },
  {
    name: '@SC4 a minimum given for the run overrides the test configuration',
    functions: 60,
    lines: 60,
    minimum: 90,
    override: 50,
    gap: false,
    code: 0,
  },
  {
    name: '@SC4 no coverage minimum set',
    functions: 10,
    lines: 10,
    minimum: undefined,
    gap: false,
    code: 0,
  },
  {
    name: '@SC6 a source file that its paired test file never exercises',
    functions: 0,
    lines: 0,
    minimum: 90,
    absent: true,
    gap: true,
    code: 3,
  },
]

const testOutput = (
  scenario: TScenario,
  file: string,
  functions: number,
  lines: number,
): string =>
  [
    'bun test v1.4.4 (38afee6c8)',
    '',
    `${file}:`,
    scenario.fails ? '(fail) works [1.00ms]' : '(pass) works [1.00ms]',
    ...(scenario.absent
      ? []
      : [
          '------------|---------|---------|-------------------',
          'File        | % Funcs | % Lines | Uncovered Line #s',
          '------------|---------|---------|-------------------',
          `All files   | ${functions} | ${lines} |`,
          ` src/x.ts   | ${functions} | ${lines} | 4`,
          '------------|---------|---------|-------------------',
        ]),
    '',
    ` ${scenario.fails ? 0 : 1} pass`,
    ` ${scenario.fails ? 1 : 0} fail`,
    'Ran 1 test across 1 file. [1.00ms]',
    '',
  ].join('\n')

for (const scenario of scenarios) {
  test(
    [
      `given ${scenario.name}`,
      'when paired protocol output is piped into the agent reporter',
      `it should ${scenario.gap ? 'name the gap' : 'report no gap'} and exit ${scenario.code}`,
    ].join(', '),
    async () => {
      // given
      const files = scenario.outside
        ? ['src/other.test.ts']
        : ['src/x.test.ts', ...(scenario.other ? ['src/other.test.ts'] : [])]
      const children = [
        child(
          `${files.map((file) => `${file}:`).join('\n')}\nSearched ${files.length} files\n`,
        ),
        ...files.map((file, index) =>
          child(
            testOutput(
              scenario,
              file,
              index === 0 ? scenario.functions : 100,
              index === 0 ? scenario.lines : 100,
            ),
          ),
        ),
      ]
      let protocol = ''
      let spawned = 0
      const runnerCode = await runPaired({
        spawn: () => {
          const next = children[spawned++]
          if (next === undefined) throw new Error('unexpected spawn')
          return next
        },
        write: (chunk) => {
          protocol += chunk
        },
        writeError: ignore,
        onSignal: () => ignore,
        now: () => 0,
        defaultConcurrency: 2,
        fileExists: (file) => file === 'src/x.ts',
        cwd: '/fake',
        pathKind: () => undefined,
        listDir: () => [],
        readTextFile: () => undefined,
      })({
        mode: 'paired',
        argv: ['--paired'],
        flags: [],
        filters: [],
        exempt: [],
        concurrency: undefined,
      })
      let stdout = ''
      const deps = {
        input: linesOf(protocol),
        write: (chunk: string) => {
          stdout += chunk
        },
        writeError: ignore,
        columns: 80,
        isTty: false,
        env: {},
        cwd: '/fake',
        readTextFile: () =>
          scenario.minimum === undefined
            ? undefined
            : `[test]\ncoverageThreshold = ${scenario.minimum / 100}\n`,
      }
      // when
      const code = await main(deps)([
        '--agent',
        ...(scenario.override === undefined
          ? []
          : [`--coverage-threshold=${scenario.override}`]),
      ])
      // then
      expect(runnerCode).toBe(scenario.fails ? 1 : 0)
      expect(code).toBe(scenario.code)
      const gapNamed = stdout
        .split('\n')
        .some((line) => line.startsWith('  src/x.ts functions '))
      expect(gapNamed).toBe(scenario.gap)
      if (scenario.gap) expect(stdout).toContain('COVERAGE FAIL')
    },
  )
}
