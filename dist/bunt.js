#!/usr/bin/env node

// src/bunt.ts
import { existsSync } from "node:fs";
import { availableParallelism } from "node:os";

// src/parse/classify-line.ts
var BANNER = /^bun test v(\S+)(?:\s+\(([0-9a-fA-F]+)\))?$/;
var FILE_HEADER = /^(\S+[._](?:test|spec)\.(?:ts|tsx|js|jsx|mts|cts|mjs|cjs)):$/;
var RESULT = /^\((pass|fail|skip|todo)\)\s+(.*?)(?:\s+\[(\d+(?:\.\d+)?)(ms|s)\])?$/;
var DASH_RULE = /^-+$/;
var COVERAGE_RULE = /^-{2,}\|/;
var SUMMARY_STATUS_COUNT = /^ (\d+) (pass|fail|skip|todo|error)$/;
var SUMMARY_EXPECT_COUNT = /^ (\d+) expect\(\) calls$/;
var SUMMARY_RAN = /^Ran (\d+) tests? across (\d+) files?\.(?:\s+\[(\d+(?:\.\d+)?)(ms|s)\])?$/;
var ROLLUP_HEADER = /^(\d+) tests? (skipped|todo|failed):$/;
var ROLLUP_STATUS = {
  skipped: "skip",
  todo: "todo",
  failed: "fail"
};
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
  const rollup = ROLLUP_HEADER.exec(line);
  if (rollup) {
    const [, count, word] = rollup;
    return {
      kind: "rollup-header",
      status: ROLLUP_STATUS[word ?? ""] ?? "skip",
      count: Number(count)
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
  totals: { pass: 0, fail: 0, skip: 0, todo: 0, errors: 0, expectCalls: 0 },
  rollup: false
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
var stepClassified = (state, classified, line) => {
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
    case "rollup-header": {
      const flushed = flushDiagnostics(state);
      return {
        state: { ...flushed.state, rollup: true },
        events: flushed.events
      };
    }
  }
};
var stepLine = (state, rawLine) => {
  const line = stripAnsi(rawLine);
  if (state.coverage.active)
    return stepCoverage(state, line);
  if (state.unhandledError.active)
    return stepUnhandledError(state, line);
  const classified = classifyLine(line);
  if (state.rollup && classified.kind === "result")
    return { state, events: [] };
  const stepped = stepClassified(state, classified, line);
  return !stepped.state.rollup || classified.kind === "blank" || classified.kind === "rollup-header" ? stepped : { state: { ...stepped.state, rollup: false }, events: stepped.events };
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
async function* parseRun(lines) {
  const iterator = lines[Symbol.asyncIterator]();
  let state = initialParseState;
  while (true) {
    const next = await iterator.next();
    if (next.done === true) {
      yield* finalizeParse(state);
      return;
    }
    const step = stepLine(state, next.value);
    yield* step.events;
    if (step.events.some((event) => event.type === "run-end"))
      return;
    state = step.state;
  }
}

// src/parse/read-lines.ts
async function* readLines(input) {
  const iterator = input[Symbol.asyncIterator]();
  let carry = "";
  while (true) {
    const next = await iterator.next();
    if (next.done === true) {
      if (carry.length > 0)
        yield carry;
      return;
    }
    const text = carry + (typeof next.value === "string" ? next.value : next.value.toString("utf8"));
    const lines = text.split(/\r\n|\n/);
    yield* lines.slice(0, -1);
    carry = lines.at(-1) ?? "";
  }
}

// src/protocol/protocol-event.ts
var PROTOCOL_VERSION = 1;

// src/protocol/encode-protocol-line.ts
var encodeRunnerStart = (argv) => `${JSON.stringify({ v: PROTOCOL_VERSION, type: "runner-start", argv })}
`;
var encodeRunnerExit = (code, signal) => `${JSON.stringify({ v: PROTOCOL_VERSION, type: "runner-exit", code, signal })}
`;
var encodeRunEvent = (event) => `${JSON.stringify({ v: PROTOCOL_VERSION, ...event })}
`;

// src/runner/merge-async-iterables.ts
async function* mergeAsyncIterables(iterables) {
  const iterators = iterables.map((iterable) => iterable[Symbol.asyncIterator]());
  let pending = iterators.map((iterator, index) => ({
    index,
    promise: iterator.next()
  }));
  while (pending.length > 0) {
    const winner = await Promise.race(pending.map((entry) => entry.promise.then((result) => ({ index: entry.index, result }))));
    if (winner.result.done === true) {
      pending = pending.filter((entry) => entry.index !== winner.index);
      continue;
    }
    yield winner.result.value;
    const iterator = iterators[winner.index];
    pending = pending.map((entry) => entry.index === winner.index && iterator !== undefined ? { index: entry.index, promise: iterator.next() } : entry);
  }
}

// src/runner/bunt-runner.ts
var runBunt = (deps) => async (argv) => {
  deps.write(encodeRunnerStart(argv));
  const child = deps.spawn(argv);
  const unregister = deps.onSignal((signal) => child.kill(signal));
  const merged = mergeAsyncIterables([child.stdout, child.stderr]);
  for await (const event of parseRun(readLines(merged))) {
    deps.write(encodeRunEvent(event));
  }
  const result = await child.exited;
  unregister();
  deps.write(encodeRunnerExit(result.code, result.signal));
  return result.code ?? 1;
};

// src/lib/format-paired-coverage-table.ts
var formatPairedCoverageTable = (rows) => {
  if (rows.length === 0)
    return [];
  const width = Math.max("All files".length, ...rows.map((row) => row.file.length + 1));
  const rule = `${"-".repeat(width + 1)}|---------|---------|-------------------`;
  const pct = (value) => value.toFixed(2).padStart(7);
  const means = rows.reduce((sum, row) => ({
    functionsPct: sum.functionsPct + row.functionsPct,
    linesPct: sum.linesPct + row.linesPct
  }), { functionsPct: 0, linesPct: 0 });
  return [
    rule,
    `${"File".padEnd(width)} | % Funcs | % Lines | Uncovered Line #s`,
    rule,
    `${"All files".padEnd(width)} | ${pct(means.functionsPct / rows.length)} | ${pct(means.linesPct / rows.length)} |`,
    ...rows.map((row) => `${` ${row.file}`.padEnd(width)} | ${pct(row.functionsPct)} | ${pct(row.linesPct)} | ${row.uncovered.join(",")}`),
    rule
  ];
};

// src/parse/parse-coverage-table.ts
var splitCells = (line) => line.split("|").map((cell) => cell.trim());
var findHeaderIndex = (rows) => rows.findIndex((cells) => cells[0] === "File");
var findAllFilesIndex = (rows, headerIndex) => rows.slice(headerIndex + 1).findIndex((cells) => cells[0] === "All files");
var toUncovered = (cell) => (cell ?? "").split(",").map((part) => part.trim()).filter((part) => part.length > 0);
var parseCoverageTable = (lines) => {
  const rows = lines.map(splitCells);
  const headerIndex = findHeaderIndex(rows);
  if (headerIndex === -1)
    return [];
  const header = rows[headerIndex];
  const funcsIndex = header.indexOf("% Funcs");
  const linesIndex = header.indexOf("% Lines");
  const uncoveredIndex = header.indexOf("Uncovered Line #s");
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
    const uncovered = uncoveredIndex === -1 ? [] : toUncovered(cells[uncoveredIndex]);
    return { file, functionsPct, linesPct, uncovered };
  };
  return rows.slice(headerIndex + 1).map(toRow).filter((row) => row !== undefined);
};
var parseCoverageTotals = (lines) => {
  const rows = lines.map(splitCells);
  const headerIndex = findHeaderIndex(rows);
  if (headerIndex === -1)
    return;
  const header = rows[headerIndex];
  const funcsIndex = header.indexOf("% Funcs");
  const linesIndex = header.indexOf("% Lines");
  if (funcsIndex === -1 || linesIndex === -1)
    return;
  const allFilesOffset = findAllFilesIndex(rows, headerIndex);
  if (allFilesOffset === -1)
    return;
  const allFilesRow = rows[headerIndex + 1 + allFilesOffset];
  const functionsPct = Number(allFilesRow[funcsIndex]);
  const linesPct = Number(allFilesRow[linesIndex]);
  if (!(Number.isFinite(functionsPct) && Number.isFinite(linesPct)))
    return;
  return { functionsPct, linesPct, files: parseCoverageTable(lines).length };
};

// src/parse/parse-discovered-files.ts
var parseDiscoveredFiles = (lines) => {
  const clean = lines.map(stripAnsi);
  const files = [
    ...new Set(clean.flatMap((line) => {
      const classified = classifyLine(line);
      return classified.kind === "file-header" ? [classified.path] : [];
    }))
  ];
  const searched = clean.map((line) => /Searched (\d+) files?\b/.exec(line)).find((match) => match !== null);
  if (searched && Number(searched[1]) !== files.length)
    return {
      status: "error",
      error: `could not list the test files bun matched (bun searched ${searched[1]}, bunt recognised ${files.length})`
    };
  return { status: "ok", data: files };
};

// src/runner/map-with-concurrency.ts
var mapWithConcurrency = (limit) => (items, fn) => {
  let lanes = Array.from({ length: Math.min(items.length, Math.max(1, limit)) }, () => Promise.resolve());
  return items.map((item, index) => {
    const lane = index % lanes.length;
    const result = (lanes[lane] ?? Promise.resolve()).then(() => fn(item));
    lanes = lanes.with(lane, result.then(() => {
      return;
    }, () => {
      return;
    }));
    return result;
  });
};

// src/runner/to-paired-source-path.ts
var toPairedSourcePath = (testPath) => /\.test\.[^./]+$/.test(testPath) ? testPath.replace(/\.test(\.[^./]+)$/, "$1") : undefined;

// src/runner/paired-runner.ts
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
var sumTotals = (totals, next) => ({
  pass: totals.pass + next.pass,
  fail: totals.fail + next.fail,
  skip: totals.skip + next.skip,
  todo: totals.todo + next.todo,
  errors: totals.errors + next.errors,
  expectCalls: totals.expectCalls + next.expectCalls,
  tests: totals.tests + next.tests,
  files: totals.files + next.files,
  durationMs: undefined
});
var runPaired = (deps) => async (args) => {
  const started = deps.now();
  deps.write(encodeRunnerStart(args.argv));
  let live = [];
  let receivedSignal;
  const discovery = deps.spawn([...args.flags, ...args.filters, "--test-name-pattern=(?!)"], { omitEnv: ["CLAUDECODE", "AGENT", "REPL_ID"] });
  live = [discovery];
  const unregister = deps.onSignal((signal) => {
    receivedSignal = signal;
    live.forEach((child) => {
      child.kill(signal);
    });
  });
  try {
    const discoveryLines = await Array.fromAsync(readLines(mergeAsyncIterables([discovery.stdout, discovery.stderr])));
    const discoveryResult = await discovery.exited;
    live = [];
    const discovered = parseDiscoveredFiles(discoveryLines);
    if (discovered.status === "error") {
      deps.writeError(`bunt: ${discovered.error}
`);
      deps.write(encodeRunnerExit(2, null));
      return 2;
    }
    if (discovered.data.length === 0) {
      deps.writeError(`bunt: no test files matched
${discoveryLines.join(`
`)}
`);
      const code = discoveryResult.signal === null ? discoveryResult.code || 1 : discoveryResult.code;
      deps.write(encodeRunnerExit(code, discoveryResult.signal));
      return code ?? 1;
    }
    const runFile = async (file) => {
      if (receivedSignal !== undefined)
        return;
      const child = deps.spawn([
        ...args.flags,
        "--coverage",
        "--",
        `./${file}`
      ]);
      live = [...live, child];
      const events = await Array.fromAsync(parseRun(readLines(mergeAsyncIterables([child.stdout, child.stderr]))));
      const result = await child.exited;
      live = live.filter((handle) => handle !== child);
      const summarySeen = events.some((event) => event.type === "run-end" && event.summarySeen);
      const source = toPairedSourcePath(file);
      const coverage = events.flatMap((event) => event.type === "passthrough" && event.kind === "coverage" ? event.lines : []);
      const row = source !== undefined && deps.fileExists(source) && summarySeen ? parseCoverageTable(coverage).find((candidate) => candidate.file === source) ?? {
        file: source,
        functionsPct: 0,
        linesPct: 0,
        uncovered: []
      } : undefined;
      return { events, result, row, summarySeen };
    };
    const pending = mapWithConcurrency(args.concurrency ?? deps.defaultConcurrency)(discovered.data, runFile).map((promise) => Promise.allSettled([promise]));
    let completed = [];
    let bannerSeen = false;
    for (const promise of pending) {
      const outcomes = await promise;
      completed = [...completed, ...outcomes];
      const outcome = outcomes[0];
      if (outcome?.status !== "fulfilled" || outcome.value === undefined)
        continue;
      const run = outcome.value;
      for (const event of run.events) {
        if (event.type === "run-end" || event.type === "passthrough" && event.kind === "coverage")
          continue;
        if (event.type === "run-start") {
          if (bannerSeen)
            continue;
          bannerSeen = true;
        }
        deps.write(encodeRunEvent(event));
      }
    }
    const failures = completed.flatMap((outcome) => outcome.status === "rejected" ? [outcome.reason] : []);
    if (failures.length > 0)
      throw new AggregateError(failures, `bunt: ${failures.length} test-file processes could not be collected`);
    const runs = completed.flatMap((outcome) => outcome.status === "fulfilled" && outcome.value !== undefined ? [outcome.value] : []);
    const rows = runs.flatMap((run) => run.row === undefined ? [] : [run.row]).toSorted((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
    if (rows.length > 0)
      deps.write(encodeRunEvent({
        type: "passthrough",
        kind: "coverage",
        lines: formatPairedCoverageTable(rows)
      }));
    const totals = {
      ...runs.flatMap((run) => run.events.flatMap((event) => event.type === "run-end" ? [event.totals] : [])).reduce(sumTotals, zeroTotals2),
      durationMs: deps.now() - started
    };
    deps.write(encodeRunEvent({
      type: "run-end",
      totals,
      summarySeen: runs.every((run) => run.summarySeen)
    }));
    const signalled = runs.find((run) => run.result.signal !== null);
    const incomplete = runs.find((run) => !run.summarySeen);
    const signal = receivedSignal ?? signalled?.result.signal ?? null;
    const code = signal !== null ? null : incomplete === undefined ? 0 : incomplete.result.code || 1;
    deps.write(encodeRunnerExit(code, signal));
    return code === null ? 1 : code !== 0 ? code : totals.fail + totals.errors > 0 ? 1 : 0;
  } finally {
    unregister();
  }
};

// src/runner/parse-bunt-args.ts
var usageError = (arg) => {
  if (arg.startsWith("--paired-concurrency=")) {
    const value = arg.slice("--paired-concurrency=".length);
    if (!/^[1-9][0-9]*$/.test(value))
      return `--paired-concurrency must be a positive integer, got "${value}"`;
  }
  if (arg === "--")
    return "--paired does not support a bare --";
  if (arg === "-t" || arg.startsWith("--test-name-pattern"))
    return "--paired measures whole test files, so a test name pattern is not supported";
  return;
};
var parseBuntArgs = (argv) => {
  if (!argv.includes("--paired"))
    return { status: "ok", data: { mode: "passthrough", argv } };
  const error = argv.map(usageError).find((message) => message !== undefined);
  if (error !== undefined)
    return { status: "error", error };
  const remaining = argv.filter((arg) => arg !== "--paired" && !arg.startsWith("--paired-concurrency="));
  const concurrencyArg = argv.findLast((arg) => arg.startsWith("--paired-concurrency="));
  return {
    status: "ok",
    data: {
      mode: "paired",
      argv,
      concurrency: concurrencyArg === undefined ? undefined : Number(concurrencyArg.slice("--paired-concurrency=".length)),
      filters: remaining.filter((arg) => !arg.startsWith("-")),
      flags: remaining.filter((arg) => arg.startsWith("-") && arg !== "--coverage" && !arg.startsWith("--coverage-reporter") && !arg.startsWith("--coverage-dir"))
    }
  };
};

// src/runner/bunt-main.ts
var buntMain = (deps) => (argv) => {
  const parsed = parseBuntArgs(argv);
  if (parsed.status === "error") {
    deps.writeError(`bunt: ${parsed.error}
`);
    return Promise.resolve(2);
  }
  return parsed.data.mode === "paired" ? runPaired(deps)(parsed.data) : runBunt(deps)(parsed.data.argv);
};

// src/runner/spawn-bun-test.ts
import { spawn } from "node:child_process";
var spawnBunTest = (argv, options) => {
  const child = spawn("bun", ["test", ...argv], {
    stdio: ["inherit", "pipe", "pipe"],
    ...options === undefined ? {} : {
      env: Object.fromEntries(Object.entries(process.env).filter(([key]) => !options.omitEnv.includes(key)))
    }
  });
  const exited = new Promise((resolve) => {
    child.on("exit", (code, signal) => resolve({ code, signal }));
  });
  return {
    stdout: child.stdout,
    stderr: child.stderr,
    exited,
    kill: (signal) => {
      child.kill(signal);
    }
  };
};

// src/bunt.ts
process.stdout.on("error", (err) => {
  if (err.code === "EPIPE")
    process.exit(0);
});
var onSignal = (handler) => {
  const forward = (signal) => handler(signal);
  process.on("SIGINT", forward);
  process.on("SIGTERM", forward);
  return () => {
    process.off("SIGINT", forward);
    process.off("SIGTERM", forward);
  };
};
process.exitCode = await buntMain({
  spawn: spawnBunTest,
  write: (chunk) => void process.stdout.write(chunk),
  writeError: (chunk) => void process.stderr.write(chunk),
  fileExists: existsSync,
  now: Date.now,
  defaultConcurrency: availableParallelism(),
  onSignal
})(process.argv.slice(2));
