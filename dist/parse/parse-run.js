import { classifyLine } from './classify-line.js';
import { stripAnsi } from './strip-ansi.js';
export const initialParseState = {
    currentFile: undefined,
    diagnostics: [],
    coverage: { active: false, lines: [] },
    unhandledError: { active: false, openSeen: false, lines: [] },
    totals: { pass: 0, fail: 0, skip: 0, todo: 0, errors: 0, expectCalls: 0 },
};
const flushDiagnostics = (state) => state.diagnostics.length === 0
    ? { state, events: [] }
    : {
        state: { ...state, diagnostics: [] },
        events: [
            { type: 'passthrough', kind: 'output', lines: state.diagnostics },
        ],
    };
const stepCoverage = (state, line) => {
    if (classifyLine(line).kind === 'blank') {
        return {
            state: { ...state, coverage: { active: false, lines: [] } },
            events: [
                { type: 'passthrough', kind: 'coverage', lines: state.coverage.lines },
            ],
        };
    }
    return {
        state: {
            ...state,
            coverage: { active: true, lines: [...state.coverage.lines, line] },
        },
        events: [],
    };
};
const extractUnhandledMessage = (lines, file) => {
    const errorLine = lines.find((candidate) => candidate.startsWith('error:'));
    return errorLine
        ? errorLine.slice('error:'.length).trim()
        : (file ?? 'unhandled error');
};
const stepUnhandledError = (state, line) => {
    if (classifyLine(line).kind === 'dash-rule') {
        if (!state.unhandledError.openSeen) {
            return {
                state: {
                    ...state,
                    unhandledError: { ...state.unhandledError, openSeen: true },
                },
                events: [],
            };
        }
        const lines = state.unhandledError.lines;
        return {
            state: {
                ...state,
                unhandledError: { active: false, openSeen: false, lines: [] },
            },
            events: [
                {
                    type: 'unhandled-error',
                    file: state.currentFile,
                    message: extractUnhandledMessage(lines, state.currentFile),
                    diagnostics: lines,
                },
            ],
        };
    }
    return {
        state: {
            ...state,
            unhandledError: {
                ...state.unhandledError,
                lines: [...state.unhandledError.lines, line],
            },
        },
        events: [],
    };
};
/** One pure transition: the current state plus one raw input line in, the next state plus zero or more events out. */
export const stepLine = (state, rawLine) => {
    const line = stripAnsi(rawLine);
    if (state.coverage.active)
        return stepCoverage(state, line);
    if (state.unhandledError.active)
        return stepUnhandledError(state, line);
    const classified = classifyLine(line);
    switch (classified.kind) {
        case 'blank':
            return { state, events: [] };
        case 'banner':
            return {
                state,
                events: [
                    {
                        type: 'run-start',
                        version: classified.version,
                        revision: classified.revision,
                    },
                ],
            };
        case 'file-header': {
            const flushed = flushDiagnostics(state);
            return {
                state: { ...flushed.state, currentFile: classified.path },
                events: [
                    ...flushed.events,
                    { type: 'file-start', path: classified.path },
                ],
            };
        }
        case 'result': {
            const { diagnostics } = state;
            return {
                state: { ...state, diagnostics: [] },
                events: [
                    {
                        type: 'test',
                        status: classified.status,
                        file: state.currentFile,
                        name: classified.name,
                        path: classified.name.split(' > '),
                        durationMs: classified.durationMs,
                        diagnostics,
                    },
                ],
            };
        }
        case 'unhandled-error-banner': {
            const flushed = flushDiagnostics(state);
            return {
                state: {
                    ...flushed.state,
                    unhandledError: { active: true, openSeen: false, lines: [] },
                },
                events: flushed.events,
            };
        }
        case 'coverage-rule': {
            const flushed = flushDiagnostics(state);
            return {
                state: { ...flushed.state, coverage: { active: true, lines: [line] } },
                events: flushed.events,
            };
        }
        case 'dash-rule':
            return {
                state: { ...state, diagnostics: [...state.diagnostics, line] },
                events: [],
            };
        case 'summary-count': {
            const flushed = flushDiagnostics(state);
            return {
                state: {
                    ...flushed.state,
                    totals: {
                        ...flushed.state.totals,
                        [classified.field]: classified.value,
                    },
                },
                events: flushed.events,
            };
        }
        case 'summary-ran': {
            const flushed = flushDiagnostics(state);
            const totals = {
                ...flushed.state.totals,
                tests: classified.tests,
                files: classified.files,
                durationMs: classified.durationMs,
            };
            return {
                state: flushed.state,
                events: [
                    ...flushed.events,
                    { type: 'run-end', totals, summarySeen: true },
                ],
            };
        }
        case 'text':
            return {
                state: { ...state, diagnostics: [...state.diagnostics, line] },
                events: [],
            };
    }
};
const zeroTotals = {
    pass: 0,
    fail: 0,
    skip: 0,
    todo: 0,
    errors: 0,
    expectCalls: 0,
    tests: 0,
    files: 0,
    durationMs: undefined,
};
/** Events produced when the input ends without ever reaching a `summary-ran` line. */
export const finalizeParse = (state) => {
    const flushed = flushDiagnostics(state);
    const strayCoverage = state.coverage.active && state.coverage.lines.length > 0
        ? [{ type: 'passthrough', kind: 'coverage', lines: state.coverage.lines }]
        : [];
    const strayUnhandled = state.unhandledError.active && state.unhandledError.lines.length > 0
        ? [
            {
                type: 'passthrough',
                kind: 'output',
                lines: state.unhandledError.lines,
            },
        ]
        : [];
    return [
        ...flushed.events,
        ...strayCoverage,
        ...strayUnhandled,
        { type: 'run-end', totals: zeroTotals, summarySeen: false },
    ];
};
/**
 * The only stream-level recursion in the parser: each call awaits exactly one
 * line, threads the immutable state produced by `stepLine` into the next
 * call, and stops once a `run-end` event has been produced — which guarantees
 * run-end is emitted exactly once and is always last (§2.2).
 */
async function* consume(state, iterator) {
    const next = await iterator.next();
    if (next.done === true) {
        yield* finalizeParse(state);
        return;
    }
    const { state: nextState, events } = stepLine(state, next.value);
    yield* events;
    if (events.some((event) => event.type === 'run-end'))
        return;
    yield* consume(nextState, iterator);
}
export const parseRun = (lines) => consume(initialParseState, lines[Symbol.asyncIterator]());
//# sourceMappingURL=parse-run.js.map