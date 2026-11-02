import type { TRunnerExitPayload, TRunnerStartPayload } from '../protocol/protocol-event.js';
import type { TRunEvent, TTotals } from '../typedefs/run-events.js';
import { type TExitState } from './resolve-exit-code.js';
export type TRunnerExitInfo = Readonly<{
    code: number | null;
    signal: string | null;
}>;
export type TProtocolExitState = Readonly<{
    exitState: TExitState;
    totals: TTotals | undefined;
    runnerExit: TRunnerExitInfo | undefined;
}>;
export declare const initialProtocolExitState: TProtocolExitState;
/**
 * Pure fold over the decoded protocol stream: `runner-start` carries no
 * state, `runner-exit` records the child's own outcome (§1.2.4), and every
 * other event folds through the same `nextExitState` the text-mode driver
 * uses (§1.3.3), additionally remembering the last `run-end`'s totals so the
 * verdict line can name a count (§1.3.5).
 */
export declare const nextProtocolExitState: (state: TProtocolExitState, event: TRunEvent | TRunnerStartPayload | TRunnerExitPayload) => TProtocolExitState;
export type TProtocolVerdict = Readonly<{
    code: number;
    message: string;
}>;
/**
 * §2.2: resolved top to bottom, the first matching row wins. Failures and
 * the coverage gate outrank the runner's own exit because, when buntap
 * already has an actionable verdict, the runner's code can only agree or
 * confuse it; the runner's code and its absence matter only when buntap
 * parsed no failures at all.
 */
export declare const resolveProtocolVerdict: (state: TProtocolExitState) => TProtocolVerdict;
