export type TCoverageThresholdPct = Readonly<{
  functionsPct: number
  linesPct: number
}>

export type TCoverageRow = Readonly<{
  file: string
  functionsPct: number
  linesPct: number
}>
