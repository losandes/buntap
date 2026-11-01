import type { TTestStatus } from '../typedefs/run-events.js'

export type TClassifiedLine =
  | Readonly<{ kind: 'blank' }>
  | Readonly<{ kind: 'banner'; version: string; revision: string | undefined }>
  | Readonly<{ kind: 'file-header'; path: string }>
  | Readonly<{
      kind: 'result'
      status: TTestStatus
      name: string
      durationMs: number | undefined
    }>
  | Readonly<{ kind: 'unhandled-error-banner' }>
  | Readonly<{ kind: 'dash-rule' }>
  | Readonly<{ kind: 'coverage-rule' }>
  | Readonly<{
      kind: 'summary-count'
      field: 'pass' | 'fail' | 'skip' | 'todo' | 'errors' | 'expectCalls'
      value: number
    }>
  | Readonly<{
      kind: 'summary-ran'
      tests: number
      files: number
      durationMs: number | undefined
    }>
  | Readonly<{ kind: 'text'; raw: string }>

const BANNER = /^bun test v(\S+)(?:\s+\(([0-9a-fA-F]+)\))?$/
const FILE_HEADER =
  /^(\S+[._](?:test|spec)\.(?:ts|tsx|js|jsx|mts|cts|mjs|cjs)):$/
const RESULT =
  /^\((pass|fail|skip|todo)\)\s+(.*?)(?:\s+\[(\d+(?:\.\d+)?)(ms|s)\])?$/
const DASH_RULE = /^-+$/
const COVERAGE_RULE = /^-{2,}\|/
const SUMMARY_STATUS_COUNT = /^ (\d+) (pass|fail|skip|todo|error)$/
const SUMMARY_EXPECT_COUNT = /^ (\d+) expect\(\) calls$/
const SUMMARY_RAN =
  /^Ran (\d+) tests? across (\d+) files?\.(?:\s+\[(\d+(?:\.\d+)?)(ms|s)\])?$/

const toMs = (amount: string, unit: string): number =>
  unit === 's' ? Number(amount) * 1000 : Number(amount)

export const classifyLine = (line: string): TClassifiedLine => {
  if (line.trim().length === 0) return { kind: 'blank' }

  if (line === '# Unhandled error between tests')
    return { kind: 'unhandled-error-banner' }

  const banner = BANNER.exec(line)
  if (banner) {
    const [, version, revision] = banner
    return {
      kind: 'banner',
      version: version ?? '',
      revision: revision ?? undefined,
    }
  }

  const fileHeader = FILE_HEADER.exec(line)
  if (fileHeader) return { kind: 'file-header', path: fileHeader[1] ?? '' }

  const result = RESULT.exec(line)
  if (result) {
    const [, status, name, amount, unit] = result
    return {
      kind: 'result',
      status: status as TTestStatus,
      name: name ?? '',
      durationMs: amount && unit ? toMs(amount, unit) : undefined,
    }
  }

  if (COVERAGE_RULE.test(line)) return { kind: 'coverage-rule' }
  if (DASH_RULE.test(line)) return { kind: 'dash-rule' }

  const ran = SUMMARY_RAN.exec(line)
  if (ran) {
    const [, tests, files, amount, unit] = ran
    return {
      kind: 'summary-ran',
      tests: Number(tests),
      files: Number(files),
      durationMs: amount && unit ? toMs(amount, unit) : undefined,
    }
  }

  const statusCount = SUMMARY_STATUS_COUNT.exec(line)
  if (statusCount) {
    const [, value, field] = statusCount
    return {
      kind: 'summary-count',
      field:
        field === 'error'
          ? 'errors'
          : (field as 'pass' | 'fail' | 'skip' | 'todo'),
      value: Number(value),
    }
  }

  const expectCount = SUMMARY_EXPECT_COUNT.exec(line)
  if (expectCount) {
    return {
      kind: 'summary-count',
      field: 'expectCalls',
      value: Number(expectCount[1]),
    }
  }

  return { kind: 'text', raw: line }
}
