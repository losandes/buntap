import { expect, test } from 'bun:test'
import { formatPairedCoverageTable } from '../lib/format-paired-coverage-table.js'
import { parseCoverageTable } from '../parse/parse-coverage-table.js'
import type { TChildHandle, TChildResult } from './bunt-runner.js'
import { runPaired, type TPairedRunnerDeps } from './paired-runner.js'
import type { TSpawnOptions } from './spawn-bun-test.js'

const chunks = (text: string): AsyncIterable<string> => ({
  [Symbol.asyncIterator]: () => {
    const values = [text][Symbol.iterator]()
    return { next: () => Promise.resolve(values.next()) }
  },
})
const child = (
  text: string,
  result: TChildResult = { code: 0, signal: null },
): TChildHandle => ({
  stdout: chunks(text),
  stderr: chunks(''),
  exited: Promise.resolve(result),
  kill: () => undefined,
})
const output = (file: string, pct = 100, fail = 0): string =>
  [
    'bun test v1.4.4 (38afee6c8)',
    '',
    `${file.replace('.ts', '.test.ts')}:`,
    `(pass) works [1.00ms]`,
    ...formatPairedCoverageTable([
      { file, functionsPct: pct, linesPct: pct, uncovered: ['4'] },
    ]),
    '',
    ' 1 pass',
    ` ${fail} fail`,
    ' 2 skip',
    ' 3 todo',
    ' 4 error',
    ' 5 expect() calls',
    'Ran 6 tests across 1 file. [7.00ms]',
    '',
  ].join('\n')

const setup = (
  children: readonly TChildHandle[],
  overrides: Partial<TPairedRunnerDeps> = {},
) => {
  let written = ''
  let errors = ''
  let calls: readonly Readonly<{
    argv: readonly string[]
    options: TSpawnOptions | undefined
  }>[] = []
  let signalHandler: ((signal: NodeJS.Signals) => void) | undefined
  let unregistered = false
  let ticks = 0
  const deps: TPairedRunnerDeps = {
    spawn: (argv: readonly string[], options?: TSpawnOptions) => {
      const next = children[calls.length]
      calls = [...calls, { argv, options }]
      if (next === undefined) throw new Error('unexpected spawn')
      return next
    },
    write: (chunk) => {
      written += chunk
    },
    writeError: (chunk) => {
      errors += chunk
    },
    onSignal: (handler) => {
      signalHandler = handler
      return () => {
        unregistered = true
      }
    },
    now: () => ticks++ * 10,
    fileExists: () => true,
    cwd: '/fake',
    pathKind: () => undefined,
    listDir: () => [],
    readTextFile: () => undefined,
    defaultConcurrency: 2,
    ...overrides,
  }
  return {
    deps,
    events: () =>
      written
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line)),
    errors: () => errors,
    calls: () => calls,
    signal: (signal: NodeJS.Signals) => signalHandler?.(signal),
    unregistered: () => unregistered,
  }
}
const args = {
  mode: 'paired' as const,
  argv: ['--paired', 'src', '--timeout=5'],
  flags: ['--timeout=5'],
  filters: ['src'],
  exempt: [],
  concurrency: undefined,
}

test(
  [
    'given two discovered pairs and coverage-only child exit failures',
    'when running paired coverage',
    'it should isolate argv and coverage while summing all totals and emitting one summary',
  ].join(', '),
  async () => {
    // given
    const harness = setup([
      child('src/z.test.ts:\nsrc/a.test.ts:\nSearched 2 files\n', {
        code: 1,
        signal: null,
      }),
      child(output('src/z.ts', 60), { code: 1, signal: null }),
      child(output('src/a.ts', 100)),
    ])
    // when
    const code = await runPaired(harness.deps)(args)
    // then
    const events = harness.events()
    expect(harness.calls()).toEqual([
      {
        argv: ['--timeout=5', 'src', '--test-name-pattern=(?!)'],
        options: { omitEnv: ['CLAUDECODE', 'AGENT', 'REPL_ID'] },
      },
      {
        argv: ['--timeout=5', '--coverage', '--', './src/z.test.ts'],
        options: undefined,
      },
      {
        argv: ['--timeout=5', '--coverage', '--', './src/a.test.ts'],
        options: undefined,
      },
    ])
    expect(events[0]).toEqual({ v: 1, type: 'runner-start', argv: args.argv })
    expect(events.filter((event) => event.type === 'run-start')).toHaveLength(1)
    const coverage = events.filter((event) => event.kind === 'coverage')
    expect(coverage).toHaveLength(1)
    expect(parseCoverageTable(coverage[0].lines)).toEqual([
      { file: 'src/a.ts', functionsPct: 100, linesPct: 100, uncovered: ['4'] },
      { file: 'src/z.ts', functionsPct: 60, linesPct: 60, uncovered: ['4'] },
    ])
    expect(events.at(-2)).toEqual({
      v: 1,
      type: 'run-end',
      summarySeen: true,
      totals: {
        pass: 2,
        fail: 0,
        skip: 4,
        todo: 6,
        errors: 8,
        expectCalls: 10,
        tests: 12,
        files: 2,
        durationMs: 10,
      },
    })
    expect(events.at(-1)).toEqual({
      v: 1,
      type: 'runner-exit',
      code: 0,
      signal: null,
    })
    expect(code).toBe(1)
    expect(harness.unregistered()).toBe(true)
  },
)

for (const { name, text, result, expectedCode } of [
  {
    name: 'summary with nonzero process code',
    text: ' 1 pass\n 0 fail\nRan 1 test across 1 file.\n',
    result: { code: 5, signal: null },
    expectedCode: 0,
  },
  {
    name: 'failed tests',
    text: ' 0 pass\n 1 fail\nRan 1 test across 1 file.\n',
    result: { code: 1, signal: null },
    expectedCode: 1,
  },
  {
    name: 'incomplete process with code zero',
    text: 'error: broken\n',
    result: { code: 0, signal: null },
    expectedCode: 1,
  },
  {
    name: 'incomplete process without code',
    text: '',
    result: { code: null, signal: null },
    expectedCode: 1,
  },
  {
    name: 'incomplete process with nonzero code',
    text: '',
    result: { code: 7, signal: null },
    expectedCode: 7,
  },
  {
    name: 'signalled process',
    text: '',
    result: { code: null, signal: 'SIGTERM' },
    expectedCode: 1,
  },
]) {
  test(
    [
      `given a ${name}`,
      'when running a pair',
      'it should distinguish test verdicts from infrastructure exits',
    ].join(', '),
    async () => {
      // given
      const harness = setup([child('src/a.test.ts:\n'), child(text, result)])
      // when
      const code = await runPaired(harness.deps)(args)
      // then
      expect(code).toBe(expectedCode)
      expect(harness.events().at(-1)).toEqual({
        v: 1,
        type: 'runner-exit',
        code:
          result.signal !== null
            ? null
            : text.includes('Ran ')
              ? 0
              : expectedCode,
        signal: result.signal,
      })
      const coverage = harness
        .events()
        .find((event) => event.kind === 'coverage')
      if (text.includes('Ran ')) {
        expect(parseCoverageTable(coverage.lines)).toEqual([
          { file: 'src/a.ts', functionsPct: 0, linesPct: 0, uncovered: [] },
        ])
      } else {
        expect(coverage).toBeUndefined()
        expect(harness.events().at(-2).summarySeen).toBe(false)
      }
    },
  )
}

for (const file of ['src/a.spec.ts', 'src/a_test.ts', 'src/missing.test.ts']) {
  test(
    [
      `given unpaired test ${file}`,
      'when it completes with unrelated coverage',
      'it should emit no coverage table',
    ].join(', '),
    async () => {
      // given
      const harness = setup(
        [child(`${file}:\n`), child(output('src/other.ts'))],
        { fileExists: () => false },
      )
      // when
      await runPaired(harness.deps)(args)
      // then
      expect(
        harness.events().filter((event) => event.kind === 'coverage'),
      ).toEqual([])
    },
  )
}

for (const result of [
  { code: 0, signal: null },
  { code: null, signal: null },
  { code: 8, signal: null },
  { code: null, signal: 'SIGINT' },
]) {
  test(
    [
      `given no matching files and discovery result ${JSON.stringify(result)}`,
      'when running paired coverage',
      'it should report discovery output and preserve an abnormal result',
    ].join(', '),
    async () => {
      // given
      const harness = setup([
        child(
          'The following filters did not match any test files:\n zzz\n',
          result,
        ),
      ])
      // when
      const code = await runPaired(harness.deps)(args)
      // then
      expect(code).toBe(result.code || 1)
      expect(harness.errors()).toBe(
        'bunt: no test files matched\nThe following filters did not match any test files:\n zzz\n',
      )
      expect(harness.events()).toEqual([
        { v: 1, type: 'runner-start', argv: args.argv },
        { v: 1, type: 'paired-unresolved', untested: [], unmatched: ['src'] },
        {
          v: 1,
          type: 'runner-exit',
          code: result.signal === null ? result.code || 1 : result.code,
          signal: result.signal,
        },
      ])
    },
  )
}

test(
  [
    'given discovery with suppressed file headers',
    'when the searched count does not match',
    'it should report an infrastructure error and spawn no tests',
  ].join(', '),
  async () => {
    // given
    const harness = setup([child('Searched 4 files\n')])
    // when
    const code = await runPaired(harness.deps)(args)
    // then
    expect(code).toBe(2)
    expect(harness.calls()).toHaveLength(1)
    expect(harness.errors()).toBe(
      'bunt: could not list the test files bun matched (bun searched 4, bunt recognised 0)\n',
    )
    expect(harness.events().map((event) => event.type)).toEqual([
      'runner-start',
      'runner-exit',
    ])
  },
)

for (const {
  name,
  sourceOnly,
  pass,
  untested,
  discoveryCode,
  signal,
  expected,
} of [
  { name: 'empty discovery', expected: 1 },
  { name: 'pass with empty discovery', pass: true, expected: 0 },
  { name: 'exempt source only', sourceOnly: true, expected: 1 },
  {
    name: 'pass with exempt source only',
    sourceOnly: true,
    pass: true,
    expected: 0,
  },
  {
    name: 'untested source only',
    sourceOnly: true,
    untested: true,
    expected: 4,
  },
  {
    name: 'pass with untested source only',
    sourceOnly: true,
    untested: true,
    pass: true,
    expected: 4,
  },
  { name: 'untested with empty discovery', untested: true, expected: 4 },
  { name: 'runner four with empty discovery', discoveryCode: 4, expected: 2 },
  { name: 'signal with empty discovery', signal: 'SIGINT', expected: 0 },
  {
    name: 'signal and runner four with empty discovery',
    discoveryCode: 4,
    signal: 'SIGINT',
    expected: 2,
  },
] as readonly Readonly<{
  name: string
  sourceOnly?: boolean
  pass?: boolean
  untested?: boolean
  discoveryCode?: number
  signal?: string
  expected: number
}>[]) {
  test(
    [
      `given ${name}`,
      'when paired selection is empty',
      'it should distinguish an untested source from an empty selection and keep the real wire exit',
    ].join(', '),
    async () => {
      // given
      const harness = setup(
        sourceOnly
          ? []
          : [child('', { code: discoveryCode ?? 0, signal: signal ?? null })],
        {
          pathKind: (path) => (path === 'src/lonely.ts' ? 'file' : undefined),
        },
      )
      const selected = {
        ...args,
        flags: pass ? ['--pass-with-no-tests'] : [],
        filters: sourceOnly
          ? ['src/lonely.ts']
          : [...(untested ? ['src/lonely.ts'] : []), 'missing'],
        exempt: untested ? [] : ['**/lonely.ts'],
      }
      // when
      const actual = await runPaired(harness.deps)(selected)
      // then
      expect(actual).toBe(expected)
      expect(harness.calls()).toHaveLength(sourceOnly ? 0 : 1)
      expect(harness.events().at(-1)).toEqual({
        v: 1,
        type: 'runner-exit',
        code: signal
          ? (discoveryCode ?? 0)
          : untested
            ? 0
            : (discoveryCode ?? (pass ? 0 : 1)),
        signal: signal ?? null,
      })
      expect(harness.unregistered()).toBe(true)
    },
  )
}

for (const untested of [false, true]) {
  test(
    [
      `given a two-test family with runner-only exit four and untested=${untested}`,
      'when running source-only arguments',
      'it should skip discovery and run the whole family with a truthful wire code',
    ].join(', '),
    async () => {
      // given
      const harness = setup([child('', { code: 4, signal: null })], {
        pathKind: () => 'file',
        fileExists: (path) => path === 'src/calc.ts',
        listDir: () => ['calc.test.ts', 'calc.driver.test.ts'],
      })
      // when
      const actual = await runPaired(harness.deps)({
        ...args,
        flags: [],
        filters: ['src/calc.ts', ...(untested ? ['src/lonely.ts'] : [])],
      })
      // then
      expect(actual).toBe(untested ? 4 : 2)
      expect(harness.calls()).toEqual([
        {
          argv: [
            '--coverage',
            '--',
            './src/calc.driver.test.ts',
            './src/calc.test.ts',
          ],
          options: undefined,
        },
      ])
      expect(harness.events().at(-1)).toEqual({
        v: 1,
        type: 'runner-exit',
        code: 4,
        signal: null,
      })
      if (untested) expect(harness.events()[1].type).toBe('paired-unresolved')
    },
  )
}

const deferred = <T>() => {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

test(
  [
    'given a slow first file and a blocked final file with concurrency two',
    'when the middle file finishes first',
    'it should forward contiguous events in discovery order before the final file finishes',
  ].join(', '),
  async () => {
    // given
    const firstExit = deferred<TChildResult>()
    const lastExit = deferred<TChildResult>()
    const middleDone = deferred<boolean>()
    const firstForwarded = deferred<boolean>()
    let written = ''
    const harness = setup(
      [
        child('src/a.test.ts:\nsrc/b.test.ts:\nsrc/c.test.ts:\n'),
        { ...child(output('src/a.ts')), exited: firstExit.promise },
        {
          ...child(output('src/b.ts')),
          exited: Promise.resolve({ code: 0, signal: null }).then((result) => {
            middleDone.resolve(true)
            return result
          }),
        },
        { ...child(output('src/c.ts')), exited: lastExit.promise },
      ],
      {
        write: (chunk) => {
          written += chunk
          if (chunk.includes('"type":"file-start","path":"src/b.test.ts"'))
            firstForwarded.resolve(true)
        },
      },
    )
    // when
    const running = runPaired(harness.deps)(args)
    await middleDone.promise
    expect(written).not.toContain('file-start')
    firstExit.resolve({ code: 0, signal: null })
    await firstForwarded.promise
    // then
    expect(written.indexOf('src/a.test.ts')).toBeLessThan(
      written.indexOf('src/b.test.ts'),
    )
    expect(written).not.toContain('src/c.test.ts')
    lastExit.resolve({ code: 0, signal: null })
    await running
    expect(written).toContain('src/c.test.ts')
  },
)

test(
  [
    'given live children and a queued test file',
    'when bunt receives a signal',
    'it should kill every live child and never spawn the queued test',
  ].join(', '),
  async () => {
    // given
    const exit = deferred<TChildResult>()
    const spawned = deferred<boolean>()
    let killed: readonly string[] = []
    let count = 0
    const harness = setup([], {
      spawn: () => {
        count += 1
        if (count === 1)
          return child('src/a.test.ts:\nsrc/b.test.ts:\nsrc/c.test.ts:\n')
        if (count === 3) spawned.resolve(true)
        return {
          ...child(output('src/a.ts')),
          exited: exit.promise,
          kill: (signal) => {
            killed = [...killed, signal]
          },
        }
      },
    })
    // when
    const running = runPaired(harness.deps)(args)
    await spawned.promise
    harness.signal('SIGINT')
    exit.resolve({ code: null, signal: 'SIGTERM' })
    const code = await running
    // then
    expect(killed).toEqual(['SIGINT', 'SIGINT'])
    expect(count).toBe(3)
    expect(code).toBe(1)
    expect(harness.events().at(-1)).toEqual({
      v: 1,
      type: 'runner-exit',
      code: null,
      signal: 'SIGINT',
    })
  },
)

test(
  [
    'given defects collecting two test-file processes',
    'when running with one worker',
    'it should finish later work and propagate every defect before unregistering',
  ].join(', '),
  async () => {
    // given
    const first = new Error('first spawn defect')
    const second = new Error('second spawn defect')
    const harness = setup([], {
      spawn: (argv) => {
        if (argv.includes('--test-name-pattern=(?!)'))
          return child('src/a.test.ts:\nsrc/b.test.ts:\nsrc/c.test.ts:\n')
        if (argv.includes('./src/a.test.ts')) throw first
        if (argv.includes('./src/b.test.ts')) throw second
        return child(output('src/c.ts'))
      },
    })
    // when
    const running = runPaired(harness.deps)({ ...args, concurrency: 1 })
    // then
    await expect(running).rejects.toMatchObject({ errors: [first, second] })
    expect(
      harness.events().some((event) => event.path === 'src/c.test.ts'),
    ).toBe(true)
    expect(harness.unregistered()).toBe(true)
  },
)
