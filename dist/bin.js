#!/usr/bin/env node

// src/bin.ts
import { readFileSync } from "node:fs";

// src/lib/to-threshold-pct.ts
var toThresholdPct = (value) => {
  if (!Number.isFinite(value))
    return;
  if (value < 0 || value > 100)
    return;
  if (value <= 1)
    return value * 100;
  return value;
};

// src/parse/parse-bunfig-threshold.ts
var RECOGNISED_KEYS = new Set(["lines", "functions", "statements"]);
var UNINTERPRETABLE = {
  status: "error",
  error: "ignoring unreadable coverageThreshold in bunfig.toml"
};
var NO_GATE = {
  status: "ok",
  data: undefined
};
var stripComment = (line) => line.split("#")[0] ?? line;
var sectionHeaderOf = (line) => {
  const match = /^\[([^\]]+)\]$/.exec(line);
  return match?.[1]?.trim();
};
var parseEntry = (entry) => {
  const [rawKey, rawValue] = entry.split("=").map((part) => part.trim());
  if (rawKey === undefined || rawValue === undefined || rawKey === "")
    return;
  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric))
    return;
  return { key: rawKey, value: numeric };
};
var parseInlineTable = (value) => {
  const inner = value.slice(1, -1).trim();
  if (inner === "")
    return { status: "ok", data: {} };
  const entries = inner.split(",").map((pair) => pair.trim());
  const parsedEntries = entries.map(parseEntry);
  const validEntries = parsedEntries.filter((entry) => entry !== undefined);
  if (validEntries.length !== parsedEntries.length)
    return { status: "error", error: undefined };
  const table = Object.fromEntries(validEntries.filter(({ key }) => RECOGNISED_KEYS.has(key)).map(({ key, value: entryValue }) => [key, entryValue]));
  return { status: "ok", data: table };
};
var interpretInlineTable = (table) => {
  const hasRecognisedKey = Object.keys(table).some((key) => RECOGNISED_KEYS.has(key));
  if (!hasRecognisedKey)
    return;
  const functionsPct = table.functions === undefined ? 100 : toThresholdPct(table.functions) ?? 100;
  const linesPct = table.lines === undefined ? 100 : toThresholdPct(table.lines) ?? 100;
  return { functionsPct, linesPct };
};
var interpretValue = (value) => {
  const trimmed = value.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    const table = parseInlineTable(trimmed);
    return table.status === "error" ? UNINTERPRETABLE : { status: "ok", data: interpretInlineTable(table.data) };
  }
  const numeric = Number(trimmed);
  if (trimmed !== "" && Number.isFinite(numeric)) {
    const pct = toThresholdPct(numeric);
    return pct === undefined ? UNINTERPRETABLE : { status: "ok", data: { functionsPct: pct, linesPct: pct } };
  }
  return UNINTERPRETABLE;
};
var scanLine = (state, rawLine) => {
  if (state.found !== undefined)
    return state;
  const line = stripComment(rawLine).trim();
  const header = sectionHeaderOf(line);
  if (header !== undefined)
    return { ...state, section: header };
  if (state.section !== "test")
    return state;
  const match = /^coverageThreshold\s*=\s*(.+)$/.exec(line);
  return match?.[1] === undefined ? state : { ...state, found: interpretValue(match[1]) };
};
var parseBunfigThreshold = (toml) => {
  const final = toml.split(`
`).reduce(scanLine, {
    section: "",
    found: undefined
  });
  return final.found ?? NO_GATE;
};

// src/parse/classify-line.ts
var BANNER = /^bun test v(\S+)(?:\s+\(([0-9a-fA-F]+)\))?$/;
var FILE_HEADER = /^(\S+[._](?:test|spec)\.(?:ts|tsx|js|jsx|mts|cts|mjs|cjs)):$/;
var RESULT = /^\((pass|fail|skip|todo)\)\s+(.*?)(?:\s+\[(\d+(?:\.\d+)?)(ms|s)\])?$/;
var DASH_RULE = /^-+$/;
var COVERAGE_RULE = /^-{2,}\|/;
var SUMMARY_STATUS_COUNT = /^ (\d+) (pass|fail|skip|todo|error)$/;
var SUMMARY_EXPECT_COUNT = /^ (\d+) expect\(\) calls$/;
var SUMMARY_RAN = /^Ran (\d+) tests? across (\d+) files?\.(?:\s+\[(\d+(?:\.\d+)?)(ms|s)\])?$/;
var toMs = (amount, unit) => unit === "s" ? Number(amount) * 1000 : Number(amount);
var classifyLine = (line) => {
  if (line.trim().length === 0)
    return { kind: "blank" };
  if (line === "# Unhandled error between tests")
    return { kind: "unhandled-error-banner" };
  const banner = BANNER.exec(line);
  if (banner) {
    const [, version, revision] = banner;
    return {
      kind: "banner",
      version: version ?? "",
      revision: revision ?? undefined
    };
  }
  const fileHeader = FILE_HEADER.exec(line);
  if (fileHeader)
    return { kind: "file-header", path: fileHeader[1] ?? "" };
  const result = RESULT.exec(line);
  if (result) {
    const [, status, name, amount, unit] = result;
    return {
      kind: "result",
      status,
      name: name ?? "",
      durationMs: amount && unit ? toMs(amount, unit) : undefined
    };
  }
  if (COVERAGE_RULE.test(line))
    return { kind: "coverage-rule" };
  if (DASH_RULE.test(line))
    return { kind: "dash-rule" };
  const ran = SUMMARY_RAN.exec(line);
  if (ran) {
    const [, tests, files, amount, unit] = ran;
    return {
      kind: "summary-ran",
      tests: Number(tests),
      files: Number(files),
      durationMs: amount && unit ? toMs(amount, unit) : undefined
    };
  }
  const statusCount = SUMMARY_STATUS_COUNT.exec(line);
  if (statusCount) {
    const [, value, field] = statusCount;
    return {
      kind: "summary-count",
      field: field === "error" ? "errors" : field,
      value: Number(value)
    };
  }
  const expectCount = SUMMARY_EXPECT_COUNT.exec(line);
  if (expectCount) {
    return {
      kind: "summary-count",
      field: "expectCalls",
      value: Number(expectCount[1])
    };
  }
  return { kind: "text", raw: line };
};

// src/parse/strip-ansi.ts
var ESC = "\x1B";
var CSI = "";
var ANSI_PATTERN = new RegExp(`[${ESC}${CSI}][[\\]()#;?]*(?:(?:[a-zA-Z0-9]*(?:;[a-zA-Z0-9]*)*)?\\u0007|(?:\\d{1,4}(?:;\\d{0,4})*)?[0-9A-ORZcf-nqry=><~])`, "g");
var stripAnsi = (line) => line.replace(ANSI_PATTERN, "");

// src/parse/parse-run.ts
var initialParseState = {
  currentFile: undefined,
  diagnostics: [],
  coverage: { active: false, lines: [] },
  unhandledError: { active: false, openSeen: false, lines: [] },
  totals: { pass: 0, fail: 0, skip: 0, todo: 0, errors: 0, expectCalls: 0 }
};
var flushDiagnostics = (state) => state.diagnostics.length === 0 ? { state, events: [] } : {
  state: { ...state, diagnostics: [] },
  events: [
    { type: "passthrough", kind: "output", lines: state.diagnostics }
  ]
};
var stepCoverage = (state, line) => {
  if (classifyLine(line).kind === "blank") {
    return {
      state: { ...state, coverage: { active: false, lines: [] } },
      events: [
        { type: "passthrough", kind: "coverage", lines: state.coverage.lines }
      ]
    };
  }
  return {
    state: {
      ...state,
      coverage: { active: true, lines: [...state.coverage.lines, line] }
    },
    events: []
  };
};
var extractUnhandledMessage = (lines, file) => {
  const errorLine = lines.find((candidate) => candidate.startsWith("error:"));
  return errorLine ? errorLine.slice("error:".length).trim() : file ?? "unhandled error";
};
var stepUnhandledError = (state, line) => {
  if (classifyLine(line).kind === "dash-rule") {
    if (!state.unhandledError.openSeen) {
      return {
        state: {
          ...state,
          unhandledError: { ...state.unhandledError, openSeen: true }
        },
        events: []
      };
    }
    const lines = state.unhandledError.lines;
    return {
      state: {
        ...state,
        unhandledError: { active: false, openSeen: false, lines: [] }
      },
      events: [
        {
          type: "unhandled-error",
          file: state.currentFile,
          message: extractUnhandledMessage(lines, state.currentFile),
          diagnostics: lines
        }
      ]
    };
  }
  return {
    state: {
      ...state,
      unhandledError: {
        ...state.unhandledError,
        lines: [...state.unhandledError.lines, line]
      }
    },
    events: []
  };
};
var stepLine = (state, rawLine) => {
  const line = stripAnsi(rawLine);
  if (state.coverage.active)
    return stepCoverage(state, line);
  if (state.unhandledError.active)
    return stepUnhandledError(state, line);
  const classified = classifyLine(line);
  switch (classified.kind) {
    case "blank":
      return { state, events: [] };
    case "banner":
      return {
        state,
        events: [
          {
            type: "run-start",
            version: classified.version,
            revision: classified.revision
          }
        ]
      };
    case "file-header": {
      const flushed = flushDiagnostics(state);
      return {
        state: { ...flushed.state, currentFile: classified.path },
        events: [
          ...flushed.events,
          { type: "file-start", path: classified.path }
        ]
      };
    }
    case "result": {
      const { diagnostics } = state;
      return {
        state: { ...state, diagnostics: [] },
        events: [
          {
            type: "test",
            status: classified.status,
            file: state.currentFile,
            name: classified.name,
            path: classified.name.split(" > "),
            durationMs: classified.durationMs,
            diagnostics
          }
        ]
      };
    }
    case "unhandled-error-banner": {
      const flushed = flushDiagnostics(state);
      return {
        state: {
          ...flushed.state,
          unhandledError: { active: true, openSeen: false, lines: [] }
        },
        events: flushed.events
      };
    }
    case "coverage-rule": {
      const flushed = flushDiagnostics(state);
      return {
        state: { ...flushed.state, coverage: { active: true, lines: [line] } },
        events: flushed.events
      };
    }
    case "dash-rule":
      return {
        state: { ...state, diagnostics: [...state.diagnostics, line] },
        events: []
      };
    case "summary-count": {
      const flushed = flushDiagnostics(state);
      return {
        state: {
          ...flushed.state,
          totals: {
            ...flushed.state.totals,
            [classified.field]: classified.value
          }
        },
        events: flushed.events
      };
    }
    case "summary-ran": {
      const flushed = flushDiagnostics(state);
      const totals = {
        ...flushed.state.totals,
        tests: classified.tests,
        files: classified.files,
        durationMs: classified.durationMs
      };
      return {
        state: flushed.state,
        events: [
          ...flushed.events,
          { type: "run-end", totals, summarySeen: true }
        ]
      };
    }
    case "text":
      return {
        state: { ...state, diagnostics: [...state.diagnostics, line] },
        events: []
      };
  }
};
var zeroTotals = {
  pass: 0,
  fail: 0,
  skip: 0,
  todo: 0,
  errors: 0,
  expectCalls: 0,
  tests: 0,
  files: 0,
  durationMs: undefined
};
var finalizeParse = (state) => {
  const flushed = flushDiagnostics(state);
  const strayCoverage = state.coverage.active && state.coverage.lines.length > 0 ? [{ type: "passthrough", kind: "coverage", lines: state.coverage.lines }] : [];
  const strayUnhandled = state.unhandledError.active && state.unhandledError.lines.length > 0 ? [
    {
      type: "passthrough",
      kind: "output",
      lines: state.unhandledError.lines
    }
  ] : [];
  return [
    ...flushed.events,
    ...strayCoverage,
    ...strayUnhandled,
    { type: "run-end", totals: zeroTotals, summarySeen: false }
  ];
};
async function* consume(state, iterator) {
  const next = await iterator.next();
  if (next.done === true) {
    yield* finalizeParse(state);
    return;
  }
  const { state: nextState, events } = stepLine(state, next.value);
  yield* events;
  if (events.some((event) => event.type === "run-end"))
    return;
  yield* consume(nextState, iterator);
}
var parseRun = (lines) => consume(initialParseState, lines[Symbol.asyncIterator]());

// src/parse/peek-first-line.ts
var toAsyncIterable = (buffered, iterator) => ({
  [Symbol.asyncIterator]: () => {
    const prefix = buffered[Symbol.iterator]();
    return {
      next: () => {
        const fromPrefix = prefix.next();
        return fromPrefix.done !== true ? Promise.resolve(fromPrefix) : iterator.next();
      }
    };
  }
});
var consume2 = async (iterator, buffered) => {
  const next = await iterator.next();
  if (next.done === true) {
    return { firstLine: undefined, rest: toAsyncIterable(buffered, iterator) };
  }
  if (next.value.trim().length > 0) {
    return {
      firstLine: next.value,
      rest: toAsyncIterable([...buffered, next.value], iterator)
    };
  }
  return consume2(iterator, [...buffered, next.value]);
};
var peekFirstNonEmptyLine = (lines) => consume2(lines[Symbol.asyncIterator](), []);

// src/protocol/parse-json-line.ts
var parseJsonLine = (line) => {
  try {
    return { status: "ok", data: JSON.parse(line) };
  } catch (err) {
    return {
      status: "error",
      error: err instanceof Error ? err.message : "invalid JSON"
    };
  }
};

// src/protocol/protocol-event.ts
var PROTOCOL_VERSION = 1;

// src/protocol/decode-protocol-line.ts
var isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var isStringArray = (value) => Array.isArray(value) && value.every((item) => typeof item === "string");
var isOptional = (value, guard) => value === undefined || guard(value);
var isString = (value) => typeof value === "string";
var isNumber = (value) => typeof value === "number";
var isBoolean = (value) => typeof value === "boolean";
var isNullableNumber = (value) => value === null || typeof value === "number";
var isNullableString = (value) => value === null || typeof value === "string";
var isTotals = (value) => isRecord(value) && isNumber(value.pass) && isNumber(value.fail) && isNumber(value.skip) && isNumber(value.todo) && isNumber(value.errors) && isNumber(value.expectCalls) && isNumber(value.tests) && isNumber(value.files) && isOptional(value.durationMs, isNumber);
var isThresholdPct = (value) => isRecord(value) && isNumber(value.functionsPct) && isNumber(value.linesPct);
var isCoverageRow = (value) => isRecord(value) && isString(value.file) && isNumber(value.functionsPct) && isNumber(value.linesPct);
var isCoverageRowArray = (value) => Array.isArray(value) && value.every(isCoverageRow);
var isWellFormed = (value) => {
  switch (value.type) {
    case "runner-start":
      return isStringArray(value.argv);
    case "runner-exit":
      return isNullableNumber(value.code) && isNullableString(value.signal);
    case "run-start":
      return isString(value.version) && isOptional(value.revision, isString);
    case "file-start":
      return isString(value.path);
    case "test":
      return isString(value.status) && isOptional(value.file, isString) && isString(value.name) && isStringArray(value.path) && isOptional(value.durationMs, isNumber) && isStringArray(value.diagnostics);
    case "unhandled-error":
      return isOptional(value.file, isString) && isString(value.message) && isStringArray(value.diagnostics);
    case "passthrough":
      return isString(value.kind) && isStringArray(value.lines);
    case "run-end":
      return isTotals(value.totals) && isBoolean(value.summarySeen);
    case "coverage-gate-failed":
      return isThresholdPct(value.thresholdPct) && isCoverageRowArray(value.failing);
    default:
      return false;
  }
};
var hasRecognisedVersion = (value) => isRecord(value) && value.v === PROTOCOL_VERSION;
var decodeProtocolLine = (line) => {
  const parsed = parseJsonLine(line);
  if (parsed.status === "error")
    return parsed;
  if (!hasRecognisedVersion(parsed.data)) {
    return { status: "error", error: "unrecognised protocol line" };
  }
  if (typeof parsed.data.type !== "string" || !isWellFormed(parsed.data)) {
    return { status: "error", error: "malformed protocol event" };
  }
  return { status: "ok", data: parsed.data };
};

// src/use-cases/detect-input-mode.ts
var detectInputMode = (firstNonEmptyLine) => decodeProtocolLine(firstNonEmptyLine).status === "ok" ? "protocol" : "text";

// src/parse/parse-coverage-table.ts
var splitCells = (line) => line.split("|").map((cell) => cell.trim());
var findHeaderIndex = (rows) => rows.findIndex((cells) => cells[0] === "File");
var parseCoverageTable = (lines) => {
  const rows = lines.map(splitCells);
  const headerIndex = findHeaderIndex(rows);
  if (headerIndex === -1)
    return [];
  const header = rows[headerIndex];
  const funcsIndex = header.indexOf("% Funcs");
  const linesIndex = header.indexOf("% Lines");
  if (funcsIndex === -1 || linesIndex === -1)
    return [];
  const toRow = (cells) => {
    const file = cells[0];
    if (file === undefined || file === "" || file === "All files")
      return;
    const functionsPct = Number(cells[funcsIndex]);
    const linesPct = Number(cells[linesIndex]);
    if (!(Number.isFinite(functionsPct) && Number.isFinite(linesPct)))
      return;
    return { file, functionsPct, linesPct };
  };
  return rows.slice(headerIndex + 1).map(toRow).filter((row) => row !== undefined);
};

// src/use-cases/evaluate-coverage-gate.ts
var fails = (row, thresholdPct) => row.functionsPct < thresholdPct.functionsPct || row.linesPct < thresholdPct.linesPct;
var evaluateCoverageGate = (thresholdPct) => (event) => {
  if (event.type !== "passthrough" || event.kind !== "coverage")
    return [event];
  if (thresholdPct === undefined)
    return [event];
  const rows = parseCoverageTable(event.lines);
  const failing = rows.filter((row) => fails(row, thresholdPct));
  if (failing.length === 0)
    return [event];
  return [event, { type: "coverage-gate-failed", thresholdPct, failing }];
};

// src/use-cases/parse-cli-options.ts
var REPORTER_FLAGS = {
  "--nyan": "nyan",
  "--markdown": "markdown",
  "--block": "block",
  "--agent": "agent"
};
var KNOWN_FLAGS = new Set([
  ...Object.keys(REPORTER_FLAGS),
  "--color",
  "--no-color",
  "--help",
  "--version"
]);
var COVERAGE_THRESHOLD_PREFIX = "--coverage-threshold=";
var isKnownFlag = (flag) => KNOWN_FLAGS.has(flag) || flag.startsWith(COVERAGE_THRESHOLD_PREFIX);
var parseCoverageThresholdFlag = (argv) => {
  const raw = argv.find((flag) => flag.startsWith(COVERAGE_THRESHOLD_PREFIX));
  if (raw === undefined)
    return { status: "ok", data: undefined };
  const value = Number(raw.slice(COVERAGE_THRESHOLD_PREFIX.length));
  const pct = toThresholdPct(value);
  if (pct === undefined) {
    return {
      status: "error",
      error: `invalid --coverage-threshold value '${raw.slice(COVERAGE_THRESHOLD_PREFIX.length)}'`
    };
  }
  return { status: "ok", data: { functionsPct: pct, linesPct: pct } };
};
var parseCliOptions = (argv) => {
  const unknown = argv.find((flag) => !isKnownFlag(flag));
  if (unknown !== undefined) {
    return { status: "error", error: `unknown flag '${unknown}'` };
  }
  const coverageThreshold = parseCoverageThresholdFlag(argv);
  if (coverageThreshold.status === "error") {
    return { status: "error", error: coverageThreshold.error };
  }
  if (argv.includes("--help"))
    return { status: "ok", data: { mode: "help" } };
  if (argv.includes("--version"))
    return { status: "ok", data: { mode: "version" } };
  const reporters = argv.map((flag) => REPORTER_FLAGS[flag]).filter((reporter) => reporter !== undefined);
  const distinctReporters = [...new Set(reporters)];
  if (distinctReporters.length > 1) {
    return { status: "error", error: "only one reporter flag may be given" };
  }
  const colorMode = argv.includes("--color") ? "on" : argv.includes("--no-color") ? "off" : "auto";
  return {
    status: "ok",
    data: {
      mode: "run",
      reporter: distinctReporters[0] ?? "tap",
      colorMode,
      coverageThresholdPct: coverageThreshold.data
    }
  };
};

// src/use-cases/render-verdict-line.ts
var renderVerdictLine = (verdict) => `buntap: ${verdict.message} - exiting ${verdict.code}
`;

// src/use-cases/resolve-exit-code.ts
var initialExitState = {
  sawFailure: false,
  summarySeen: false,
  coverageGateFailed: false
};
var nextExitState = (state, event) => {
  if (event.type === "test" && event.status === "fail")
    return { ...state, sawFailure: true };
  if (event.type === "unhandled-error")
    return { ...state, sawFailure: true };
  if (event.type === "coverage-gate-failed")
    return { ...state, coverageGateFailed: true };
  if (event.type === "run-end") {
    return {
      sawFailure: state.sawFailure || event.totals.fail > 0 || event.totals.errors > 0,
      summarySeen: event.summarySeen,
      coverageGateFailed: state.coverageGateFailed
    };
  }
  return state;
};
var resolveExitCode = (state) => {
  if (!state.summarySeen)
    return 2;
  if (state.sawFailure)
    return 1;
  return state.coverageGateFailed ? 3 : 0;
};

// src/lib/signal-to-number.ts
import { constants } from "node:os";
var signalToNumber = (signal) => {
  const signals = constants.signals;
  return signals[signal];
};

// src/use-cases/resolve-protocol-exit-code.ts
var initialProtocolExitState = {
  exitState: initialExitState,
  totals: undefined,
  runnerExit: undefined
};
var nextProtocolExitState = (state, event) => {
  if (event.type === "runner-start")
    return state;
  if (event.type === "runner-exit") {
    return {
      ...state,
      runnerExit: { code: event.code, signal: event.signal }
    };
  }
  return {
    ...state,
    exitState: nextExitState(state.exitState, event),
    totals: event.type === "run-end" ? event.totals : state.totals
  };
};
var pluralTests = (count) => `${count} test${count === 1 ? "" : "s"}`;
var resolveProtocolVerdict = (state) => {
  const fail = (state.totals?.fail ?? 0) + (state.totals?.errors ?? 0);
  if (state.exitState.sawFailure) {
    return { code: 1, message: `${pluralTests(fail)} failed` };
  }
  if (state.exitState.coverageGateFailed) {
    return { code: 3, message: "coverage below the configured minimum" };
  }
  const { runnerExit } = state;
  if (runnerExit !== undefined && runnerExit.signal !== null) {
    const signalNumber = signalToNumber(runnerExit.signal) ?? 0;
    return {
      code: 128 + signalNumber,
      message: `bun was killed by ${runnerExit.signal}`
    };
  }
  if (runnerExit !== undefined && runnerExit.code !== null && runnerExit.code !== 0) {
    return {
      code: runnerExit.code,
      message: `bun exited ${runnerExit.code} before reporting any tests`
    };
  }
  if (runnerExit === undefined) {
    return {
      code: 2,
      message: "the runner stopped without reporting its exit code"
    };
  }
  return { code: 0, message: `${pluralTests(state.totals?.pass ?? 0)} passed` };
};

// src/lib/format-coverage-gate.ts
var pct = (value) => value.toFixed(2);
var formatCoverageGateFailure = (event) => {
  const { thresholdPct, failing } = event;
  const noun = failing.length === 1 ? "file" : "files";
  const headline = `COVERAGE FAIL ${failing.length} ${noun} below the minimum (functions ${pct(thresholdPct.functionsPct)}%, lines ${pct(thresholdPct.linesPct)}%)`;
  const rows = failing.map((row) => `  ${row.file} functions ${pct(row.functionsPct)}%, lines ${pct(row.linesPct)}%`);
  return [headline, ...rows];
};

// src/lib/format-duration.ts
var formatDuration = (durationMs) => {
  if (durationMs === undefined)
    return "0.00ms";
  return `${durationMs.toFixed(2)}ms`;
};

// src/reporters/agent-reporter.ts
var zeroTotals2 = {
  pass: 0,
  fail: 0,
  skip: 0,
  todo: 0,
  errors: 0,
  expectCalls: 0,
  tests: 0,
  files: 0,
  durationMs: undefined
};
var renderFailure = (file, name, diagnostics) => [`FAIL ${file ?? "(unknown file)"} > ${name}`, ...diagnostics].join(`
`);
var agentReporter = (_deps) => ({
  initial: { totals: undefined },
  next: (state, event) => {
    if (event.type === "test" && event.status === "fail") {
      return {
        state,
        output: `${renderFailure(event.file, event.name, event.diagnostics)}
`
      };
    }
    if (event.type === "unhandled-error") {
      return {
        state,
        output: `${renderFailure(event.file, event.message, event.diagnostics)}
`
      };
    }
    if (event.type === "passthrough" && event.kind === "coverage") {
      return event.lines.length > 0 ? { state, output: `
${event.lines.join(`
`)}
` } : { state, output: "" };
    }
    if (event.type === "coverage-gate-failed") {
      return {
        state,
        output: `${formatCoverageGateFailure(event).join(`
`)}
`
      };
    }
    if (event.type === "run-end") {
      return { state: { totals: event.totals }, output: "" };
    }
    return { state, output: "" };
  },
  end: (state) => {
    const totals = state.totals ?? zeroTotals2;
    return `${totals.tests} tests, ${totals.fail} failed, ${totals.skip} skipped, ${totals.todo} todo in ${formatDuration(totals.durationMs)}
`;
  }
});

// src/lib/console-styles.ts
var wrap = (open, close) => (input) => `\x1B[${open}m${input}\x1B[${close}m`;
var passthrough = (input) => input;
var createConsoleStyles = (color) => color ? {
  green: wrap(32, 39),
  red: wrap(31, 39),
  yellow: wrap(33, 39),
  cyan: wrap(96, 39),
  black: wrap(30, 39),
  bgGreen: wrap(42, 49),
  bgRed: wrap(41, 49),
  bgYellow: wrap(43, 49),
  bgCyan: wrap(46, 49),
  bgMagenta: wrap(45, 49),
  ansi256: (code, input) => `\x1B[38;5;${code}m${input}\x1B[0m`
} : {
  green: passthrough,
  red: passthrough,
  yellow: passthrough,
  cyan: passthrough,
  black: passthrough,
  bgGreen: passthrough,
  bgRed: passthrough,
  bgYellow: passthrough,
  bgCyan: passthrough,
  bgMagenta: passthrough,
  ansi256: (_code, input) => input
};
var cursorUp = (lines) => lines > 0 ? `\x1B[${lines}A` : "";
var hideCursor = () => "\x1B[?25l";
var showCursor = () => "\x1B[?25h";

// src/reporters/block-reporter.ts
var badgeFor = (styles, status) => {
  if (status === "pass")
    return styles.bgGreen(styles.black(" PASS "));
  if (status === "fail" || status === "error")
    return styles.bgRed(styles.black(" FAIL "));
  if (status === "skip")
    return styles.bgYellow(styles.black(" SKIP "));
  return styles.bgCyan(styles.black(" TODO "));
};
var blockReporter = (deps) => {
  const styles = createConsoleStyles(deps.color);
  return {
    initial: { failures: [] },
    next: (state, event) => {
      if (event.type === "test") {
        const badge = badgeFor(styles, event.status);
        const line = `${badge} ${event.name}`;
        if (event.status !== "fail")
          return { state, output: `${line}
` };
        const detail = event.diagnostics.map((diagnosticLine) => `  ${diagnosticLine}`).join(`
`);
        const block = detail.length > 0 ? `${line}
${detail}
` : `${line}
`;
        return {
          state: { failures: [...state.failures, event.name] },
          output: block
        };
      }
      if (event.type === "unhandled-error") {
        const badge = badgeFor(styles, "error");
        const detail = event.diagnostics.map((diagnosticLine) => `  ${diagnosticLine}`).join(`
`);
        return {
          state: {
            failures: [...state.failures, event.file ?? "unhandled error"]
          },
          output: `${badge} ${event.file ?? "unhandled error"}
${detail}
`
        };
      }
      if (event.type === "passthrough" && event.kind === "coverage") {
        return event.lines.length > 0 ? { state, output: `
${event.lines.join(`
`)}
` } : { state, output: "" };
      }
      if (event.type === "coverage-gate-failed") {
        return {
          state,
          output: `${formatCoverageGateFailure(event).join(`
`)}
`
        };
      }
      if (event.type === "run-end") {
        const totals = event.totals;
        const summary = `${totals.tests} tests, ${totals.pass} passed, ${totals.fail} failed, ${totals.skip} skipped in ${formatDuration(totals.durationMs)}
`;
        return { state, output: `
${summary}` };
      }
      return { state, output: "" };
    },
    end: () => ""
  };
};

// src/reporters/markdown-reporter.ts
var zeroTotals3 = {
  pass: 0,
  fail: 0,
  skip: 0,
  todo: 0,
  errors: 0,
  expectCalls: 0,
  tests: 0,
  files: 0,
  durationMs: undefined
};
var groupByHead = (paths) => {
  const groups = new Map;
  for (const path of paths) {
    if (path.length === 0)
      continue;
    const head = path[0];
    const tail = path.slice(1);
    const existing = groups.get(head) ?? [];
    groups.set(head, tail.length > 0 ? [...existing, tail] : existing);
  }
  return groups;
};
var renderBullets = (paths, indent) => [...groupByHead(paths).entries()].map(([head, group]) => {
  const bullet = `${"  ".repeat(indent)}- ${head}`;
  return group.length > 0 ? `${bullet}
${renderBullets(group, indent + 1)}` : bullet;
}).join(`
`);
var renderErrors = (failures) => {
  if (failures.length === 0)
    return "";
  const sections = failures.map((failure) => `#### ${failure.name}

\`\`\`text
${failure.diagnostics.join(`
`)}
\`\`\``).join(`

`);
  return `

## Errors

${sections}`;
};
var renderCoverage = (coverageLines, gateFailureLines) => {
  if (coverageLines.length === 0)
    return "";
  const table = `\`\`\`text
${coverageLines.join(`
`)}
\`\`\``;
  const gateSection = gateFailureLines.length === 0 ? "" : `

${gateFailureLines.join(`
`)}`;
  return `

## Coverage

${table}${gateSection}`;
};
var renderTotals = (totals) => [
  "## Totals",
  "",
  `- **total**: ${totals.tests}`,
  `- **passed**: ${totals.pass}`,
  `- **failed**: ${totals.fail}`,
  `- **skipped**: ${totals.skip}`,
  `- **duration**: ${formatDuration(totals.durationMs)}`
].join(`
`);
var markdownReporter = (_deps) => ({
  initial: {
    paths: [],
    failures: [],
    totals: undefined,
    coverageLines: [],
    gateFailureLines: []
  },
  next: (state, event) => {
    if (event.type === "test") {
      const fullPath = [event.file ?? "(unknown file)", ...event.path];
      const nextFailures = event.status === "fail" ? [
        ...state.failures,
        { name: event.name, diagnostics: event.diagnostics }
      ] : state.failures;
      return {
        state: {
          ...state,
          paths: [...state.paths, fullPath],
          failures: nextFailures
        },
        output: ""
      };
    }
    if (event.type === "unhandled-error") {
      const name = event.file ?? "unhandled error";
      return {
        state: {
          ...state,
          paths: [...state.paths, [name]],
          failures: [
            ...state.failures,
            { name, diagnostics: event.diagnostics }
          ]
        },
        output: ""
      };
    }
    if (event.type === "passthrough" && event.kind === "coverage") {
      return {
        state: {
          ...state,
          coverageLines: [...state.coverageLines, ...event.lines]
        },
        output: ""
      };
    }
    if (event.type === "coverage-gate-failed") {
      const markdownLines = [
        `**COVERAGE FAIL** ${event.failing.length} ${event.failing.length === 1 ? "file" : "files"} below the minimum (functions ${event.thresholdPct.functionsPct.toFixed(2)}%, lines ${event.thresholdPct.linesPct.toFixed(2)}%)`,
        "",
        ...event.failing.map((row) => `- \`${row.file}\` functions ${row.functionsPct.toFixed(2)}%, lines ${row.linesPct.toFixed(2)}%`)
      ];
      return {
        state: {
          ...state,
          gateFailureLines: [...state.gateFailureLines, ...markdownLines]
        },
        output: ""
      };
    }
    if (event.type === "run-end") {
      return { state: { ...state, totals: event.totals }, output: "" };
    }
    return { state, output: "" };
  },
  end: (state) => {
    const title = "# Tests";
    const bullets = renderBullets(state.paths, 0);
    const body = bullets.length > 0 ? `${title}

${bullets}` : title;
    const errors = renderErrors(state.failures);
    const coverage = renderCoverage(state.coverageLines, state.gateFailureLines);
    const totals = renderTotals(state.totals ?? zeroTotals3);
    return `${body}${errors}${coverage}

${totals}
`;
  }
});

// src/lib/tally.ts
var initialTally = {
  total: 0,
  pass: 0,
  fail: 0,
  skip: 0,
  todo: 0
};
var foldTally = (tally, event) => {
  if (event.type === "test") {
    return {
      ...tally,
      total: tally.total + 1,
      [event.status]: tally[event.status] + 1
    };
  }
  if (event.type === "unhandled-error") {
    return { ...tally, total: tally.total + 1, fail: tally.fail + 1 };
  }
  return tally;
};

// src/reporters/nyan-reporter.ts
var NUMBER_OF_LINES = 4;
var NYAN_CAT_WIDTH = 11;
var SCOREBOARD_WIDTH = 5;
var generateColors = () => {
  const pi3 = Math.floor(Math.PI / 3);
  return Array.from({ length: 6 * 7 }, (_, i) => {
    const n = i * (1 / 6);
    const r = Math.floor(3 * Math.sin(n) + 3);
    const g = Math.floor(3 * Math.sin(n + 2 * pi3) + 3);
    const b = Math.floor(3 * Math.sin(n + 4 * pi3) + 3);
    return 36 * r + 6 * g + b + 16;
  });
};
var RAINBOW_COLORS = generateColors();
var faceFor = (tally) => {
  if (tally.fail > 0)
    return "( x .x)";
  if (tally.skip > 0)
    return "( o .o)";
  if (tally.pass > 0)
    return "( ^ .^)";
  return "( - .-)";
};
var nyanReporter = (deps) => {
  const styles = createConsoleStyles(deps.color);
  const width = Math.floor(deps.columns * 0.75);
  const trajectoryWidthMax = Math.max(width - NYAN_CAT_WIDTH, 1);
  const appendRainbow = (trajectories, colorIndex, tick) => {
    const color = RAINBOW_COLORS[colorIndex % RAINBOW_COLORS.length] ?? 0;
    const segment = styles.ansi256(color, tick ? "_" : "-");
    return {
      trajectories: trajectories.map((line) => line.length >= trajectoryWidthMax ? [...line.slice(1), segment] : [...line, segment]),
      colorIndex: colorIndex + 1
    };
  };
  const renderScoreboard = (tally) => ` ${styles.cyan(String(tally.total))}
 ${styles.green(String(tally.pass))}
 ${styles.red(String(tally.fail))}
 ${styles.yellow(String(tally.skip))}
`;
  const renderRainbow = (trajectories) => trajectories.map((line) => `\x1B[${SCOREBOARD_WIDTH}C${line.join("")}
`).join("");
  const renderCat = (tally, trajectories, tick) => {
    const startWidth = SCOREBOARD_WIDTH + (trajectories[0]?.length ?? 0);
    const color = `\x1B[${startWidth}C`;
    const headPadding = tick ? "  " : "   ";
    const neckPadding = tick ? "_" : "__";
    const tail = tick ? "~" : "^";
    const feetPadding = tick ? " " : "  ";
    return `${color}_,------,
` + `${color}_|${headPadding}/\\_/\\ 
` + `${color}${tail}|${neckPadding}${faceFor(tally)} 
` + `${color}${feetPadding}  ""  "" 
`;
  };
  const draw = (state) => {
    const appended = appendRainbow(state.trajectories, state.colorIndex, state.tick);
    const frame = cursorUp(NUMBER_OF_LINES) + renderScoreboard(state.tally) + cursorUp(NUMBER_OF_LINES) + renderRainbow(appended.trajectories) + cursorUp(NUMBER_OF_LINES) + renderCat(state.tally, appended.trajectories, state.tick);
    return {
      state: {
        ...state,
        trajectories: appended.trajectories,
        colorIndex: appended.colorIndex,
        tick: !state.tick
      },
      output: frame
    };
  };
  const begin = (state) => state.initialized ? { state, output: "" } : {
    state: { ...state, initialized: true },
    output: `
${hideCursor()}${renderScoreboard(state.tally)}`
  };
  const renderFailure2 = (file, name, diagnostics) => [`FAIL ${file ?? "(unknown file)"} > ${name}`, ...diagnostics].join(`
`);
  const summaryLine = (totals) => `${totals.tests} tests, ${totals.pass} passed, ${totals.fail} failed, ${totals.skip} skipped in ${formatDuration(totals.durationMs)}
`;
  return {
    initial: {
      initialized: false,
      tick: false,
      colorIndex: 0,
      trajectories: Array.from({ length: NUMBER_OF_LINES }, () => []),
      tally: initialTally,
      failures: [],
      totals: undefined,
      coverageLines: [],
      gateFailureLines: []
    },
    next: (state, event) => {
      if (event.type === "run-start")
        return begin(state);
      if (event.type === "test" || event.type === "unhandled-error") {
        const begun = begin(state);
        const tally = foldTally(begun.state.tally, event);
        const failures = event.type === "test" && event.status === "fail" ? [
          ...begun.state.failures,
          renderFailure2(event.file, event.name, event.diagnostics)
        ] : event.type === "unhandled-error" ? [
          ...begun.state.failures,
          renderFailure2(event.file, event.message, event.diagnostics)
        ] : begun.state.failures;
        const drawn = draw({ ...begun.state, tally, failures });
        return { state: drawn.state, output: begun.output + drawn.output };
      }
      if (event.type === "passthrough" && event.kind === "coverage") {
        return {
          state: {
            ...state,
            coverageLines: [...state.coverageLines, ...event.lines]
          },
          output: ""
        };
      }
      if (event.type === "coverage-gate-failed") {
        return {
          state: {
            ...state,
            gateFailureLines: [
              ...state.gateFailureLines,
              ...formatCoverageGateFailure(event)
            ]
          },
          output: ""
        };
      }
      if (event.type === "run-end") {
        const failureDump = state.failures.length > 0 ? `
${state.failures.join(`
`)}
` : "";
        const coverageDump = state.coverageLines.length > 0 ? `
${state.coverageLines.join(`
`)}
` : "";
        const gateFailureDump = state.gateFailureLines.length > 0 ? `${state.gateFailureLines.join(`
`)}
` : "";
        return {
          state: { ...state, totals: event.totals },
          output: `${showCursor()}${failureDump}
${summaryLine(event.totals)}${coverageDump}${gateFailureDump}`
        };
      }
      return { state, output: "" };
    },
    end: () => ""
  };
};

// src/reporters/tap-reporter.ts
var escapeDescription = (name) => name.replace(/\\/g, "\\\\").replace(/#/g, "\\#").replace(/\r?\n/g, " ");
var escapeYamlString = (value) => value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
var firstErrorMessage = (diagnostics, fallback) => {
  const errorLine = diagnostics.find((line) => line.startsWith("error:"));
  return errorLine ? errorLine.slice("error:".length).trim() : fallback;
};
var indentDetails = (diagnostics) => diagnostics.map((line) => `      ${line}`).join(`
`);
var failureBlock = (message, durationMs, diagnostics) => {
  const lines = [
    "  ---",
    `  message: "${escapeYamlString(message)}"`,
    "  severity: fail",
    `  duration_ms: ${durationMs ?? 0}`
  ];
  const data = diagnostics.length > 0 ? ["  data:", "    details: |", indentDetails(diagnostics)] : [];
  return [...lines, ...data, "  ..."].join(`
`);
};
var commentLines = (lines) => lines.map((line) => `# ${line}`).join(`
`);
var testLine = (event, n) => {
  const description = escapeDescription(event.name);
  if (event.status === "skip")
    return `ok ${n} - ${description} # SKIP`;
  if (event.status === "todo")
    return `ok ${n} - ${description} # TODO`;
  if (event.status === "fail") {
    const message = firstErrorMessage(event.diagnostics, event.name);
    return [
      `not ok ${n} - ${description}`,
      failureBlock(message, event.durationMs, event.diagnostics)
    ].join(`
`);
  }
  const log = event.diagnostics.length > 0 ? `
${commentLines(event.diagnostics)}` : "";
  return `ok ${n} - ${description}${log}`;
};
var unhandledErrorLine = (event, n) => {
  const name = escapeDescription(event.file ?? "unhandled error");
  return [
    `not ok ${n} - ${name}`,
    failureBlock(event.message, undefined, event.diagnostics)
  ].join(`
`);
};
var noSummaryFooter = (versionEmitted) => [
  ...versionEmitted ? [] : ["TAP version 14"],
  "1..0 # no bun test summary found on stdin"
].join(`
`);
var summaryFooter = (event, lineCount) => [
  `1..${lineCount}`,
  `# tests ${event.totals.tests}`,
  `# pass ${event.totals.pass}`,
  `# fail ${event.totals.fail}`,
  `# skip ${event.totals.skip}`,
  `# todo ${event.totals.todo}`,
  `# duration_ms ${event.totals.durationMs ?? 0}`
].join(`
`);
var tapReporter = {
  initial: { lineCount: 0, versionEmitted: false },
  next: (state, event) => {
    if (event.type === "run-start") {
      return {
        state: { ...state, versionEmitted: true },
        output: `TAP version 14
`
      };
    }
    if (event.type === "file-start") {
      return { state, output: `# ${event.path}
` };
    }
    if (event.type === "test") {
      const n = state.lineCount + 1;
      return {
        state: { ...state, lineCount: n },
        output: `${testLine(event, n)}
`
      };
    }
    if (event.type === "unhandled-error") {
      const n = state.lineCount + 1;
      return {
        state: { ...state, lineCount: n },
        output: `${unhandledErrorLine(event, n)}
`
      };
    }
    if (event.type === "passthrough") {
      return event.lines.length > 0 ? { state, output: `${commentLines(event.lines)}
` } : { state, output: "" };
    }
    if (event.type === "coverage-gate-failed") {
      return {
        state,
        output: `${commentLines(formatCoverageGateFailure(event))}
`
      };
    }
    const output = event.summarySeen ? summaryFooter(event, state.lineCount) : noSummaryFooter(state.versionEmitted);
    return { state, output: `${output}
` };
  },
  end: () => ""
};

// src/use-cases/bind-reporter.ts
var bindReporter = (reporter) => {
  let state = reporter.initial;
  return {
    next: (event) => {
      const step = reporter.next(state, event);
      state = step.state;
      return step.output;
    },
    end: () => reporter.end(state)
  };
};

// src/use-cases/select-reporter.ts
var selectReporter = (deps) => (options) => {
  if (options.reporter === "nyan")
    return bindReporter(nyanReporter(deps));
  if (options.reporter === "markdown")
    return bindReporter(markdownReporter(deps));
  if (options.reporter === "block")
    return bindReporter(blockReporter(deps));
  if (options.reporter === "agent")
    return bindReporter(agentReporter(deps));
  return bindReporter(tapReporter);
};

// src/cli.ts
var VERSION = "0.1.0";
var HELP = `buntap — pipe bun test output through a TAP14, nyan, markdown, block, or agent reporter

Usage:
  bun test 2>&1 | buntap [options]

Options:
  --nyan        nyan cat reporter
  --markdown    markdown reporter
  --block       inverse-video block reporter
  --agent       minimal output, verbose only on failure
  --coverage-threshold=<n>  fail with exit 3 when a file is below <n> (0-1 or 0-100);
                            defaults to [test].coverageThreshold in ./bunfig.toml
  --color       force colour on
  --no-color    force colour off
  --help        print this help and exit
  --version     print the version and exit

bun writes test results to stderr, not stdout — pipe with 2>&1.
Only bun's default console reporter is parsed; --reporter=junit, --dots,
and --only-failures output are not supported.
`;
var resolveColor = (colorMode, deps) => {
  if (colorMode === "on")
    return true;
  if (colorMode === "off")
    return false;
  return deps.isTty && deps.env.NO_COLOR === undefined;
};
var resolveThreshold = (deps, flagThresholdPct) => {
  if (flagThresholdPct !== undefined) {
    return { thresholdPct: flagThresholdPct, warning: undefined };
  }
  const toml = deps.readTextFile(`${deps.cwd}/bunfig.toml`);
  if (toml === undefined)
    return { thresholdPct: undefined, warning: undefined };
  const parsed = parseBunfigThreshold(toml);
  return parsed.status === "error" ? { thresholdPct: undefined, warning: `buntap: ${parsed.error}
` } : { thresholdPct: parsed.data, warning: undefined };
};
var main = (deps) => async (argv) => {
  const options = parseCliOptions(argv);
  if (options.status === "error") {
    deps.writeError(`buntap: ${options.error}

${HELP}`);
    return 2;
  }
  if (options.data.mode === "help") {
    deps.write(HELP);
    return 0;
  }
  if (options.data.mode === "version") {
    deps.write(`${VERSION}
`);
    return 0;
  }
  const reporter = selectReporter({
    columns: deps.columns,
    isTty: deps.isTty,
    color: resolveColor(options.data.colorMode, deps)
  })(options.data);
  const threshold = resolveThreshold(deps, options.data.coverageThresholdPct);
  if (threshold.warning !== undefined)
    deps.writeError(threshold.warning);
  const gate = evaluateCoverageGate(threshold.thresholdPct);
  const peeked = await peekFirstNonEmptyLine(deps.input);
  const mode = peeked.firstLine === undefined ? "text" : detectInputMode(peeked.firstLine);
  if (mode === "protocol") {
    let protocolState = initialProtocolExitState;
    for await (const line of peeked.rest) {
      const decoded = decodeProtocolLine(line);
      if (decoded.status === "error")
        continue;
      const event = decoded.data;
      if (event.type === "runner-start")
        continue;
      if (event.type === "runner-exit") {
        protocolState = nextProtocolExitState(protocolState, event);
        continue;
      }
      for (const gated of gate(event)) {
        deps.write(reporter.next(gated));
        protocolState = nextProtocolExitState(protocolState, gated);
      }
    }
    deps.write(reporter.end());
    const verdict = resolveProtocolVerdict(protocolState);
    deps.writeError(renderVerdictLine(verdict));
    return verdict.code;
  }
  let exitState = initialExitState;
  for await (const event of parseRun(peeked.rest)) {
    for (const gated of gate(event)) {
      deps.write(reporter.next(gated));
      exitState = nextExitState(exitState, gated);
    }
  }
  deps.write(reporter.end());
  const code = resolveExitCode(exitState);
  if (code === 2) {
    deps.writeError("buntap: no bun test summary found on stdin — did you mean `bun test 2>&1 | buntap`?\n");
  }
  return code;
};

// src/parse/read-lines.ts
var consume3 = async function* (carry, iterator) {
  const next = await iterator.next();
  if (next.done === true) {
    if (carry.length > 0)
      yield carry;
    return;
  }
  const text = carry + (typeof next.value === "string" ? next.value : next.value.toString("utf8"));
  const lines = text.split(/\r\n|\n/);
  const nextCarry = lines.at(-1) ?? "";
  yield* lines.slice(0, -1);
  yield* consume3(nextCarry, iterator);
};
var readLines = (input) => consume3("", input[Symbol.asyncIterator]());

// src/bin.ts
var readTextFile = (path) => {
  try {
    return readFileSync(path, "utf8");
  } catch (_err) {
    return;
  }
};
process.stdout.on("error", (err) => {
  if (err.code === "EPIPE")
    process.exit(0);
});
process.exitCode = await main({
  input: readLines(process.stdin),
  write: (chunk) => void process.stdout.write(chunk),
  writeError: (chunk) => void process.stderr.write(chunk),
  columns: process.stdout.columns ?? 75,
  isTty: Boolean(process.stdout.isTTY),
  env: process.env,
  cwd: process.cwd(),
  readTextFile
})(process.argv.slice(2));
