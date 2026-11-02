import {
  createConsoleStyles,
  cursorUp,
  hideCursor,
  showCursor,
} from '../lib/console-styles.js'
import { formatCoverageGateFailure } from '../lib/format-coverage-gate.js'
import { renderCoverageReport } from '../lib/format-coverage-report.js'
import { formatDuration } from '../lib/format-duration.js'
import { foldTally, initialTally, type TTally } from '../lib/tally.js'
import type { TReporter, TReporterDeps } from '../typedefs/reporter.js'
import type { TTotals } from '../typedefs/run-events.js'

const NUMBER_OF_LINES = 4
const NYAN_CAT_WIDTH = 11
const SCOREBOARD_WIDTH = 5

/** Same generator as `../supposed/src/reporters/NyanReporter.js`: `36 * r + 6 * g + b + 16`. */
const generateColors = (): readonly number[] => {
  const pi3 = Math.floor(Math.PI / 3)
  return Array.from({ length: 6 * 7 }, (_, i) => {
    const n = i * (1.0 / 6)
    const r = Math.floor(3 * Math.sin(n) + 3)
    const g = Math.floor(3 * Math.sin(n + 2 * pi3) + 3)
    const b = Math.floor(3 * Math.sin(n + 4 * pi3) + 3)
    return 36 * r + 6 * g + b + 16
  })
}

const RAINBOW_COLORS = generateColors()

type TTrajectories = readonly (readonly string[])[]

export type TNyanState = Readonly<{
  initialized: boolean
  tick: boolean
  colorIndex: number
  trajectories: TTrajectories
  tally: TTally
  failures: readonly string[]
  totals: TTotals | undefined
  coverageLines: readonly string[]
  gateFailureLines: readonly string[]
}>

const faceFor = (tally: TTally): string => {
  if (tally.fail > 0) return '( x .x)'
  if (tally.skip > 0) return '( o .o)'
  if (tally.pass > 0) return '( ^ .^)'
  return '( - .-)'
}

export const nyanReporter = (deps: TReporterDeps): TReporter<TNyanState> => {
  const styles = createConsoleStyles(deps.color)
  const renderCoverage = renderCoverageReport({
    mode: deps.coverageReport,
    styles,
    thresholdPct: deps.thresholdPct,
  })
  const width = Math.floor(deps.columns * 0.75)
  const trajectoryWidthMax = Math.max(width - NYAN_CAT_WIDTH, 1)

  const appendRainbow = (
    trajectories: TTrajectories,
    colorIndex: number,
    tick: boolean,
  ): Readonly<{ trajectories: TTrajectories; colorIndex: number }> => {
    const color = RAINBOW_COLORS[colorIndex % RAINBOW_COLORS.length] ?? 0
    const segment = styles.ansi256(color, tick ? '_' : '-')
    return {
      trajectories: trajectories.map((line) =>
        line.length >= trajectoryWidthMax
          ? [...line.slice(1), segment]
          : [...line, segment],
      ),
      colorIndex: colorIndex + 1,
    }
  }

  const renderScoreboard = (tally: TTally): string =>
    ` ${styles.cyan(String(tally.total))}\n ${styles.green(String(tally.pass))}\n ${styles.red(String(tally.fail))}\n ${styles.yellow(String(tally.skip))}\n`

  const renderRainbow = (trajectories: TTrajectories): string =>
    trajectories
      .map((line) => `\u001b[${SCOREBOARD_WIDTH}C${line.join('')}\n`)
      .join('')

  const renderCat = (
    tally: TTally,
    trajectories: TTrajectories,
    tick: boolean,
  ): string => {
    const startWidth = SCOREBOARD_WIDTH + (trajectories[0]?.length ?? 0)
    const color = `\u001b[${startWidth}C`
    const headPadding = tick ? '  ' : '   '
    const neckPadding = tick ? '_' : '__'
    const tail = tick ? '~' : '^'
    const feetPadding = tick ? ' ' : '  '
    return (
      `${color}_,------,\n` +
      `${color}_|${headPadding}/\\_/\\ \n` +
      `${color}${tail}|${neckPadding}${faceFor(tally)} \n` +
      `${color}${feetPadding}  ""  "" \n`
    )
  }

  const draw = (
    state: TNyanState,
  ): Readonly<{ state: TNyanState; output: string }> => {
    const appended = appendRainbow(
      state.trajectories,
      state.colorIndex,
      state.tick,
    )
    const frame =
      cursorUp(NUMBER_OF_LINES) +
      renderScoreboard(state.tally) +
      cursorUp(NUMBER_OF_LINES) +
      renderRainbow(appended.trajectories) +
      cursorUp(NUMBER_OF_LINES) +
      renderCat(state.tally, appended.trajectories, state.tick)
    return {
      state: {
        ...state,
        trajectories: appended.trajectories,
        colorIndex: appended.colorIndex,
        tick: !state.tick,
      },
      output: frame,
    }
  }

  const begin = (
    state: TNyanState,
  ): Readonly<{ state: TNyanState; output: string }> =>
    state.initialized
      ? { state, output: '' }
      : {
          state: { ...state, initialized: true },
          output: `\n${hideCursor()}${renderScoreboard(state.tally)}`,
        }

  const renderFailure = (
    file: string | undefined,
    name: string,
    diagnostics: readonly string[],
  ): string =>
    [`FAIL ${file ?? '(unknown file)'} > ${name}`, ...diagnostics].join('\n')

  const summaryLine = (totals: TTotals): string =>
    `${totals.tests} tests, ${totals.pass} passed, ${totals.fail} failed, ${totals.skip} skipped in ${formatDuration(totals.durationMs)}\n`

  return {
    initial: {
      initialized: false,
      tick: false,
      colorIndex: 0,
      trajectories: Array.from(
        { length: NUMBER_OF_LINES },
        () => [] as readonly string[],
      ),
      tally: initialTally,
      failures: [],
      totals: undefined,
      coverageLines: [],
      gateFailureLines: [],
    },

    next: (state, event) => {
      if (event.type === 'run-start') return begin(state)

      if (event.type === 'test' || event.type === 'unhandled-error') {
        const begun = begin(state)
        const tally = foldTally(begun.state.tally, event)
        const failures =
          event.type === 'test' && event.status === 'fail'
            ? [
                ...begun.state.failures,
                renderFailure(event.file, event.name, event.diagnostics),
              ]
            : event.type === 'unhandled-error'
              ? [
                  ...begun.state.failures,
                  renderFailure(event.file, event.message, event.diagnostics),
                ]
              : begun.state.failures
        const drawn = draw({ ...begun.state, tally, failures })
        return { state: drawn.state, output: begun.output + drawn.output }
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
        return {
          state: {
            ...state,
            gateFailureLines: [
              ...state.gateFailureLines,
              ...formatCoverageGateFailure(event),
            ],
          },
          output: '',
        }
      }

      if (event.type === 'run-end') {
        const failureDump =
          state.failures.length > 0 ? `\n${state.failures.join('\n')}\n` : ''
        const renderedCoverage = renderCoverage(state.coverageLines)
        const coverageDump =
          renderedCoverage.length > 0
            ? `\n${renderedCoverage.join('\n')}\n`
            : ''
        const gateFailureDump =
          state.gateFailureLines.length > 0
            ? `\n${state.gateFailureLines.join('\n')}\n`
            : ''
        return {
          state: { ...state, totals: event.totals },
          output: `${showCursor()}${failureDump}\n${summaryLine(event.totals)}${coverageDump}${gateFailureDump}`,
        }
      }

      return { state, output: '' }
    },

    end: () => '',
  }
}
