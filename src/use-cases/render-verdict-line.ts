import type { TProtocolVerdict } from './resolve-protocol-exit-code.js'

/** §1.3.5: the one human-readable verdict line, prefixed `buntap: `. */
export const renderVerdictLine = (verdict: TProtocolVerdict): string =>
  `buntap: ${verdict.message} - exiting ${verdict.code}\n`
