import type { TCoverageGateFailedEvent } from '../typedefs/run-events.js';
/**
 * §2.4: the only place this wording exists. No ANSI colour, so the bytes are
 * identical and greppable in every reporter.
 */
export declare const formatCoverageGateFailure: (event: TCoverageGateFailedEvent) => readonly string[];
