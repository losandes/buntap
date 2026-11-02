import type { TRunEvent } from '../typedefs/run-events.js';
export type TTally = Readonly<{
    total: number;
    pass: number;
    fail: number;
    skip: number;
    todo: number;
}>;
export declare const initialTally: TTally;
/** Pure fold: one event in, the next tally out. Reporters use this to track running totals without a `let`. */
export declare const foldTally: (tally: TTally, event: TRunEvent) => TTally;
