export type { TCliDeps } from './cli.js'
export { main } from './cli.js'
export { formatCoverageGateFailure } from './lib/format-coverage-gate.js'
export { parseBunfigThreshold } from './parse/parse-bunfig-threshold.js'
export { parseCoverageTable } from './parse/parse-coverage-table.js'
export { parseRun } from './parse/parse-run.js'
export { readLines } from './parse/read-lines.js'
export { agentReporter } from './reporters/agent-reporter.js'
export { blockReporter } from './reporters/block-reporter.js'
export { markdownReporter } from './reporters/markdown-reporter.js'
export { nyanReporter } from './reporters/nyan-reporter.js'
export { tapReporter } from './reporters/tap-reporter.js'
export type {
  TCliOptions,
  TColorMode,
  TReporterName,
} from './typedefs/cli-options.js'
export type {
  TCoverageRow,
  TCoverageThresholdPct,
} from './typedefs/coverage.js'
export type {
  TReporter,
  TReporterDeps,
  TReporterInstance,
} from './typedefs/reporter.js'
export type {
  TCoverageGateFailedEvent,
  TRunEvent,
  TTestStatus,
  TTotals,
} from './typedefs/run-events.js'
export type { TSettlement } from './typedefs/settlement.js'

export { bindReporter } from './use-cases/bind-reporter.js'
export { evaluateCoverageGate } from './use-cases/evaluate-coverage-gate.js'
export { parseCliOptions } from './use-cases/parse-cli-options.js'
export { selectReporter } from './use-cases/select-reporter.js'
