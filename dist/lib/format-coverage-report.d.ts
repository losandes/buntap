import type { TCoverageReportMode } from '../typedefs/cli-options.js';
import type { TCoverageThresholdPct } from '../typedefs/coverage.js';
import type { TConsoleStyles } from './console-styles.js';
export type TCoverageReportDeps = Readonly<{
    mode: TCoverageReportMode;
    styles: TConsoleStyles;
    thresholdPct: TCoverageThresholdPct | undefined;
}>;
/**
 * §1.3.1: the only place any coverage layout exists. Pure, taking the
 * styles it renders with as a dependency (§1.3.10) rather than creating
 * them, so the same input can be asserted with colour on and off.
 */
export declare const renderCoverageReport: (deps: TCoverageReportDeps) => (lines: readonly string[]) => readonly string[];
