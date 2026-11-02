import type { TRunEvent } from '../typedefs/run-events.js';
export type TExitState = Readonly<{
    sawFailure: boolean;
    summarySeen: boolean;
    coverageGateFailed: boolean;
}>;
export declare const initialExitState: TExitState;
/** Pure fold: one event in, the next exit state out. */
export declare const nextExitState: (state: TExitState, event: TRunEvent) => TExitState;
/** §2.8: 2 when no summary was seen, 1 when any failure or error was reported, 3 when every test passed but the coverage gate did not, 0 otherwise. */
export declare const resolveExitCode: (state: TExitState) => number;
