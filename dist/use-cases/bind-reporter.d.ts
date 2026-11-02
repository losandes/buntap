import type { TReporter, TReporterInstance } from '../typedefs/reporter.js';
/**
 * Erases a `TReporter<TState>`'s state parameter so the driver can hold a
 * single `TReporterInstance` type regardless of which reporter was selected.
 */
export declare const bindReporter: <TState>(reporter: TReporter<TState>) => TReporterInstance;
