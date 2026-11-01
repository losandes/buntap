import { toThresholdPct } from '../lib/to-threshold-pct.js'
import type {
  TCliOptions,
  TColorMode,
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

const KNOWN_FLAGS = new Set([
  ...Object.keys(REPORTER_FLAGS),
  '--color',
  '--no-color',
  '--help',
  '--version',
])

const COVERAGE_THRESHOLD_PREFIX = '--coverage-threshold='

const isKnownFlag = (flag: string): boolean =>
  KNOWN_FLAGS.has(flag) || flag.startsWith(COVERAGE_THRESHOLD_PREFIX)

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

/** Pure argv parser: never throws, returns a settlement so the driver decides what to do with a usage error. */
export const parseCliOptions = (
  argv: readonly string[],
): TSettlement<TCliOptions, string> => {
  const unknown = argv.find((flag) => !isKnownFlag(flag))
  if (unknown !== undefined) {
    return { status: 'error', error: `unknown flag '${unknown}'` }
  }

  const coverageThreshold = parseCoverageThresholdFlag(argv)
  if (coverageThreshold.status === 'error') {
    return { status: 'error', error: coverageThreshold.error }
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

  return {
    status: 'ok',
    data: {
      mode: 'run',
      reporter: distinctReporters[0] ?? 'tap',
      colorMode,
      coverageThresholdPct: coverageThreshold.data,
    },
  }
}
