import type { TReporter, TReporterDeps } from '../typedefs/reporter.js';
import type { TTotals } from '../typedefs/run-events.js';
type TMarkdownFailure = Readonly<{
    name: string;
    diagnostics: readonly string[];
}>;
export type TMarkdownState = Readonly<{
    paths: readonly (readonly string[])[];
    failures: readonly TMarkdownFailure[];
    totals: TTotals | undefined;
    coverageLines: readonly string[];
    gateFailureLines: readonly string[];
}>;
/** §1.4.5: emitted once, from `end`, because the nested bullet tree needs every test seen before it can be rendered. */
export declare const markdownReporter: (_deps: TReporterDeps) => TReporter<TMarkdownState>;
export {};
