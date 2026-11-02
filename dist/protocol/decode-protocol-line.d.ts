import type { TSettlement } from '../typedefs/settlement.js';
import { type TProtocolEvent } from './protocol-event.js';
type TUnknownRecord = Readonly<Record<string, unknown>>;
/**
 * §1.2.2: a line carrying a `v` other than the one this build recognises is
 * refused outright, before its shape is even considered. §1.3.1: this is the
 * same check mode detection uses to tell protocol input from raw text.
 */
export declare const hasRecognisedVersion: (value: unknown) => value is TUnknownRecord & Readonly<{
    v: 1;
}>;
/** Decodes one protocol line, never throwing (§1.3.4). */
export declare const decodeProtocolLine: (line: string) => TSettlement<TProtocolEvent, string>;
export {};
