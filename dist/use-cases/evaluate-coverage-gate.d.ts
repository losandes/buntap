import type { TCoverageThresholdPct } from '../typedefs/coverage.js';
import type { TRunEvent } from '../typedefs/run-events.js';
/**
 * §1.2.9: a `coverage-gate-failed` event is appended immediately after the
 * `passthrough`/`coverage` event it was derived from, only when a threshold
 * is configured and at least one per-file row is below it. Every other
 * event, including a coverage event with no threshold or with all rows
 * passing, passes through unchanged.
 */
export declare const evaluateCoverageGate: (thresholdPct: TCoverageThresholdPct | undefined) => (event: TRunEvent) => readonly TRunEvent[];
