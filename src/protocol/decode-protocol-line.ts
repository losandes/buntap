import type { TSettlement } from '../typedefs/settlement.js'
import { parseJsonLine } from './parse-json-line.js'
import { PROTOCOL_VERSION, type TProtocolEvent } from './protocol-event.js'

type TUnknownRecord = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is TUnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

const isOptional = <T>(
  value: unknown,
  guard: (candidate: unknown) => candidate is T,
): value is T | undefined => value === undefined || guard(value)

const isString = (value: unknown): value is string => typeof value === 'string'
const isNumber = (value: unknown): value is number => typeof value === 'number'
const isBoolean = (value: unknown): value is boolean =>
  typeof value === 'boolean'
const isNullableNumber = (value: unknown): value is number | null =>
  value === null || typeof value === 'number'
const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === 'string'

const isTotals = (value: unknown): boolean =>
  isRecord(value) &&
  isNumber(value.pass) &&
  isNumber(value.fail) &&
  isNumber(value.skip) &&
  isNumber(value.todo) &&
  isNumber(value.errors) &&
  isNumber(value.expectCalls) &&
  isNumber(value.tests) &&
  isNumber(value.files) &&
  isOptional(value.durationMs, isNumber)

const isThresholdPct = (value: unknown): boolean =>
  isRecord(value) && isNumber(value.functionsPct) && isNumber(value.linesPct)

const isCoverageRow = (value: unknown): boolean =>
  isRecord(value) &&
  isString(value.file) &&
  isNumber(value.functionsPct) &&
  isNumber(value.linesPct)

const isCoverageRowArray = (value: unknown): boolean =>
  Array.isArray(value) && value.every(isCoverageRow)

/**
 * §1.3.4: validates the shape the wire format promises for each `type`,
 * one level deep. It does not re-validate every nested scalar inside
 * `totals` or `failing` beyond their own field types — this reader trusts
 * its own writer (`bunt`) for anything deeper, and a shallow mismatch here
 * still fails safely by falling through to the final `false`.
 */
const isWellFormed = (value: TUnknownRecord): boolean => {
  switch (value.type) {
    case 'runner-start':
      return isStringArray(value.argv)
    case 'runner-exit':
      return isNullableNumber(value.code) && isNullableString(value.signal)
    case 'run-start':
      return isString(value.version) && isOptional(value.revision, isString)
    case 'file-start':
      return isString(value.path)
    case 'test':
      return (
        isString(value.status) &&
        isOptional(value.file, isString) &&
        isString(value.name) &&
        isStringArray(value.path) &&
        isOptional(value.durationMs, isNumber) &&
        isStringArray(value.diagnostics)
      )
    case 'unhandled-error':
      return (
        isOptional(value.file, isString) &&
        isString(value.message) &&
        isStringArray(value.diagnostics)
      )
    case 'passthrough':
      return isString(value.kind) && isStringArray(value.lines)
    case 'run-end':
      return isTotals(value.totals) && isBoolean(value.summarySeen)
    case 'coverage-gate-failed':
      return (
        isThresholdPct(value.thresholdPct) && isCoverageRowArray(value.failing)
      )
    default:
      return false
  }
}

/**
 * §1.2.2: a line carrying a `v` other than the one this build recognises is
 * refused outright, before its shape is even considered. §1.3.1: this is the
 * same check mode detection uses to tell protocol input from raw text.
 */
export const hasRecognisedVersion = (
  value: unknown,
): value is TUnknownRecord & Readonly<{ v: 1 }> =>
  isRecord(value) && value.v === PROTOCOL_VERSION

/** Decodes one protocol line, never throwing (§1.3.4). */
export const decodeProtocolLine = (
  line: string,
): TSettlement<TProtocolEvent, string> => {
  const parsed = parseJsonLine(line)
  if (parsed.status === 'error') return parsed

  if (!hasRecognisedVersion(parsed.data)) {
    return { status: 'error', error: 'unrecognised protocol line' }
  }

  if (typeof parsed.data.type !== 'string' || !isWellFormed(parsed.data)) {
    return { status: 'error', error: 'malformed protocol event' }
  }

  return { status: 'ok', data: parsed.data as TProtocolEvent }
}
