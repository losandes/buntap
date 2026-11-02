import type { TProtocolVerdict } from './resolve-protocol-exit-code.js';
/**
 * §1.3.5: the one human-readable verdict line, prefixed `buntap: `, preceded by
 * a blank line so it stands apart from the output above it.
 */
export declare const renderVerdictLine: (verdict: TProtocolVerdict) => string;
