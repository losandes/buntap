import { parseJsonLine } from './parse-json-line.js';
import { PROTOCOL_VERSION } from './protocol-event.js';
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isStringArray = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string');
const isOptional = (value, guard) => value === undefined || guard(value);
const isString = (value) => typeof value === 'string';
const isNumber = (value) => typeof value === 'number';
const isBoolean = (value) => typeof value === 'boolean';
const isNullableNumber = (value) => value === null || typeof value === 'number';
const isNullableString = (value) => value === null || typeof value === 'string';
const isTotals = (value) => isRecord(value) &&
    isNumber(value.pass) &&
    isNumber(value.fail) &&
    isNumber(value.skip) &&
    isNumber(value.todo) &&
    isNumber(value.errors) &&
    isNumber(value.expectCalls) &&
    isNumber(value.tests) &&
    isNumber(value.files) &&
    isOptional(value.durationMs, isNumber);
const isThresholdPct = (value) => isRecord(value) && isNumber(value.functionsPct) && isNumber(value.linesPct);
const isCoverageRow = (value) => isRecord(value) &&
    isString(value.file) &&
    isNumber(value.functionsPct) &&
    isNumber(value.linesPct);
const isCoverageRowArray = (value) => Array.isArray(value) && value.every(isCoverageRow);
/**
 * §1.3.4: validates the shape the wire format promises for each `type`,
 * one level deep. It does not re-validate every nested scalar inside
 * `totals` or `failing` beyond their own field types — this reader trusts
 * its own writer (`bunt`) for anything deeper, and a shallow mismatch here
 * still fails safely by falling through to the final `false`.
 */
const isWellFormed = (value) => {
    switch (value.type) {
        case 'runner-start':
            return isStringArray(value.argv);
        case 'runner-exit':
            return isNullableNumber(value.code) && isNullableString(value.signal);
        case 'run-start':
            return isString(value.version) && isOptional(value.revision, isString);
        case 'file-start':
            return isString(value.path);
        case 'test':
            return (isString(value.status) &&
                isOptional(value.file, isString) &&
                isString(value.name) &&
                isStringArray(value.path) &&
                isOptional(value.durationMs, isNumber) &&
                isStringArray(value.diagnostics));
        case 'unhandled-error':
            return (isOptional(value.file, isString) &&
                isString(value.message) &&
                isStringArray(value.diagnostics));
        case 'passthrough':
            return isString(value.kind) && isStringArray(value.lines);
        case 'run-end':
            return isTotals(value.totals) && isBoolean(value.summarySeen);
        case 'coverage-gate-failed':
            return (isThresholdPct(value.thresholdPct) && isCoverageRowArray(value.failing));
        default:
            return false;
    }
};
/**
 * §1.2.2: a line carrying a `v` other than the one this build recognises is
 * refused outright, before its shape is even considered. §1.3.1: this is the
 * same check mode detection uses to tell protocol input from raw text.
 */
export const hasRecognisedVersion = (value) => isRecord(value) && value.v === PROTOCOL_VERSION;
/** Decodes one protocol line, never throwing (§1.3.4). */
export const decodeProtocolLine = (line) => {
    const parsed = parseJsonLine(line);
    if (parsed.status === 'error')
        return parsed;
    if (!hasRecognisedVersion(parsed.data)) {
        return { status: 'error', error: 'unrecognised protocol line' };
    }
    if (typeof parsed.data.type !== 'string' || !isWellFormed(parsed.data)) {
        return { status: 'error', error: 'malformed protocol event' };
    }
    return { status: 'ok', data: parsed.data };
};
//# sourceMappingURL=decode-protocol-line.js.map