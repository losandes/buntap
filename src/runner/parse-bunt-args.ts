import type { TSettlement } from '../typedefs/settlement.js'

export type TBuntArgs =
  | Readonly<{ mode: 'passthrough'; argv: readonly string[] }>
  | Readonly<{
      mode: 'paired'
      argv: readonly string[]
      flags: readonly string[]
      filters: readonly string[]
      concurrency: number | undefined
    }>

const usageError = (arg: string): string | undefined => {
  if (arg.startsWith('--paired-concurrency=')) {
    const value = arg.slice('--paired-concurrency='.length)
    if (!/^[1-9][0-9]*$/.test(value))
      return `--paired-concurrency must be a positive integer, got "${value}"`
  }
  if (arg === '--') return '--paired does not support a bare --'
  if (arg === '-t' || arg.startsWith('--test-name-pattern'))
    return '--paired measures whole test files, so a test name pattern is not supported'
  return undefined
}

export const parseBuntArgs = (
  argv: readonly string[],
): TSettlement<TBuntArgs, string> => {
  if (!argv.includes('--paired'))
    return { status: 'ok', data: { mode: 'passthrough', argv } }

  const error = argv.map(usageError).find((message) => message !== undefined)
  if (error !== undefined) return { status: 'error', error }

  const remaining = argv.filter(
    (arg) => arg !== '--paired' && !arg.startsWith('--paired-concurrency='),
  )
  const concurrencyArg = argv.findLast((arg) =>
    arg.startsWith('--paired-concurrency='),
  )
  return {
    status: 'ok',
    data: {
      mode: 'paired',
      argv,
      concurrency:
        concurrencyArg === undefined
          ? undefined
          : Number(concurrencyArg.slice('--paired-concurrency='.length)),
      filters: remaining.filter((arg) => !arg.startsWith('-')),
      flags: remaining.filter(
        (arg) =>
          arg.startsWith('-') &&
          arg !== '--coverage' &&
          !arg.startsWith('--coverage-reporter') &&
          !arg.startsWith('--coverage-dir'),
      ),
    },
  }
}
