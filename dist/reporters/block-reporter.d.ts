import type { TReporter, TReporterDeps } from '../typedefs/reporter.js';
export type TBlockState = Readonly<{
    failures: readonly string[];
}>;
/** §1.4.6: one badge-prefixed line per test, failure detail inline, a summary at the end. */
export declare const blockReporter: (deps: TReporterDeps) => TReporter<TBlockState>;
