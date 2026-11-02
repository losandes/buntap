import { toThresholdPct } from '../lib/to-threshold-pct.js';
const REPORTER_FLAGS = {
    '--nyan': 'nyan',
    '--markdown': 'markdown',
    '--block': 'block',
    '--agent': 'agent',
};
const KNOWN_FLAGS = new Set([
    ...Object.keys(REPORTER_FLAGS),
    '--color',
    '--no-color',
    '--help',
    '--version',
]);
const COVERAGE_THRESHOLD_PREFIX = '--coverage-threshold=';
const COVERAGE_REPORT_PREFIX = '--coverage-report=';
const COVERAGE_REPORT_MODES = new Set([
    'full',
    'failures',
    'summary',
    'bar',
    'markdown',
]);
/** §1.4.1: the mode used when `--coverage-report` is absent, chosen per reporter. */
const DEFAULT_COVERAGE_REPORT = {
    tap: 'full',
    agent: 'summary',
    markdown: 'markdown',
    nyan: 'bar',
    block: 'bar',
};
// §1.1.3: a bare `--coverage-report`, with no `=<mode>`, is still this flag
// (and the 1.1.2 usage error with an empty value), not an unknown flag -
// unlike `--coverage-threshold` bare, which stays unknown.
const isCoverageReportFlag = (flag) => flag === '--coverage-report' || flag.startsWith(COVERAGE_REPORT_PREFIX);
const isKnownFlag = (flag) => KNOWN_FLAGS.has(flag) ||
    flag.startsWith(COVERAGE_THRESHOLD_PREFIX) ||
    isCoverageReportFlag(flag);
/** §1.1.1-1.1.3: a known mode wins; anything else, including a bare flag with no value, is a usage error. */
const parseCoverageReportFlag = (argv) => {
    const raw = argv.find(isCoverageReportFlag);
    if (raw === undefined)
        return { status: 'ok', data: undefined };
    const value = raw.startsWith(COVERAGE_REPORT_PREFIX)
        ? raw.slice(COVERAGE_REPORT_PREFIX.length)
        : '';
    if (COVERAGE_REPORT_MODES.has(value)) {
        return { status: 'ok', data: value };
    }
    return {
        status: 'error',
        error: `invalid --coverage-report value '${value}'`,
    };
};
/** §1.2.2: accepts `0`–`1` as a fraction and `1`–`100` as a percentage; a non-finite, negative, or over-100 value is a usage error. */
const parseCoverageThresholdFlag = (argv) => {
    const raw = argv.find((flag) => flag.startsWith(COVERAGE_THRESHOLD_PREFIX));
    if (raw === undefined)
        return { status: 'ok', data: undefined };
    const value = Number(raw.slice(COVERAGE_THRESHOLD_PREFIX.length));
    const pct = toThresholdPct(value);
    if (pct === undefined) {
        return {
            status: 'error',
            error: `invalid --coverage-threshold value '${raw.slice(COVERAGE_THRESHOLD_PREFIX.length)}'`,
        };
    }
    return { status: 'ok', data: { functionsPct: pct, linesPct: pct } };
};
/** Pure argv parser: never throws, returns a settlement so the driver decides what to do with a usage error. */
export const parseCliOptions = (argv) => {
    const unknown = argv.find((flag) => !isKnownFlag(flag));
    if (unknown !== undefined) {
        return { status: 'error', error: `unknown flag '${unknown}'` };
    }
    const coverageThreshold = parseCoverageThresholdFlag(argv);
    if (coverageThreshold.status === 'error') {
        return { status: 'error', error: coverageThreshold.error };
    }
    const coverageReport = parseCoverageReportFlag(argv);
    if (coverageReport.status === 'error') {
        return { status: 'error', error: coverageReport.error };
    }
    if (argv.includes('--help'))
        return { status: 'ok', data: { mode: 'help' } };
    if (argv.includes('--version'))
        return { status: 'ok', data: { mode: 'version' } };
    const reporters = argv
        .map((flag) => REPORTER_FLAGS[flag])
        .filter((reporter) => reporter !== undefined);
    const distinctReporters = [...new Set(reporters)];
    if (distinctReporters.length > 1) {
        return { status: 'error', error: 'only one reporter flag may be given' };
    }
    const colorMode = argv.includes('--color')
        ? 'on'
        : argv.includes('--no-color')
            ? 'off'
            : 'auto';
    const reporter = distinctReporters[0] ?? 'tap';
    // §1.1.4: the tap reporter always reports coverage in full; any other
    // explicit mode given alongside it is a usage error rather than silently
    // discarded.
    if (reporter === 'tap' &&
        coverageReport.data !== undefined &&
        coverageReport.data !== 'full') {
        return {
            status: 'error',
            error: 'the tap reporter always reports coverage in full',
        };
    }
    return {
        status: 'ok',
        data: {
            mode: 'run',
            reporter,
            colorMode,
            coverageThresholdPct: coverageThreshold.data,
            coverageReport: coverageReport.data ?? DEFAULT_COVERAGE_REPORT[reporter],
        },
    };
};
//# sourceMappingURL=parse-cli-options.js.map