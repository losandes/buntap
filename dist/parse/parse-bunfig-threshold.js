import { toThresholdPct } from '../lib/to-threshold-pct.js';
const RECOGNISED_KEYS = new Set(['lines', 'functions', 'statements']);
const UNINTERPRETABLE = {
    status: 'error',
    error: 'ignoring unreadable coverageThreshold in bunfig.toml',
};
const NO_GATE = {
    status: 'ok',
    data: undefined,
};
/** Naive but sufficient for this one key: cuts at the first `#`, which is
 * all §1.2.5's example (`coverageThreshold = 0.95 # { ... }`) needs. */
const stripComment = (line) => line.split('#')[0] ?? line;
const sectionHeaderOf = (line) => {
    const match = /^\[([^\]]+)\]$/.exec(line);
    return match?.[1]?.trim();
};
const parseEntry = (entry) => {
    const [rawKey, rawValue] = entry.split('=').map((part) => part.trim());
    if (rawKey === undefined || rawValue === undefined || rawKey === '')
        return undefined;
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric))
        return undefined;
    return { key: rawKey, value: numeric };
};
const parseInlineTable = (value) => {
    const inner = value.slice(1, -1).trim();
    if (inner === '')
        return { status: 'ok', data: {} };
    const entries = inner.split(',').map((pair) => pair.trim());
    const parsedEntries = entries.map(parseEntry);
    const validEntries = parsedEntries.filter((entry) => entry !== undefined);
    if (validEntries.length !== parsedEntries.length)
        return { status: 'error', error: undefined };
    const table = Object.fromEntries(validEntries
        .filter(({ key }) => RECOGNISED_KEYS.has(key))
        .map(({ key, value: entryValue }) => [key, entryValue]));
    return { status: 'ok', data: table };
};
const interpretInlineTable = (table) => {
    const hasRecognisedKey = Object.keys(table).some((key) => RECOGNISED_KEYS.has(key));
    if (!hasRecognisedKey)
        return undefined;
    const functionsPct = table.functions === undefined
        ? 100
        : (toThresholdPct(table.functions) ?? 100);
    const linesPct = table.lines === undefined ? 100 : (toThresholdPct(table.lines) ?? 100);
    return { functionsPct, linesPct };
};
const interpretValue = (value) => {
    const trimmed = value.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const table = parseInlineTable(trimmed);
        return table.status === 'error'
            ? UNINTERPRETABLE
            : { status: 'ok', data: interpretInlineTable(table.data) };
    }
    const numeric = Number(trimmed);
    if (trimmed !== '' && Number.isFinite(numeric)) {
        const pct = toThresholdPct(numeric);
        return pct === undefined
            ? UNINTERPRETABLE
            : { status: 'ok', data: { functionsPct: pct, linesPct: pct } };
    }
    return UNINTERPRETABLE;
};
const scanLine = (state, rawLine) => {
    if (state.found !== undefined)
        return state;
    const line = stripComment(rawLine).trim();
    const header = sectionHeaderOf(line);
    if (header !== undefined)
        return { ...state, section: header };
    if (state.section !== 'test')
        return state;
    const match = /^coverageThreshold\s*=\s*(.+)$/.exec(line);
    return match?.[1] === undefined
        ? state
        : { ...state, found: interpretValue(match[1]) };
};
/**
 * A hand-rolled reader for the one key, in the one section, this tool needs
 * (§5 rationale: no TOML dependency). Comments are stripped before anything
 * else is read (1.2.5); only a `coverageThreshold` inside `[test]` counts.
 */
export const parseBunfigThreshold = (toml) => {
    const final = toml.split('\n').reduce(scanLine, {
        section: '',
        found: undefined,
    });
    return final.found ?? NO_GATE;
};
//# sourceMappingURL=parse-bunfig-threshold.js.map