import { createConsoleStyles } from '../lib/console-styles.js'
import { formatCoverageGateFailure } from '../lib/format-coverage-gate.js'
import { renderCoverageReport } from '../lib/format-coverage-report.js'
import { formatDuration } from '../lib/format-duration.js'
import type { TReporter, TReporterDeps } from '../typedefs/reporter.js'
import type { TTestStatus } from '../typedefs/run-events.js'

export type TBlockState = Readonly<{ failures: readonly string[] }>

const badgeFor = (
  styles: ReturnType<typeof createConsoleStyles>,
  status: TTestStatus | 'error',
): string => {
  if (status === 'pass') return styles.bgGreen(styles.black(' PASS '))
  if (status === 'fail' || status === 'error')
    return styles.bgRed(styles.black(' FAIL '))
  if (status === 'skip') return styles.bgYellow(styles.black(' SKIP '))
  return styles.bgCyan(styles.black(' TODO '))
}

/** §1.4.6: one badge-prefixed line per test, failure detail inline, a summary at the end. */
export const blockReporter = (deps: TReporterDeps): TReporter<TBlockState> => {
  const styles = createConsoleStyles(deps.color)
  const renderCoverage = renderCoverageReport({
    mode: deps.coverageReport,
    styles,
    thresholdPct: deps.thresholdPct,
  })

  return {
    initial: { failures: [] },

    next: (state, event) => {
      if (event.type === 'test') {
        const badge = badgeFor(styles, event.status)
        const line = `${badge} ${event.name}`
        if (event.status !== 'fail') return { state, output: `${line}\n` }
        const detail = event.diagnostics
          .map((diagnosticLine) => `  ${diagnosticLine}`)
          .join('\n')
        const block = detail.length > 0 ? `${line}\n${detail}\n` : `${line}\n`
        return {
          state: { failures: [...state.failures, event.name] },
          output: block,
        }
      }
      if (event.type === 'unhandled-error') {
        const badge = badgeFor(styles, 'error')
        const detail = event.diagnostics
          .map((diagnosticLine) => `  ${diagnosticLine}`)
          .join('\n')
        return {
          state: {
            failures: [...state.failures, event.file ?? 'unhandled error'],
          },
          output: `${badge} ${event.file ?? 'unhandled error'}\n${detail}\n`,
        }
      }
      if (event.type === 'passthrough' && event.kind === 'coverage') {
        const lines = renderCoverage(event.lines)
        return lines.length > 0
          ? { state, output: `\n${lines.join('\n')}\n` }
          : { state, output: '' }
      }
      if (event.type === 'coverage-gate-failed') {
        return {
          state,
          output: `${formatCoverageGateFailure(event).join('\n')}\n`,
        }
      }
      if (event.type === 'run-end') {
        const totals = event.totals
        const summary = `${totals.tests} tests, ${totals.pass} passed, ${totals.fail} failed, ${totals.skip} skipped in ${formatDuration(totals.durationMs)}\n`
        return { state, output: `\n${summary}` }
      }
      return { state, output: '' }
    },

    end: () => '',
  }
}
