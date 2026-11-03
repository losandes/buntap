import type { TCoverageGateFailedEvent } from '../typedefs/run-events.js';
/**
 * The row's uncovered-lines suffix, shared by `formatCoverageGateFailure` and
 * the markdown reporter, which renders the gate block itself. The suffix
 * carries its own leading space, so a caller appends it unconditionally and
 * an empty array leaves the row untouched.
 */
export declare const formatUncoveredSuffix: (uncovered: readonly string[]) => string;
/**
 * The block is plain and colourless, so its bytes are identical and
 * greppable in every reporter. `formatUncoveredSuffix` is shared with the
 * markdown reporter, which renders this same block from its own template.
 */
export declare const formatCoverageGateFailure: (event: TCoverageGateFailedEvent) => readonly string[];
