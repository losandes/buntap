import type { TReporter, TReporterDeps } from '../typedefs/reporter.js';
import type { TTotals } from '../typedefs/run-events.js';
export type TAgentState = Readonly<{
    totals: TTotals | undefined;
}>;
/**
 * §1.4.7: nothing for a pass, full detail for a failure, one summary line at
 * the end. The summary comes from `run-end`'s own totals rather than a local
 * tally, because bun's counts already distinguish a counted `fail` from a
 * counted `error` in ways a per-event fold would have to reconstruct.
 */
export declare const agentReporter: (_deps: TReporterDeps) => TReporter<TAgentState>;
