import { listFamily, toOwnerSource } from './paired-family.js'
import type { TPairedRunnerDeps } from './paired-runner.js'

export type TPairedUnit = Readonly<{
  source: string | undefined
  tests: readonly string[]
}>

export const planPairedUnits =
  (deps: Readonly<Pick<TPairedRunnerDeps, 'listDir' | 'fileExists'>>) =>
  (selected: readonly string[]): readonly TPairedUnit[] =>
    [...new Set(selected)].reduce<readonly TPairedUnit[]>((units, test) => {
      const source = toOwnerSource(deps.fileExists)(test)
      if (source === undefined) return [...units, { source, tests: [test] }]
      const existing = units.find((unit) => unit.source === source)
      const tests = [
        ...new Set([
          ...(existing?.tests ?? []),
          ...listFamily(deps)(source),
          test,
        ]),
      ].toSorted()
      return existing === undefined
        ? [...units, { source, tests }]
        : units.map((unit) => (unit === existing ? { source, tests } : unit))
    }, [])
