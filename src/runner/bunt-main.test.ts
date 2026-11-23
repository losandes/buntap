import { expect, test } from 'bun:test'
import { buntMain } from './bunt-main.js'

const chunks = (text: string): AsyncIterable<string> => ({
  [Symbol.asyncIterator]: () => {
    const iterator = [text][Symbol.iterator]()
    return { next: () => Promise.resolve(iterator.next()) }
  },
})
const ignore = () => undefined

const setup = () => {
  let written = ''
  let errors = ''
  let calls: readonly (readonly string[])[] = []
  return {
    deps: {
      spawn: (argv: readonly string[]) => {
        calls = [...calls, argv]
        return {
          stdout: chunks(
            argv.includes('--test-name-pattern=(?!)')
              ? 'src/a.test.ts:\n'
              : ' 1 pass\n 0 fail\nRan 1 test across 1 file.\n',
          ),
          stderr: chunks(''),
          exited: Promise.resolve({ code: 0, signal: null }),
          kill: ignore,
        }
      },
      write: (chunk: string) => {
        written += chunk
      },
      writeError: (chunk: string) => {
        errors += chunk
      },
      onSignal: () => ignore,
      fileExists: () => false,
      cwd: '/fake',
      pathKind: () => undefined,
      listDir: () => [],
      readTextFile: () => undefined,
      now: () => 0,
      defaultConcurrency: 1,
    },
    written: () => written,
    errors: () => errors,
    calls: () => calls,
  }
}

test(
  [
    'given no paired flag and invalid paired-only arguments',
    'when invoking bunt',
    'it should pass argv unchanged through the existing runner',
  ].join(', '),
  async () => {
    // given
    const harness = setup()
    const argv = ['--paired-concurrency=0', '-t', 'works']
    // when
    const code = await buntMain(harness.deps)(argv)
    // then
    expect(code).toBe(0)
    expect(harness.calls()).toEqual([argv])
    expect(harness.errors()).toBe('')
  },
)

test(
  [
    'given the paired flag',
    'when invoking bunt',
    'it should discover files and run isolated coverage processes',
  ].join(', '),
  async () => {
    // given
    const harness = setup()
    // when
    const code = await buntMain(harness.deps)(['--paired', 'src'])
    // then
    expect(code).toBe(0)
    expect(harness.calls()).toEqual([
      ['src', '--test-name-pattern=(?!)'],
      ['--coverage', '--', './src/a.test.ts'],
    ])
    expect(harness.written()).toContain('runner-exit')
  },
)

for (const [arg, message] of [
  ['--', '--paired does not support a bare --'],
  [
    '--paired-concurrency=0',
    '--paired-concurrency must be a positive integer, got "0"',
  ],
  [
    '-t',
    '--paired measures whole test files, so a test name pattern is not supported',
  ],
]) {
  test(
    [
      `given paired usage error ${arg}`,
      'when invoking bunt',
      'it should write only the exact stderr diagnostic and exit two without spawning',
    ].join(', '),
    async () => {
      // given
      const harness = setup()
      // when
      const code = await buntMain(harness.deps)(['--paired', arg ?? ''])
      // then
      expect(code).toBe(2)
      expect(harness.errors()).toBe(`bunt: ${message}\n`)
      expect(harness.written()).toBe('')
      expect(harness.calls()).toEqual([])
    },
  )
}
