import { createConsoleStyles } from '../lib/console-styles.js'
import { formatCoverageGateFailure } from '../lib/format-coverage-gate.js'
import { renderCoverageReport } from '../lib/format-coverage-report.js'
import type { TReporter } from '../typedefs/reporter.js'
import type { TRunEvent } from '../typedefs/run-events.js'

// §1.1.4/§1.5.3: the tap reporter is pinned to `full`, with colour always
// off, so other programs consuming its output see bun's table unchanged -
// `tapReporter` is a plain object rather than a function of `TReporterDeps`
// because nothing it renders varies by them.
const renderTapCoverage = renderCoverageReport({
  mode: 'full',
  styles: createConsoleStyles(false),
  thresholdPct: undefined,
})

export type TTapState = Readonly<{ lineCount: number; versionEmitted: boolean }>

const escapeDescription = (name: string): string =>
  name.replace(/\\/g, '\\\\').replace(/#/g, '\\#').replace(/\r?\n/g, ' ')

const escapeYamlString = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

const firstErrorMessage = (
  diagnostics: readonly string[],
  fallback: string,
): string => {
  const errorLine = diagnostics.find((line) => line.startsWith('error:'))
  return errorLine ? errorLine.slice('error:'.length).trim() : fallback
}

const indentDetails = (diagnostics: readonly string[]): string =>
  diagnostics.map((line) => `      ${line}`).join('\n')

const failureBlock = (
  message: string,
  durationMs: number | undefined,
  diagnostics: readonly string[],
): string => {
  const lines = [
    '  ---',
    `  message: "${escapeYamlString(message)}"`,
    '  severity: fail',
    `  duration_ms: ${durationMs ?? 0}`,
  ]
  const data =
    diagnostics.length > 0
      ? ['  data:', '    details: |', indentDetails(diagnostics)]
      : []
  return [...lines, ...data, '  ...'].join('\n')
}

const commentLines = (lines: readonly string[]): string =>
  lines.map((line) => `# ${line}`).join('\n')

const testLine = (
  event: Extract<TRunEvent, { type: 'test' }>,
  n: number,
): string => {
  const description = escapeDescription(event.name)
  if (event.status === 'skip') return `ok ${n} - ${description} # SKIP`
  if (event.status === 'todo') return `ok ${n} - ${description} # TODO`
  if (event.status === 'fail') {
    const message = firstErrorMessage(event.diagnostics, event.name)
    return [
      `not ok ${n} - ${description}`,
      failureBlock(message, event.durationMs, event.diagnostics),
    ].join('\n')
  }
  const log =
    event.diagnostics.length > 0 ? `\n${commentLines(event.diagnostics)}` : ''
  return `ok ${n} - ${description}${log}`
}

const unhandledErrorLine = (
  event: Extract<TRunEvent, { type: 'unhandled-error' }>,
  n: number,
): string => {
  const name = escapeDescription(event.file ?? 'unhandled error')
  return [
    `not ok ${n} - ${name}`,
    failureBlock(event.message, undefined, event.diagnostics),
  ].join('\n')
}

const noSummaryFooter = (versionEmitted: boolean): string =>
  [
    ...(versionEmitted ? [] : ['TAP version 14']),
    '1..0 # no bun test summary found on stdin',
  ].join('\n')

const summaryFooter = (
  event: Extract<TRunEvent, { type: 'run-end' }>,
  lineCount: number,
): string =>
  [
    `1..${lineCount}`,
    `# tests ${event.totals.tests}`,
    `# pass ${event.totals.pass}`,
    `# fail ${event.totals.fail}`,
    `# skip ${event.totals.skip}`,
    `# todo ${event.totals.todo}`,
    `# duration_ms ${event.totals.durationMs ?? 0}`,
  ].join('\n')

export const tapReporter: TReporter<TTapState> = {
  initial: { lineCount: 0, versionEmitted: false },

  next: (state, event) => {
    if (event.type === 'run-start') {
      return {
        state: { ...state, versionEmitted: true },
        output: 'TAP version 14\n',
      }
    }
    if (event.type === 'file-start') {
      return { state, output: `# ${event.path}\n` }
    }
    if (event.type === 'test') {
      const n = state.lineCount + 1
      return {
        state: { ...state, lineCount: n },
        output: `${testLine(event, n)}\n`,
      }
    }
    if (event.type === 'unhandled-error') {
      const n = state.lineCount + 1
      return {
        state: { ...state, lineCount: n },
        output: `${unhandledErrorLine(event, n)}\n`,
      }
    }
    if (event.type === 'passthrough' && event.kind === 'coverage') {
      const lines = renderTapCoverage(event.lines)
      return lines.length > 0
        ? { state, output: `${commentLines(lines)}\n` }
        : { state, output: '' }
    }
    if (event.type === 'passthrough') {
      return event.lines.length > 0
        ? { state, output: `${commentLines(event.lines)}\n` }
        : { state, output: '' }
    }
    if (event.type === 'coverage-gate-failed') {
      return {
        state,
        output: `${commentLines(formatCoverageGateFailure(event))}\n`,
      }
    }
    // run-end
    const output = event.summarySeen
      ? summaryFooter(event, state.lineCount)
      : noSummaryFooter(state.versionEmitted)
    return { state, output: `${output}\n` }
  },

  end: () => '',
}
