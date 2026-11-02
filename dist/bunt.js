#!/usr/bin/env node

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

// src/parse/read-lines.ts
var consume2 = async function* (carry, iterator) {
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
  yield* consume2(nextCarry, iterator);
};
var readLines = (input) => consume2("", input[Symbol.asyncIterator]());

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

// src/runner/spawn-bun-test.ts
import { spawn } from "node:child_process";
var spawnBunTest = (argv) => {
  const child = spawn("bun", ["test", ...argv], {
    stdio: ["inherit", "pipe", "pipe"]
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
process.exitCode = await runBunt({
  spawn: spawnBunTest,
  write: (chunk) => void process.stdout.write(chunk),
  onSignal
})(process.argv.slice(2));
