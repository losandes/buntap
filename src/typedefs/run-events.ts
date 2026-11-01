export type TTestStatus = 'pass' | 'fail' | 'skip' | 'todo'

export type TTotals = Readonly<{
  pass: number
  fail: number
  skip: number
  todo: number
  errors: number
  expectCalls: number
  tests: number
  files: number
  durationMs: number | undefined
}>

export type TRunEvent =
  | Readonly<{
      type: 'run-start'
      version: string
      revision: string | undefined
    }>
  | Readonly<{ type: 'file-start'; path: string }>
  | Readonly<{
      type: 'test'
      status: TTestStatus
      file: string | undefined
      name: string
      path: readonly string[]
      durationMs: number | undefined
      diagnostics: readonly string[]
    }>
  | Readonly<{
      type: 'unhandled-error'
      file: string | undefined
      message: string
      diagnostics: readonly string[]
    }>
  | Readonly<{
      type: 'passthrough'
      kind: 'coverage' | 'output'
      lines: readonly string[]
    }>
  | Readonly<{ type: 'run-end'; totals: TTotals; summarySeen: boolean }>
