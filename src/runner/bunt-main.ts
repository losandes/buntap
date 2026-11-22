import { runBunt } from './bunt-runner.js'
import { runPaired, type TPairedRunnerDeps } from './paired-runner.js'
import { parseBuntArgs } from './parse-bunt-args.js'

export const buntMain =
  (deps: TPairedRunnerDeps) =>
  (argv: readonly string[]): Promise<number> => {
    const parsed = parseBuntArgs(argv)
    if (parsed.status === 'error') {
      deps.writeError(`bunt: ${parsed.error}\n`)
      return Promise.resolve(2)
    }
    return parsed.data.mode === 'paired'
      ? runPaired(deps)(parsed.data)
      : runBunt(deps)(parsed.data.argv)
  }
