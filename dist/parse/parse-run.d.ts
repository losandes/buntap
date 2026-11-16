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
    rollup: boolean;
}>;
export type TStepResult = Readonly<{
    state: TParseState;
    events: readonly TRunEvent[];
}>;
export declare const initialParseState: TParseState;
/**
 * One pure transition: the current state plus one raw input line in, the next
 * state plus zero or more events out.
 *
 * Bun's console reporter reprints every skipped, todo, and failed result a
 * second time in a trailing roll-up ("N tests skipped:" and friends) once a
 * run is large enough. Those lines are restatements, not tests, so a result
 * inside an open roll-up emits nothing; anything that is not blank and not
 * another roll-up header closes the roll-up, so an unrecognised shape loses
 * at most the restatements and never a real test.
 */
export declare const stepLine: (state: TParseState, rawLine: string) => TStepResult;
/** Events produced when the input ends without ever reaching a `summary-ran` line. */
export declare const finalizeParse: (state: TParseState) => readonly TRunEvent[];
/**
 * The parser's stream fold: each line advances the immutable state produced
 * by `stepLine`, and the fold stops once a `run-end` event has been produced —
 * which guarantees run-end is emitted exactly once and is always last (§2.2).
 *
 * The `let state` is deliberate. This was previously a `yield*` recursion,
 * one nested async generator per input line, and every value then had to be
 * delegated back up through that whole chain: a run of a few thousand lines
 * overflowed the call stack ("Maximum call stack size exceeded"). The
 * reassignment is confined to this loop; every state value is still built
 * immutably by `stepLine`.
 *
 * The iterator is driven by hand rather than with `for await`, so stopping at
 * run-end does not call `return()` on the source: as before, whatever follows
 * the summary is left unread rather than torn down.
 */
export declare function parseRun(lines: Readonly<AsyncIterable<string>>): AsyncGenerator<TRunEvent>;
export {};
