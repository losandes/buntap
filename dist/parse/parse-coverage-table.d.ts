import type { TCoverageRow, TCoverageTotals } from '../typedefs/coverage.js';
/**
 * Locates the `File` header row and reads the `% Funcs`/`% Lines` column
 * indexes from it, rather than assuming positions, so a transposed table
 * still parses correctly (§2.2). Rule lines, blanks, the `All files` row,
 * and any row whose percentage cells do not parse as finite numbers are
 * skipped.
 */
export declare const parseCoverageTable: (lines: readonly string[]) => readonly TCoverageRow[];
/**
 * §1.2.2: reads `% Funcs`/`% Lines` from the `All files` row and sets
 * `files` to the number of rows `parseCoverageTable` returns for the same
 * input. Returns `undefined` when there is no header row, no `All files`
 * row, or either percentage cell does not parse as a finite number.
 */
export declare const parseCoverageTotals: (lines: readonly string[]) => TCoverageTotals | undefined;
