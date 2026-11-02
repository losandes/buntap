import type { TRunCliOptions } from '../typedefs/cli-options.js';
import type { TReporterDeps, TReporterInstance } from '../typedefs/reporter.js';
/** Dependencies first, data last: deps shape every reporter's output, the chosen name picks which one. */
export declare const selectReporter: (deps: TReporterDeps) => (options: TRunCliOptions) => TReporterInstance;
