import { parseRun } from '../parse/parse-run.js'
import { readLines } from '../parse/read-lines.js'
import {
  encodeRunEvent,
  encodeRunnerExit,
  encodeRunnerStart,
} from '../protocol/encode-protocol-line.js'
import { mergeAsyncIterables } from './merge-async-iterables.js'

export type TChildResult = Readonly<{
  code: number | null
  signal: string | null
}>

export type TChildHandle = Readonly<{
  stdout: AsyncIterable<Buffer | string>
  stderr: AsyncIterable<Buffer | string>
  exited: Promise<TChildResult>
  kill: (signal: NodeJS.Signals) => void
}>

export type TBuntRunnerDeps = Readonly<{
  spawn: (argv: readonly string[]) => TChildHandle
  write: (chunk: string) => void
  /** Registers a forwarding handler and returns a function that unregisters it (§1.1.8). */
  onSignal: (handler: (signal: NodeJS.Signals) => void) => () => void
}>

/**
 * §1.1: runs `bun test`, emitting the protocol on `deps.write` and nothing
 * else. Reuses `parseRun` — the same parser `buntap` runs over raw text —
 * over the merged child output, so no line bun produces is interpreted
 * twice by two different classifiers (§1.1.5).
 */
export const runBunt =
  (deps: TBuntRunnerDeps) =>
  async (argv: readonly string[]): Promise<number> => {
    deps.write(encodeRunnerStart(argv))

    const child = deps.spawn(argv)
    const unregister = deps.onSignal((signal) => child.kill(signal))

    const merged = mergeAsyncIterables([child.stdout, child.stderr])
    for await (const event of parseRun(readLines(merged))) {
      deps.write(encodeRunEvent(event))
    }

    const result = await child.exited
    unregister()
    deps.write(encodeRunnerExit(result.code, result.signal))

    return result.code ?? 1
  }
