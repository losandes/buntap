import type {
  TCliOptions,
  TColorMode,
  TReporterName,
} from '../typedefs/cli-options.js'
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

/** Pure argv parser: never throws, returns a settlement so the driver decides what to do with a usage error. */
export const parseCliOptions = (
  argv: readonly string[],
): TSettlement<TCliOptions, string> => {
  const unknown = argv.find((flag) => !KNOWN_FLAGS.has(flag))
  if (unknown !== undefined) {
    return { status: 'error', error: `unknown flag '${unknown}'` }
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
    data: { mode: 'run', reporter: distinctReporters[0] ?? 'tap', colorMode },
  }
}
