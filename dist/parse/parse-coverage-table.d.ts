import type { TCoverageRow } from '../typedefs/coverage.js';
/**
 * Locates the `File` header row and reads the `% Funcs`/`% Lines` column
 * indexes from it, rather than assuming positions, so a transposed table
 * still parses correctly (§2.2). Rule lines, blanks, the `All files` row,
 * and any row whose percentage cells do not parse as finite numbers are
 * skipped.
 */
export declare const parseCoverageTable: (lines: readonly string[]) => readonly TCoverageRow[];
