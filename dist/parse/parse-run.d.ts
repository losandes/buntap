import type { TRunEvent } from '../typedefs/run-events.js';
type TTotalsAccumulator = Readonly<{
    pass: number;
    fail: number;
    skip: number;
    todo: number;
    errors: number;
    expectCalls: number;
}>;
type TCoverageCapture = Readonly<{
    active: boolean;
    lines: readonly string[];
}>;
type TUnhandledErrorCapture = Readonly<{
    active: boolean;
    openSeen: boolean;
    lines: readonly string[];
}>;
export type TParseState = Readonly<{
    currentFile: string | undefined;
    diagnostics: readonly string[];
    coverage: TCoverageCapture;
    unhandledError: TUnhandledErrorCapture;
    totals: TTotalsAccumulator;
}>;
export type TStepResult = Readonly<{
    state: TParseState;
    events: readonly TRunEvent[];
}>;
export declare const initialParseState: TParseState;
/** One pure transition: the current state plus one raw input line in, the next state plus zero or more events out. */
export declare const stepLine: (state: TParseState, rawLine: string) => TStepResult;
/** Events produced when the input ends without ever reaching a `summary-ran` line. */
export declare const finalizeParse: (state: TParseState) => readonly TRunEvent[];
export declare const parseRun: (lines: AsyncIterable<string>) => AsyncGenerator<TRunEvent>;
export {};
