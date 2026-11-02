import type { TRunEvent } from '../typedefs/run-events.js'
import { PROTOCOL_VERSION } from './protocol-event.js'

/** §1.2.3: emitted once, before the child produces any output. */
export const encodeRunnerStart = (argv: readonly string[]): string =>
  `${JSON.stringify({ v: PROTOCOL_VERSION, type: 'runner-start', argv })}\n`

/** §1.2.4: emitted once, after everything else. */
export const encodeRunnerExit = (
  code: number | null,
  signal: string | null,
): string =>
  `${JSON.stringify({ v: PROTOCOL_VERSION, type: 'runner-exit', code, signal })}\n`

/** §1.2.5: an existing parser event, unchanged, with `v` added. */
export const encodeRunEvent = (event: TRunEvent): string =>
  `${JSON.stringify({ v: PROTOCOL_VERSION, ...event })}\n`
