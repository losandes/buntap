import { parseCoverageTable } from '../parse/parse-coverage-table.js';
const fails = (row, thresholdPct) => row.functionsPct < thresholdPct.functionsPct ||
    row.linesPct < thresholdPct.linesPct;
/**
 * §1.2.9: a `coverage-gate-failed` event is appended immediately after the
 * `passthrough`/`coverage` event it was derived from, only when a threshold
 * is configured and at least one per-file row is below it. Every other
 * event, including a coverage event with no threshold or with all rows
 * passing, passes through unchanged.
 */
export const evaluateCoverageGate = (thresholdPct) => (event) => {
    if (event.type !== 'passthrough' || event.kind !== 'coverage')
        return [event];
    if (thresholdPct === undefined)
        return [event];
    const rows = parseCoverageTable(event.lines);
    const failing = rows.filter((row) => fails(row, thresholdPct));
    if (failing.length === 0)
        return [event];
    return [event, { type: 'coverage-gate-failed', thresholdPct, failing }];
};
//# sourceMappingURL=evaluate-coverage-gate.js.map