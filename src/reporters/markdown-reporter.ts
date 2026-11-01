import { formatDuration } from '../lib/format-duration.js'
import type { TReporter, TReporterDeps } from '../typedefs/reporter.js'
import type { TTotals } from '../typedefs/run-events.js'

type TMarkdownFailure = Readonly<{
  name: string
  diagnostics: readonly string[]
}>

export type TMarkdownState = Readonly<{
  paths: readonly (readonly string[])[]
  failures: readonly TMarkdownFailure[]
  totals: TTotals | undefined
  coverageLines: readonly string[]
  gateFailureLines: readonly string[]
}>

const zeroTotals: TTotals = {
  pass: 0,
  fail: 0,
  skip: 0,
  todo: 0,
  errors: 0,
  expectCalls: 0,
  tests: 0,
  files: 0,
  durationMs: undefined,
}

// A Map built with `.set`, not a reduce that spreads into its own array
// accumulator: the latter is O(n^2) per level of nesting. Biome's own
// no-object-mutation plugin documents Map/Set mutation as out of its scope
// deliberately, and Map preserves the insertion order a nested bullet list
// depends on; each stored value is still a fresh array, never pushed onto.
const groupByHead = (
  paths: readonly (readonly string[])[],
): ReadonlyMap<string, readonly (readonly string[])[]> => {
  const groups = new Map<string, readonly (readonly string[])[]>()
  for (const path of paths) {
    if (path.length === 0) continue
    const head = path[0] as string
    const tail = path.slice(1)
    const existing = groups.get(head) ?? []
    groups.set(head, tail.length > 0 ? [...existing, tail] : existing)
  }
  return groups
}

const renderBullets = (
  paths: readonly (readonly string[])[],
  indent: number,
): string =>
  [...groupByHead(paths).entries()]
    .map(([head, group]) => {
      const bullet = `${'  '.repeat(indent)}- ${head}`
      return group.length > 0
        ? `${bullet}\n${renderBullets(group, indent + 1)}`
        : bullet
    })
    .join('\n')

const renderErrors = (failures: readonly TMarkdownFailure[]): string => {
  if (failures.length === 0) return ''
  const sections = failures
    .map(
      (failure) =>
        `#### ${failure.name}\n\n\`\`\`text\n${failure.diagnostics.join('\n')}\n\`\`\``,
    )
    .join('\n\n')
  return `\n\n## Errors\n\n${sections}`
}

const renderCoverage = (
  coverageLines: readonly string[],
  gateFailureLines: readonly string[],
): string => {
  if (coverageLines.length === 0) return ''
  const table = `\`\`\`text\n${coverageLines.join('\n')}\n\`\`\``
  const gateSection =
    gateFailureLines.length === 0 ? '' : `\n\n${gateFailureLines.join('\n')}`
  return `\n\n## Coverage\n\n${table}${gateSection}`
}

const renderTotals = (totals: TTotals): string =>
  [
    '## Totals',
    '',
    `- **total**: ${totals.tests}`,
    `- **passed**: ${totals.pass}`,
    `- **failed**: ${totals.fail}`,
    `- **skipped**: ${totals.skip}`,
    `- **duration**: ${formatDuration(totals.durationMs)}`,
  ].join('\n')

/** §1.4.5: emitted once, from `end`, because the nested bullet tree needs every test seen before it can be rendered. */
export const markdownReporter = (
  _deps: TReporterDeps,
): TReporter<TMarkdownState> => ({
  initial: {
    paths: [],
    failures: [] as readonly TMarkdownFailure[],
    totals: undefined,
    coverageLines: [],
    gateFailureLines: [],
  },

  next: (state, event) => {
    if (event.type === 'test') {
      const fullPath = [event.file ?? '(unknown file)', ...event.path]
      const nextFailures =
        event.status === 'fail'
          ? [
              ...state.failures,
              { name: event.name, diagnostics: event.diagnostics },
            ]
          : state.failures
      return {
        state: {
          ...state,
          paths: [...state.paths, fullPath],
          failures: nextFailures,
        },
        output: '',
      }
    }
    if (event.type === 'unhandled-error') {
      const name = event.file ?? 'unhandled error'
      return {
        state: {
          ...state,
          paths: [...state.paths, [name]],
          failures: [
            ...state.failures,
            { name, diagnostics: event.diagnostics },
          ],
        },
        output: '',
      }
    }
    if (event.type === 'passthrough' && event.kind === 'coverage') {
      return {
        state: {
          ...state,
          coverageLines: [...state.coverageLines, ...event.lines],
        },
        output: '',
      }
    }
    if (event.type === 'coverage-gate-failed') {
      const markdownLines = [
        `**COVERAGE FAIL** ${event.failing.length} ${event.failing.length === 1 ? 'file' : 'files'} below the minimum (functions ${event.thresholdPct.functionsPct.toFixed(2)}%, lines ${event.thresholdPct.linesPct.toFixed(2)}%)`,
        '',
        ...event.failing.map(
          (row) =>
            `- \`${row.file}\` functions ${row.functionsPct.toFixed(2)}%, lines ${row.linesPct.toFixed(2)}%`,
        ),
      ]
      return {
        state: {
          ...state,
          gateFailureLines: [...state.gateFailureLines, ...markdownLines],
        },
        output: '',
      }
    }
    if (event.type === 'run-end') {
      return { state: { ...state, totals: event.totals }, output: '' }
    }
    return { state, output: '' }
  },

  end: (state) => {
    const title = '# Tests'
    const bullets = renderBullets(state.paths, 0)
    const body = bullets.length > 0 ? `${title}\n\n${bullets}` : title
    const errors = renderErrors(state.failures)
    const coverage = renderCoverage(state.coverageLines, state.gateFailureLines)
    const totals = renderTotals(state.totals ?? zeroTotals)
    return `${body}${errors}${coverage}\n\n${totals}\n`
  },
})
