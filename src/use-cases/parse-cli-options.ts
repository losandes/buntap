import { toThresholdPct } from '../lib/to-threshold-pct.js'
import type {
  TCliOptions,
  TColorMode,
  TCoverageReportMode,
  TReporterName,
} from '../typedefs/cli-options.js'
import type { TCoverageThresholdPct } from '../typedefs/coverage.js'
import type { TSettlement } from '../typedefs/settlement.js'

const REPORTER_FLAGS: Readonly<Record<string, TReporterName>> = {
  '--nyan': 'nyan',
  '--markdown': 'markdown',
  '--block': 'block',
  '--agent': 'agent',
}

const REPORTER_ENV_VAR = 'BUNTAP_REPORTER'

const REPORTER_NAMES: ReadonlySet<TReporterName> = new Set([
  'tap',
  'nyan',
  'markdown',
  'block',
  'agent',
])

export type TCliEnv = Readonly<Record<string, string | undefined>>

const KNOWN_FLAGS = new Set([
  ...Object.keys(REPORTER_FLAGS),
  '--color',
  '--no-color',
  '--help',
  '--version',
])

const COVERAGE_THRESHOLD_PREFIX = '--coverage-threshold='
const COVERAGE_REPORT_PREFIX = '--coverage-report='

const COVERAGE_REPORT_MODES: ReadonlySet<TCoverageReportMode> = new Set([
  'full',
  'failures',
  'summary',
  'bar',
  'markdown',
])

/** §1.4.1: the mode used when `--coverage-report` is absent, chosen per reporter. */
const DEFAULT_COVERAGE_REPORT: Readonly<
  Record<TReporterName, TCoverageReportMode>
> = {
  tap: 'full',
  agent: 'summary',
  markdown: 'markdown',
  nyan: 'bar',
  block: 'bar',
}

// §1.1.3: a bare `--coverage-report`, with no `=<mode>`, is still this flag
// (and the 1.1.2 usage error with an empty value), not an unknown flag -
// unlike `--coverage-threshold` bare, which stays unknown.
const isCoverageReportFlag = (flag: string): boolean =>
  flag === '--coverage-report' || flag.startsWith(COVERAGE_REPORT_PREFIX)

const isKnownFlag = (flag: string): boolean =>
  KNOWN_FLAGS.has(flag) ||
  flag.startsWith(COVERAGE_THRESHOLD_PREFIX) ||
  isCoverageReportFlag(flag)

/** §1.1.1-1.1.3: a known mode wins; anything else, including a bare flag with no value, is a usage error. */
const parseCoverageReportFlag = (
  argv: readonly string[],
): TSettlement<TCoverageReportMode | undefined, string> => {
  const raw = argv.find(isCoverageReportFlag)
  if (raw === undefined) return { status: 'ok', data: undefined }

  const value = raw.startsWith(COVERAGE_REPORT_PREFIX)
    ? raw.slice(COVERAGE_REPORT_PREFIX.length)
    : ''
  if (COVERAGE_REPORT_MODES.has(value as TCoverageReportMode)) {
    return { status: 'ok', data: value as TCoverageReportMode }
  }
  return {
    status: 'error',
    error: `invalid --coverage-report value '${value}'`,
  }
}

/** §1.2.2: accepts `0`–`1` as a fraction and `1`–`100` as a percentage; a non-finite, negative, or over-100 value is a usage error. */
const parseCoverageThresholdFlag = (
  argv: readonly string[],
): TSettlement<TCoverageThresholdPct | undefined, string> => {
  const raw = argv.find((flag) => flag.startsWith(COVERAGE_THRESHOLD_PREFIX))
  if (raw === undefined) return { status: 'ok', data: undefined }

  const value = Number(raw.slice(COVERAGE_THRESHOLD_PREFIX.length))
  const pct = toThresholdPct(value)
  if (pct === undefined) {
    return {
      status: 'error',
      error: `invalid --coverage-threshold value '${raw.slice(COVERAGE_THRESHOLD_PREFIX.length)}'`,
    }
  }
  return { status: 'ok', data: { functionsPct: pct, linesPct: pct } }
}

/**
 * `BUNTAP_REPORTER` names a reporter when no reporter flag does; unset or
 * empty means no choice. Only consulted when no reporter flag was given, so
 * an invalid value never blocks a flag that supersedes it.
 */
const parseReporterEnv = (
  env: TCliEnv,
): TSettlement<TReporterName | undefined, string> => {
  const value = env[REPORTER_ENV_VAR]
  if (value === undefined || value === '') {
    return { status: 'ok', data: undefined }
  }
  if (REPORTER_NAMES.has(value as TReporterName)) {
    return { status: 'ok', data: value as TReporterName }
  }
  return {
    status: 'error',
    error: `invalid ${REPORTER_ENV_VAR} value '${value}'`,
  }
}

/** Pure argv and environment parser: never throws, returns a settlement so the driver decides what to do with a usage error. A reporter flag supersedes `BUNTAP_REPORTER`. */
export const parseCliOptions =
  (env: TCliEnv) =>
  (argv: readonly string[]): TSettlement<TCliOptions, string> => {
    const unknown = argv.find((flag) => !isKnownFlag(flag))
    if (unknown !== undefined) {
      return { status: 'error', error: `unknown flag '${unknown}'` }
    }

    const coverageThreshold = parseCoverageThresholdFlag(argv)
    if (coverageThreshold.status === 'error') {
      return { status: 'error', error: coverageThreshold.error }
    }

    const coverageReport = parseCoverageReportFlag(argv)
    if (coverageReport.status === 'error') {
      return { status: 'error', error: coverageReport.error }
    }

    if (argv.includes('--help')) return { status: 'ok', data: { mode: 'help' } }
    if (argv.includes('--version'))
      return { status: 'ok', data: { mode: 'version' } }

    const reporters = argv
      .map((flag) => REPORTER_FLAGS[flag])
      .filter((reporter): reporter is TReporterName => reporter !== undefined)
    const distinctReporters = [...new Set(reporters)]
    if (distinctReporters.length > 1) {
      return { status: 'error', error: 'only one reporter flag may be given' }
    }

    const colorMode: TColorMode = argv.includes('--color')
      ? 'on'
      : argv.includes('--no-color')
        ? 'off'
        : 'auto'

    const flagReporter = distinctReporters[0]
    const envReporter =
      flagReporter === undefined
        ? parseReporterEnv(env)
        : ({ status: 'ok', data: undefined } as const)
    if (envReporter.status === 'error') {
      return { status: 'error', error: envReporter.error }
    }

    const reporter = flagReporter ?? envReporter.data ?? 'tap'

    // §1.1.4: the tap reporter always reports coverage in full; any other
    // explicit mode given alongside it is a usage error rather than silently
    // discarded.
    if (
      reporter === 'tap' &&
      coverageReport.data !== undefined &&
      coverageReport.data !== 'full'
    ) {
      return {
        status: 'error',
        error: 'the tap reporter always reports coverage in full',
      }
    }

    return {
      status: 'ok',
      data: {
        mode: 'run',
        reporter,
        colorMode,
        coverageThresholdPct: coverageThreshold.data,
        coverageReport:
          coverageReport.data ?? DEFAULT_COVERAGE_REPORT[reporter],
      },
    }
  }
