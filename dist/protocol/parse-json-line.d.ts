import type { TSettlement } from '../typedefs/settlement.js';
/**
 * The boundary between untrusted text arriving over a pipe and a typed
 * value: `JSON.parse` throws on malformed input, so this is the one place
 * that throw is converted into a settlement (§1.2.1, §1.3.4).
 */
export declare const parseJsonLine: (line: string) => TSettlement<unknown, string>;
