import { parseRun } from './parse/parse-run.js'
import { parseCliOptions } from './use-cases/parse-cli-options.js'
import {
  initialExitState,
  nextExitState,
  resolveExitCode,
} from './use-cases/resolve-exit-code.js'
import { selectReporter } from './use-cases/select-reporter.js'

export type TCliDeps = Readonly<{
  input: AsyncIterable<string>
  write: (chunk: string) => void
  writeError: (chunk: string) => void
  columns: number
  isTty: boolean
  env: Readonly<Record<string, string | undefined>>
}>

// Hardcoded rather than read from package.json at runtime: bin.ts stays the
// eight lines in §2.4, with no filesystem access of its own, and this is
// bumped alongside "version" in package.json at release time.
const VERSION = '0.1.0'

const HELP = `buntap — pipe bun test output through a TAP14, nyan, markdown, block, or agent reporter

Usage:
  bun test 2>&1 | buntap [options]

Options:
  --nyan        nyan cat reporter
  --markdown    markdown reporter
  --block       inverse-video block reporter
  --agent       minimal output, verbose only on failure
  --color       force colour on
  --no-color    force colour off
  --help        print this help and exit
  --version     print the version and exit

bun writes test results to stderr, not stdout — pipe with 2>&1.
Only bun's default console reporter is parsed; --reporter=junit, --dots,
and --only-failures output are not supported.
`

const resolveColor = (
  colorMode: 'auto' | 'on' | 'off',
  deps: Pick<TCliDeps, 'isTty' | 'env'>,
): boolean => {
  if (colorMode === 'on') return true
  if (colorMode === 'off') return false
  return deps.isTty && deps.env.NO_COLOR === undefined
}

export const main =
  (deps: TCliDeps) =>
  async (argv: readonly string[]): Promise<number> => {
    const options = parseCliOptions(argv)

    if (options.status === 'error') {
      deps.writeError(`buntap: ${options.error}\n\n${HELP}`)
      return 2
    }

    if (options.data.mode === 'help') {
      deps.write(HELP)
      return 0
    }

    if (options.data.mode === 'version') {
      deps.write(`${VERSION}\n`)
      return 0
    }

    const reporter = selectReporter({
      columns: deps.columns,
      isTty: deps.isTty,
      color: resolveColor(options.data.colorMode, deps),
    })(options.data)

    // The one permitted accumulator in this module: a stream fold cannot be
    // expressed as a reduce because events arrive over time.
    let exitState = initialExitState
    for await (const event of parseRun(deps.input)) {
      deps.write(reporter.next(event))
      exitState = nextExitState(exitState, event)
    }
    deps.write(reporter.end())

    const code = resolveExitCode(exitState)
    if (code === 2) {
      deps.writeError(
        'buntap: no bun test summary found on stdin — did you mean `bun test 2>&1 | buntap`?\n',
      )
    }
    return code
  }
