import type { TCoverageThresholdPct } from './coverage.js'

export type TReporterName = 'tap' | 'nyan' | 'markdown' | 'block' | 'agent'

export type TColorMode = 'auto' | 'on' | 'off'

export type TCoverageReportMode =
  | 'full'
  | 'failures'
  | 'summary'
  | 'bar'
  | 'markdown'

export type TRunCliOptions = Readonly<{
  mode: 'run'
  reporter: TReporterName
  colorMode: TColorMode
  coverageThresholdPct: TCoverageThresholdPct | undefined
  coverageReport: TCoverageReportMode
}>

export type TCliOptions =
  | TRunCliOptions
  | Readonly<{ mode: 'help' }>
  | Readonly<{ mode: 'version' }>
