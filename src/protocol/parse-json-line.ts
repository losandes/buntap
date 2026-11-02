import type { TSettlement } from '../typedefs/settlement.js'

/**
 * The boundary between untrusted text arriving over a pipe and a typed
 * value: `JSON.parse` throws on malformed input, so this is the one place
 * that throw is converted into a settlement (§1.2.1, §1.3.4).
 */
export const parseJsonLine = (line: string): TSettlement<unknown, string> => {
  // biome-ignore lint/plugin/no-intermediate-try-catch: this is that boundary
  try {
    return { status: 'ok', data: JSON.parse(line) }
  } catch (err) {
    return {
      status: 'error',
      error: err instanceof Error ? err.message : 'invalid JSON',
    }
  }
}
