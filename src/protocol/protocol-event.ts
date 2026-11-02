import type { TRunEvent } from '../typedefs/run-events.js'

/** §1.2.2: the only version this build knows how to read or write. */
export const PROTOCOL_VERSION = 1

export type TRunnerStartPayload = Readonly<{
  type: 'runner-start'
  argv: readonly string[]
}>

export type TRunnerExitPayload = Readonly<{
  type: 'runner-exit'
  code: number | null
  signal: string | null
}>

export type TRunnerStartEvent = Readonly<TRunnerStartPayload & { v: 1 }>

export type TRunnerExitEvent = Readonly<TRunnerExitPayload & { v: 1 }>

/**
 * §1.2.5: every event the parser already produces, unchanged, with `v`
 * added. §1.2.3-1.2.4: `runner-start` and `runner-exit` bracket the stream
 * and exist only on the wire — they are not part of `TRunEvent`.
 */
export type TProtocolEvent =
  | TRunnerStartEvent
  | TRunnerExitEvent
  | Readonly<TRunEvent & { v: 1 }>
