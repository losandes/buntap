import { type TTally } from '../lib/tally.js';
import type { TReporter, TReporterDeps } from '../typedefs/reporter.js';
import type { TTotals } from '../typedefs/run-events.js';
type TTrajectories = readonly (readonly string[])[];
export type TNyanState = Readonly<{
    initialized: boolean;
    tick: boolean;
    colorIndex: number;
    trajectories: TTrajectories;
    tally: TTally;
    failures: readonly string[];
    totals: TTotals | undefined;
    coverageLines: readonly string[];
    gateFailureLines: readonly string[];
}>;
export declare const nyanReporter: (deps: TReporterDeps) => TReporter<TNyanState>;
export {};
