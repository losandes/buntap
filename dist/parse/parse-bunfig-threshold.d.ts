import type { TCoverageThresholdPct } from '../typedefs/coverage.js';
import type { TSettlement } from '../typedefs/settlement.js';
/**
 * A hand-rolled reader for the one key, in the one section, this tool needs
 * (§5 rationale: no TOML dependency). Comments are stripped before anything
 * else is read (1.2.5); only a `coverageThreshold` inside `[test]` counts.
 */
export declare const parseBunfigThreshold: (toml: string) => TSettlement<TCoverageThresholdPct | undefined, string>;
