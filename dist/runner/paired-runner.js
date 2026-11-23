import { formatPairedCoverageTable } from '../lib/format-paired-coverage-table.js';
import { parseCoverageTable } from '../parse/parse-coverage-table.js';
import { parseDiscoveredFiles } from '../parse/parse-discovered-files.js';
import { parseRun } from '../parse/parse-run.js';
import { readLines } from '../parse/read-lines.js';
import { encodePairedUnresolved, encodeRunEvent, encodeRunnerExit, encodeRunnerStart, } from '../protocol/encode-protocol-line.js';
import { mapWithConcurrency } from './map-with-concurrency.js';
import { mergeAsyncIterables } from './merge-async-iterables.js';
import { planPairedUnits } from './plan-paired-units.js';
import { findUnmatchedFilters, resolvePairedArguments, } from './resolve-paired-arguments.js';
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
const sumTotals = (totals, next) => ({
    pass: totals.pass + next.pass,
    fail: totals.fail + next.fail,
    skip: totals.skip + next.skip,
    todo: totals.todo + next.todo,
    errors: totals.errors + next.errors,
    expectCalls: totals.expectCalls + next.expectCalls,
    tests: totals.tests + next.tests,
    files: totals.files + next.files,
    durationMs: undefined,
});
export const runPaired = (deps) => async (args) => {
    const resolution = resolvePairedArguments(deps)(args);
    const started = deps.now();
    deps.write(encodeRunnerStart(args.argv));
    // Streaming process coordination is local to this invocation. A signal
    // must see the current live children, including discovery, not a snapshot.
    let live = [];
    let receivedSignal;
    const discovery = args.filters.length > 0 && resolution.discoveryFilters.length === 0
        ? undefined
        : deps.spawn([
            ...args.flags,
            ...resolution.discoveryFilters,
            '--test-name-pattern=(?!)',
        ], { omitEnv: ['CLAUDECODE', 'AGENT', 'REPL_ID'] });
    live = discovery === undefined ? [] : [discovery];
    const unregister = deps.onSignal((signal) => {
        receivedSignal = signal;
        live.forEach((child) => {
            child.kill(signal);
        });
    });
    try {
        const discoveryLines = discovery === undefined
            ? []
            : await Array.fromAsync(readLines(mergeAsyncIterables([discovery.stdout, discovery.stderr])));
        const discoveryResult = discovery === undefined ? undefined : await discovery.exited;
        live = [];
        const discovered = parseDiscoveredFiles(discoveryLines);
        if (discovered.status === 'error') {
            deps.writeError(`bunt: ${discovered.error}\n`);
            deps.write(encodeRunnerExit(2, null));
            return 2;
        }
        const unmatched = findUnmatchedFilters(deps.cwd)(resolution.discoveryFilters, discovered.data);
        if (resolution.untested.length > 0 || unmatched.length > 0)
            deps.write(encodePairedUnresolved(resolution.untested, unmatched));
        const units = planPairedUnits(deps)([
            ...discovered.data,
            ...resolution.familyTests,
        ]);
        if (units.length === 0) {
            deps.writeError(`bunt: no test files matched\n${discovery === undefined ? '' : `${discoveryLines.join('\n')}\n`}`);
            const signal = discoveryResult?.signal ?? null;
            const code = signal !== null
                ? (discoveryResult?.code ?? null)
                : resolution.untested.length > 0
                    ? 0
                    : args.flags.includes('--pass-with-no-tests') &&
                        (discoveryResult === undefined || discoveryResult.code === 0)
                        ? 0
                        : discoveryResult?.code || 1;
            deps.write(encodeRunnerExit(code, signal));
            if (signal !== null)
                return code === 4 && resolution.untested.length === 0
                    ? 2
                    : (code ?? 1);
            if (resolution.untested.length > 0)
                return 4;
            return code === 4 ? 2 : (code ?? 1);
        }
        const runFile = async (unit) => {
            if (receivedSignal !== undefined)
                return undefined;
            const child = deps.spawn([
                ...args.flags,
                '--coverage',
                '--',
                ...unit.tests.map((file) => `./${file}`),
            ]);
            live = [...live, child];
            const events = await Array.fromAsync(parseRun(readLines(mergeAsyncIterables([child.stdout, child.stderr]))));
            const result = await child.exited;
            live = live.filter((handle) => handle !== child);
            const summarySeen = events.some((event) => event.type === 'run-end' && event.summarySeen);
            const source = unit.source;
            const coverage = events.flatMap((event) => event.type === 'passthrough' && event.kind === 'coverage'
                ? event.lines
                : []);
            const row = source !== undefined && summarySeen
                ? (parseCoverageTable(coverage).find((candidate) => candidate.file === source) ?? {
                    file: source,
                    functionsPct: 0,
                    linesPct: 0,
                    uncovered: [],
                })
                : undefined;
            return { events, result, row, summarySeen };
        };
        const pending = mapWithConcurrency(args.concurrency ?? deps.defaultConcurrency)(units, runFile).map((promise) => Promise.allSettled([promise]));
        // Settle each file immediately, but await in discovery order so a defect
        // cannot drop later work or cause an unhandled rejection while we wait.
        let completed = [];
        let bannerSeen = false;
        for (const promise of pending) {
            const outcomes = await promise;
            completed = [...completed, ...outcomes];
            const outcome = outcomes[0];
            if (outcome?.status !== 'fulfilled' || outcome.value === undefined)
                continue;
            const run = outcome.value;
            for (const event of run.events) {
                if (event.type === 'run-end' ||
                    (event.type === 'passthrough' && event.kind === 'coverage'))
                    continue;
                if (event.type === 'run-start') {
                    if (bannerSeen)
                        continue;
                    bannerSeen = true;
                }
                deps.write(encodeRunEvent(event));
            }
        }
        const failures = completed.flatMap((outcome) => outcome.status === 'rejected' ? [outcome.reason] : []);
        if (failures.length > 0)
            throw new AggregateError(failures, `bunt: ${failures.length} test-file processes could not be collected`);
        const runs = completed.flatMap((outcome) => outcome.status === 'fulfilled' && outcome.value !== undefined
            ? [outcome.value]
            : []);
        const rows = runs
            .flatMap((run) => (run.row === undefined ? [] : [run.row]))
            .toSorted((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
        if (rows.length > 0)
            deps.write(encodeRunEvent({
                type: 'passthrough',
                kind: 'coverage',
                lines: formatPairedCoverageTable(rows),
            }));
        const totals = {
            ...runs
                .flatMap((run) => run.events.flatMap((event) => event.type === 'run-end' ? [event.totals] : []))
                .reduce(sumTotals, zeroTotals),
            durationMs: deps.now() - started,
        };
        deps.write(encodeRunEvent({
            type: 'run-end',
            totals,
            summarySeen: runs.every((run) => run.summarySeen),
        }));
        const signalled = runs.find((run) => run.result.signal !== null);
        const incomplete = runs.find((run) => !run.summarySeen);
        const signal = receivedSignal ?? signalled?.result.signal ?? null;
        const code = signal !== null
            ? null
            : incomplete === undefined
                ? 0
                : incomplete.result.code || 1;
        deps.write(encodeRunnerExit(code, signal));
        return code === null
            ? 1
            : code !== 0
                ? code === 4 && resolution.untested.length === 0
                    ? 2
                    : code
                : totals.fail + totals.errors > 0
                    ? 1
                    : resolution.untested.length > 0
                        ? 4
                        : 0;
    }
    finally {
        unregister();
    }
};
//# sourceMappingURL=paired-runner.js.map