import { parseBunfigThreshold } from './parse/parse-bunfig-threshold.js'
import { parseRun } from './parse/parse-run.js'
import { peekFirstNonEmptyLine } from './parse/peek-first-line.js'
import { decodeProtocolLine } from './protocol/decode-protocol-line.js'
import type { TCoverageThresholdPct } from './typedefs/coverage.js'
import { detectInputMode } from './use-cases/detect-input-mode.js'
import { evaluateCoverageGate } from './use-cases/evaluate-coverage-gate.js'
import { parseCliOptions } from './use-cases/parse-cli-options.js'
import { renderVerdictLine } from './use-cases/render-verdict-line.js'
import {
  initialExitState,
  nextExitState,
  resolveExitCode,
} from './use-cases/resolve-exit-code.js'
import {
  initialProtocolExitState,
  nextProtocolExitState,
  resolveProtocolVerdict,
} from './use-cases/resolve-protocol-exit-code.js'
import { selectReporter } from './use-cases/select-reporter.js'

export type TCliDeps = Readonly<{
  input: AsyncIterable<string>
  write: (chunk: string) => void
  writeError: (chunk: string) => void
  columns: number
  isTty: boolean
  env: Readonly<Record<string, string | undefined>>
  cwd: string
  readTextFile: (path: string) => string | undefined
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
  --coverage-threshold=<n>  fail with exit 3 when a file is below <n> (0-1 or 0-100);
                            defaults to [test].coverageThreshold in ./bunfig.toml
  --coverage-report=<mode>  how coverage is rendered: full, failures, summary,
                            bar, or markdown; per-reporter default when absent
                            (tap: full, agent: summary, markdown: markdown,
                            nyan: bar, block: bar); the tap reporter
                            always reports coverage in full
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

type TResolvedThreshold = Readonly<{
  thresholdPct: TCoverageThresholdPct | undefined
  warning: string | undefined
}>

/** \u00a71.2.1: the flag wins; otherwise `[test].coverageThreshold` in `<cwd>/bunfig.toml` is read, never the filesystem when the flag already answered it. */
const resolveThreshold = (
  deps: Pick<TCliDeps, 'cwd' | 'readTextFile'>,
  flagThresholdPct: TCoverageThresholdPct | undefined,
): TResolvedThreshold => {
  if (flagThresholdPct !== undefined) {
    return { thresholdPct: flagThresholdPct, warning: undefined }
  }

  const toml = deps.readTextFile(`${deps.cwd}/bunfig.toml`)
  if (toml === undefined) return { thresholdPct: undefined, warning: undefined }

  const parsed = parseBunfigThreshold(toml)
  return parsed.status === 'error'
    ? { thresholdPct: undefined, warning: `buntap: ${parsed.error}\n` }
    : { thresholdPct: parsed.data, warning: undefined }
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

    const threshold = resolveThreshold(deps, options.data.coverageThresholdPct)
    if (threshold.warning !== undefined) deps.writeError(threshold.warning)

    const reporter = selectReporter({
      columns: deps.columns,
      isTty: deps.isTty,
      color: resolveColor(options.data.colorMode, deps),
      coverageReport: options.data.coverageReport,
      thresholdPct: threshold.thresholdPct,
    })(options.data)
    const gate = evaluateCoverageGate(threshold.thresholdPct)

    // §1.3.1-1.3.2: decide protocol vs. text from the first non-empty line,
    // without consuming it — `rest` replays everything the search read.
    const peeked = await peekFirstNonEmptyLine(deps.input)
    const mode =
      peeked.firstLine === undefined
        ? 'text'
        : detectInputMode(peeked.firstLine)

    if (mode === 'protocol') {
      // The one permitted accumulator in this module: a stream fold cannot
      // be expressed as a reduce because events arrive over time.
      let protocolState = initialProtocolExitState
      for await (const line of peeked.rest) {
        const decoded = decodeProtocolLine(line)
        if (decoded.status === 'error') continue // §1.3.4: ignore, never throw

        const event = decoded.data
        if (event.type === 'runner-start') continue
        if (event.type === 'runner-exit') {
          protocolState = nextProtocolExitState(protocolState, event)
          continue
        }

        // §1.3.3: the same reporter, coverage-gate, and exit-state pipeline
        // text mode drives below, fed from decoded events instead.
        for (const gated of gate(event)) {
          deps.write(reporter.next(gated))
          protocolState = nextProtocolExitState(protocolState, gated)
        }
      }
      deps.write(reporter.end())

      const verdict = resolveProtocolVerdict(protocolState)
      deps.writeError(renderVerdictLine(verdict)) // §1.3.5-1.3.6: stderr only
      return verdict.code
    }

    // The one permitted accumulator in this module: a stream fold cannot be
    // expressed as a reduce because events arrive over time.
    let exitState = initialExitState
    for await (const event of parseRun(peeked.rest)) {
      for (const gated of gate(event)) {
        deps.write(reporter.next(gated))
        exitState = nextExitState(exitState, gated)
      }
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
