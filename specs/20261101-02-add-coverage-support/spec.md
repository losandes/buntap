# Add Support for `bun test --coverage`

From Identify:

# Identify: coverage visibility and coverage-gate signalling in buntap

## Request

`bun test --coverage 2>&1 | buntap --nyan` swallows the coverage report instead
of passing it through, and when `bun test --coverage` exits 1 because coverage
is below the `bunfig.toml` minimums, that failure needs to reach an agent
consuming buntap's output, not just a human watching a TTY.

## What was verified (this repo is buntap itself)

- `src/parse/parse-run.ts` already extracts bun's coverage table into a
  `{ type: 'passthrough', kind: 'coverage', lines }` event
  (`src/parse/parse-run.ts:56-67`, `:178-184`).
- Of the five reporters, only `tap-reporter.ts` renders `passthrough` events
  (`src/reporters/tap-reporter.ts:121`). `nyan-reporter.ts`,
  `markdown-reporter.ts`, `block-reporter.ts`, and `agent-reporter.ts` have no
  branch for `event.type === 'passthrough'` and fall through to emitting
  nothing. This is intentional, current behaviour, not an oversight: a test at
  `src/reporters/nyan-reporter.test.ts:376-401` asserts a passthrough event
  renders `''`.
- Confirmed live: piping a run with 100% test pass but one file with sub-100%
  coverage through `node dist/bin.js --nyan` and `node dist/bin.js --agent`
  prints no coverage table; `node dist/bin.js` (TAP) does print it.
- Confirmed live: in that same run, `bun test --coverage` alone exits 1 (0
  fail, coverage gate tripped), but `bun test --coverage 2>&1 | node
  dist/bin.js --nyan` exits 0, and so do `--agent` and plain TAP mode.
  `src/use-cases/resolve-exit-code.ts:10-26` derives `sawFailure` only from
  `test`/`unhandled-error` events and `totals.fail`/`totals.errors`; it has no
  path that can become true from a coverage-only failure.
- Confirmed live: bun itself prints no text line distinguishing "coverage
  threshold not met" from "coverage threshold met" — the coverage table looks
  identical either way; the only signal bun gives is its own process exit
  code, which a pipe discards (this is the premise buntap's own README
  already states for test failures: "it derives its own exit code from the
  parsed results, because a pipe discards bun's" — `README.md:3`). Since bun
  emits no distinguishing text, buntap cannot currently detect a coverage-gate
  failure from parsed events at all, by any reporter.
- `bunfig.toml:10` sets `coverageThreshold = 0.95` for this repo, confirming
  the project genuinely uses the gate the request refers to.

This rules out one interpretation: the problem is not "the parser fails to
capture coverage lines." The lines are captured correctly today; only their
rendering is reporter-specific, and the coverage-gate failure is categorically
invisible to the parser, not just under-reported.

## Outcome wanted

1. Running `bun test --coverage 2>&1 | buntap <any-reporter-flag>` shows the
   coverage report to whoever is watching, regardless of which reporter flag
   was chosen.
2. When `bun test --coverage` fails its own coverage gate (process would exit
   1 on its own), that fact is visible in buntap's output and reflected in
   buntap's own exit code, so a script or agent consuming only buntap's
   stdout/exit code — not bun's original exit code — can tell "tests passed
   but coverage is too low" apart from "tests passed and coverage is fine."

## Success criteria

- For every reporter mode (`--nyan`, `--markdown`, `--block`, `--agent`, and
  default TAP), piping a `bun test --coverage` run through `buntap`
  reproduces bun's coverage table (or an equivalent rendering of the same
  per-file coverage data) in buntap's output, not just in TAP mode.
- A run where `bun test --coverage` would itself exit 1 solely due to the
  coverage gate (all tests passing, coverage below the configured minimum)
  causes the piped `buntap` command to also exit nonzero.
- That same run's buntap output contains a distinguishable, parseable signal
  — distinct from a test failure — that an agent or script can use to tell
  "coverage gate failed" apart from "a test failed," without needing to also
  inspect bun's own exit code (which the pipe has already discarded).
- A run where coverage passes and all tests pass continues to exit 0 in every
  reporter mode, so the fix does not introduce false positives.
- Existing passthrough handling for non-coverage diagnostic/text output
  (`kind: 'output'`) is not broken by whatever change makes coverage visible.

## Out of scope

- Changing what bun itself prints for the coverage table, or asking bun to
  emit a distinguishing "threshold not met" text line — bun does not
  currently do this (verified above), and changing bun is outside this
  repository.
- Supporting `--reporter=junit`, `--dots`, or `--only-failures` bun output;
  the README already excludes these from buntap's parsing contract
  (`README.md:3`, HELP text in `src/cli.ts`).
- Deciding the exact visual format of the coverage table inside `--nyan`,
  `--block`, or `--markdown` output (plain passthrough vs. reporter-styled
  table) — that is a design choice for the next stage, not fixed here.
- Deciding the exact machine-readable shape of the "coverage gate failed"
  signal (e.g., a new `TRunEvent` kind, a specific exit code value, specific
  wording) — the success criteria require that such a signal exist and be
  distinguishable from a test failure, not what it looks like.

## Requirements (evidence-backed)

- Must not rely on bun's own process exit code, since it is already lost to
  the shell pipeline by the time buntap runs (`README.md:3`; confirmed live
  above that `PIPESTATUS` for the bun side is unavailable to buntap).
- Must not rely on bun printing a distinguishing text line for a coverage-gate
  failure, since it currently does not (confirmed live above).

## Constraints

- buntap only ever sees `bun test`'s console text on stdin; it has no access
  to `bunfig.toml`, to bun's own exit code, or to any other side channel
  about why bun would have exited nonzero.
- The fix must fit the existing architecture: a pure line-by-line parser
  (`src/parse/parse-run.ts`) producing `TRunEvent`s, consumed by independent
  per-reporter `next`/`end` functions, with exit code resolved separately in
  `src/use-cases/resolve-exit-code.ts`.

## Assumptions carried forward

- Assumed `bunfig.toml`'s `coverageThreshold = 0.95` and bun 1.3.14's
  behaviour (coverage table present either way, no distinguishing text, exit
  code 1 on failure) are representative of bun's coverage-gate behaviour in
  general, not a quirk of this one installed bun version. This was checked
  against bun 1.3.14 only (`bun --version` → `1.3.14`). If a materially
  different bun version is in play elsewhere, this would need re-checking.

## Unresolved (none blocking)

None found that change what should be built. How the coverage-gate signal is
represented (new event kind vs. reusing an existing one; which exit code
value) is left to the architecture stage per "out of scope" above, since
either choice satisfies the stated success criteria.

---

From Plan:

# Every reporter prints the coverage table, and a failed coverage gate exits 3

## Objective

`bun test --coverage 2>&1 | buntap <any flag>` prints bun's per-file coverage table in every reporter, not only TAP. When coverage is below the minimum configured in `bunfig.toml` (or given on the command line), buntap prints a `COVERAGE FAIL` block naming each file and its percentages, and exits `3` — a code no test failure (`1`) or usage error (`2`) can produce, so an agent reading only buntap's stdout and exit status knows to improve coverage rather than to fix a test. Runs whose coverage passes, and runs with no coverage table at all, behave exactly as they do today.

## 1. Requirements

### 1.1 Coverage visibility

- **1.1.1** Every reporter (`tap`, `nyan`, `markdown`, `block`, `agent`) MUST render the lines carried by a `{ type: 'passthrough', kind: 'coverage' }` event. The rendering per reporter is fixed in §2.5.
- **1.1.2** TAP's existing coverage rendering MUST NOT change: it already emits each line as a `# ` comment at the point the event arrives (`src/reporters/tap-reporter.ts:121`), and its bytes for a coverage run MUST stay identical.
- **1.1.3** Handling of `{ kind: 'output' }` passthrough events MUST NOT change in any reporter. `src/reporters/nyan-reporter.test.ts:376-401` asserts nyan renders `''` for a `kind: 'output'` event and MUST still pass unmodified.
- **1.1.4** The nyan reporter MUST buffer coverage lines in its state and emit them from its `run-end` output, never at the moment the coverage event arrives, because writing plain lines mid-run would land inside the cursor-addressed frame the reporter is redrawing.
- **1.1.5** A run whose input contains no coverage table MUST produce byte-identical output to today in every reporter.
- **1.1.6** Reporters MUST NOT re-format, re-align, or re-parse the coverage table for display. They print the lines bun produced, verbatim, apart from the per-reporter prefix or fence in §2.5.

### 1.2 Coverage gate

- **1.2.1** buntap MUST resolve a coverage threshold from, in precedence order: the `--coverage-threshold=<value>` flag; `coverageThreshold` under `[test]` in `<cwd>/bunfig.toml`; otherwise none. "None" means no gate and no behaviour change.
- **1.2.2** `--coverage-threshold=<value>` MUST accept `0`–`1` as a fraction and `1`–`100` as a percentage (`0.95` and `95` both mean 95%; `1` means 100%, matching bunfig). A value that is not a finite number, is negative, or exceeds `100` MUST be a usage error: message on stderr, exit `2`, consistent with the existing unknown-flag path in `src/use-cases/parse-cli-options.ts`.
- **1.2.3** A scalar `coverageThreshold` in `bunfig.toml` MUST apply to both the functions and the lines metric, as bun does.
- **1.2.4** An inline-table `coverageThreshold` MUST follow the semantics in §2.3, which are bun 1.3.14's observed semantics, including the 100% default for unspecified metrics.
- **1.2.5** TOML comments MUST be stripped before the value is read. This repository's own `bunfig.toml:10` is `coverageThreshold = 0.95 # { line = 0.7, function = 0.8, statement = 0.9 }`; a reader that does not strip comments reads the commented example.
- **1.2.6** A missing, unreadable, or unparseable `bunfig.toml`, and a `coverageThreshold` whose value cannot be interpreted, MUST resolve to no gate and MUST NOT fail the run. An unparseable value MUST write one line to stderr: `buntap: ignoring unreadable coverageThreshold in bunfig.toml\n`. A missing file MUST be silent.
- **1.2.7** The gate MUST be evaluated per file against the per-file rows of the table, and MUST ignore the `All files` row. bun gates per file: a run whose `All files` row read `96.00` while one file read `60.00` exited `1` (§5, evidence E3).
- **1.2.8** A file fails when the percentage bun printed is strictly less than the threshold percentage. Equality passes.
- **1.2.9** The `coverage-gate-failed` event (§2.1) MUST be emitted only when at least one file fails, immediately after the `passthrough`/`coverage` event it was derived from, and therefore before `run-end`.
- **1.2.10** `resolveExitCode` MUST return `3` when the gate failed and no test failed; `2` still wins when no summary was seen; `1` still wins over `3` when a test failed or an error was reported.
- **1.2.11** Input containing no coverage table MUST NOT produce a gate event or a nonzero exit, whatever threshold is configured.
- **1.2.12** Every reporter MUST render the gate failure using the exact text in §2.4, so the signal is identical and greppable in all five modes, and is distinguishable from the `FAIL <file> > <test>` line reporters already use for a failed test.
- **1.2.13** Nothing in this work may depend on bun's own exit code or on bun printing a threshold-failure line. bun 1.3.14 prints no such line (§5, evidence E1).

### 1.3 Conventions

- **1.3.1** Tests follow `~/.dotfiles/pi/skills/adr/typescript/test-conventions.md`: `bun:test`, no `describe`, no lifecycle hooks, `// given` / `// when` / `// then` line comments, and titles built as `['given …', 'when …', 'it should …'].join(', ')`. Copy the shape of `src/reporters/tap-reporter.test.ts`.
- **1.3.2** Source follows `~/.dotfiles/pi/skills/adr/typescript/functional-conventions.md` as the existing modules do: dependencies first and data last via currying, `Readonly`/`readonly` on exported types and parameters, no `let` outside the two accumulators already documented in `src/use-cases/bind-reporter.ts` and `src/cli.ts`, settlements rather than thrown errors for expected failures, no `as any`, no `!`.
- **1.3.3** Every new module MUST carry its own `*.test.ts` beside it, and the repository's own 95% per-file gate (`bunfig.toml:10`) MUST still pass after the change.
- **1.3.4** Tests MUST NOT print to the console.
- **1.3.5** `SPEC-INIT.md` stays untracked and uncommitted. Do not commit or push anything; the developer reviews the working tree.

## 2. Target state

This section is the specification. Where prose elsewhere disagrees with it, this section wins.

### 2.1 Types

```ts
// src/typedefs/coverage.ts (new)
export type TCoverageThresholdPct = Readonly<{
  functionsPct: number
  linesPct: number
}>

export type TCoverageRow = Readonly<{
  file: string
  functionsPct: number
  linesPct: number
}>
```

```ts
// src/typedefs/run-events.ts — one new member of the TRunEvent union
  | Readonly<{
      type: 'coverage-gate-failed'
      thresholdPct: TCoverageThresholdPct
      failing: readonly TCoverageRow[]
    }>
```

Thresholds and row percentages are percentages in the range `0`–`100`, never fractions, because that is the unit bun's table prints. `failing` is never empty: the event exists only when the gate failed.

### 2.2 Signatures

```ts
// src/parse/parse-coverage-table.ts
export const parseCoverageTable = (
  lines: readonly string[],
) => readonly TCoverageRow[]

// src/parse/parse-bunfig-threshold.ts
export const parseBunfigThreshold = (
  toml: string,
) => TSettlement<TCoverageThresholdPct | undefined, string>

// src/lib/to-threshold-pct.ts
export const toThresholdPct = (value: number) => number | undefined

// src/use-cases/evaluate-coverage-gate.ts
export const evaluateCoverageGate =
  (thresholdPct: TCoverageThresholdPct | undefined) =>
  (event: TRunEvent): readonly TRunEvent[]

// src/lib/format-coverage-gate.ts
export const formatCoverageGateFailure = (
  event: Extract<TRunEvent, { type: 'coverage-gate-failed' }>,
) => readonly string[]
```

- `parseCoverageTable` locates the header row (the row whose first cell is `File`) and takes the `% Funcs` and `% Lines` column indexes from it rather than assuming positions. It returns one row per data row whose first cell is neither `File` nor `All files` and whose two percentage cells parse as finite numbers; everything else — rule lines, blanks, malformed rows — is skipped, and an unrecognisable table yields `[]`.
- `parseBunfigThreshold` returns `{ status: 'ok', data: undefined }` when `[test]` has no `coverageThreshold`, and `{ status: 'error', error }` when it has one that cannot be interpreted. It strips `#` comments, tracks the current `[section]` header so only a `coverageThreshold` inside `[test]` is read, and handles the scalar and inline-table forms in §2.3. `[test.coverageThreshold]` as a section header is not supported (bun 1.3.14 ignores it too).
- `toThresholdPct` maps `0 <= v <= 1` to `v * 100`, `1 < v <= 100` to `v`, and anything else to `undefined`.
- `evaluateCoverageGate` returns `[event]` unchanged for every event except a `{ type: 'passthrough', kind: 'coverage' }` event with a threshold configured and at least one failing row, for which it returns `[event, { type: 'coverage-gate-failed', … }]`.

### 2.3 Threshold interpretation

| `coverageThreshold` in `bunfig.toml`   | functions threshold | lines threshold | gate                         |
| -------------------------------------- | ------------------- | --------------- | ---------------------------- |
| absent                                 | —                   | —               | none                         |
| `0.95`                                 | 95                  | 95              | active                       |
| `{ lines = 0.9, functions = 0.8 }`     | 80                  | 90              | active                       |
| `{ lines = 0.9 }`                      | 100                 | 90              | active                       |
| `{ functions = 0.8 }`                  | 80                  | 100             | active                       |
| `{ statements = 0.9 }`                 | 100                 | 100             | active                       |
| `{ line = 0.9 }` (singular keys only)  | —                   | —               | none                         |
| `{ }`                                  | —                   | —               | none                         |
| anything else (string, array, garbage) | —                   | —               | none + stderr note per 1.2.6 |

Recognised keys are `lines`, `functions`, and `statements`, all plural. `statements` activates the gate but is never evaluated: bun's text table has no statements column, so buntap cannot observe it. Every row of this table is a required test case (§4.2).

### 2.4 The failure signal

```text
COVERAGE FAIL 1 file below the minimum (functions 95.00%, lines 95.00%)
  src/add.ts functions 25.00%, lines 100.00%
```

- The first line uses `file` for one failing file and `files` for more than one.
- Percentages are always two decimal places.
- One indented line per failing file, in the order the rows appeared in bun's table.
- `formatCoverageGateFailure` returns these as an array of lines with no trailing newline, and is the only place this wording exists.
- No ANSI colour in any reporter, so the bytes are identical in all five modes and survive `grep`.

### 2.5 Where each reporter puts coverage output

| Reporter   | Coverage table                                                                                                                  | Failure signal                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `tap`      | unchanged: each line as `# <line>` when the event arrives                                                                       | each signal line as `# <line>` when the event arrives                           |
| `agent`    | blank line, then the lines verbatim, when the event arrives                                                                     | the signal lines verbatim, when the event arrives                               |
| `block`    | blank line, then the lines verbatim, when the event arrives                                                                     | the signal lines verbatim, when the event arrives                               |
| `nyan`     | buffered; emitted from `run-end` after the summary line, preceded by a blank line                                               | buffered; emitted from `run-end` immediately after the table                    |
| `markdown` | buffered; emitted from `end()` as a `## Coverage` section between `## Errors` and `## Totals`, inside a ```` ```text ```` fence | buffered; emitted inside the same section, below the fence, as the form in §2.6 |

### 2.6 Markdown coverage section

````markdown
## Coverage

```text
------------|---------|---------|-------------------
File        | % Funcs | % Lines | Uncovered Line #s
------------|---------|---------|-------------------
All files   |   25.00 |  100.00 |
 src/add.ts |   25.00 |  100.00 |
------------|---------|---------|-------------------
```

**COVERAGE FAIL** 1 file below the minimum (functions 95.00%, lines 95.00%)

- `src/add.ts` functions 25.00%, lines 100.00%
````

### 2.7 CLI surface

`TCliDeps` in `src/cli.ts` gains two required fields:

```ts
  cwd: string
  readTextFile: (path: string) => string | undefined
```

`src/bin.ts` supplies `process.cwd()` and a `readFileSync(path, 'utf8')` wrapper that returns `undefined` on any error. `src/cli.ts` reads `${cwd}/bunfig.toml` through `readTextFile` only when the flag did not supply a threshold. Reporters never receive the threshold; the gate is resolved in the driver, like the exit code.

New flag, added to `KNOWN_FLAGS` handling, the `HELP` text, and the README flag table:

```text
  --coverage-threshold=<n>  fail with exit 3 when a file is below <n> (0-1 or 0-100);
                            defaults to [test].coverageThreshold in ./bunfig.toml
```

Only the `=` form is accepted. A bare `--coverage-threshold` remains an unknown flag and exits `2`.

### 2.8 Exit codes

| Code | Meaning                                                               |
| ---- | --------------------------------------------------------------------- |
| `0`  | no failures, no errors, and coverage at or above the threshold        |
| `1`  | bun reported a test failure, an error, or an unhandled error          |
| `2`  | a usage error, or no bun test summary was found on stdin              |
| `3`  | every test passed but at least one file is below the coverage minimum |

### 2.9 New fixture

Appended to `src/parse/bun-output.fixture.ts`, a verbatim bun 1.3.14 capture (one failing file, one passing file). Both per-file rows end with one trailing space after the final `|`, exactly as bun emits them; preserve it.

```text
bun test v1.3.14 (0d9b296a)

src/add.test.ts:
(pass) adds [0.06ms]

src/full.test.ts:
(pass) a1 [0.03ms]
-------------|---------|---------|-------------------
File         | % Funcs | % Lines | Uncovered Line #s
-------------|---------|---------|-------------------
All files    |   62.50 |  100.00 |
 src/add.ts  |   25.00 |  100.00 |
 src/full.ts |  100.00 |  100.00 |
-------------|---------|---------|-------------------

 2 pass
 0 fail
 2 expect() calls
Ran 2 tests across 2 files. [78.00ms]
```

Export it as `lowCoverageFixture`.

## 3. Out of scope

- `src/parse/parse-run.ts` and `src/parse/classify-line.ts`. The coverage table is already captured correctly; nothing in the line parser changes.
- bun itself, and any attempt to make bun emit a threshold-failure line.
- `--reporter=junit`, `--dots`, `--only-failures`, and lcov files under `.coverage/`.
- A statements-coverage check. bun's text table has no statements column.
- Alternative config sources: `bun -c <path>`, a global `bunfig.toml`, `extends`, `[test.coverageThreshold]` as a section header, environment variables, and `package.json`.
- A flag to disable the gate. If a run should not be gated, it already is not: either no threshold is configured or `--coverage` was not passed.
- Changing the TAP reporter's output bytes, the nyan frame drawing, the markdown document structure outside the new `## Coverage` section, or any reporter's handling of tests, errors, and totals.
- Committing, pushing, or opening a pull request.

## 4. Work

Each step lists the requirements it satisfies and the command that settles it. Run commands from the repository root. Use `bun test <path>` while iterating and the full suite at the end.

### 4.1 Types, table parser, and fixture

Add `src/typedefs/coverage.ts` and the `coverage-gate-failed` member of `TRunEvent` (§2.1). Add `src/parse/parse-coverage-table.ts` (§2.2) with `src/parse/parse-coverage-table.test.ts`, and append `lowCoverageFixture` to `src/parse/bun-output.fixture.ts` (§2.9).

Satisfies 1.2.7, 1.2.8. Tests MUST cover: the §2.9 table (two rows, `All files` excluded); a table with an `Uncovered Line #s` value present (`4-7`); a header whose `% Funcs` and `% Lines` columns are transposed, proving indexes come from the header; and input that is not a table at all, returning `[]`.

Proves it: `bun test src/parse/parse-coverage-table.test.ts` exits 0.

### 4.2 Threshold inputs

Add `src/lib/to-threshold-pct.ts`, `src/parse/parse-bunfig-threshold.ts`, and their tests. Extend `src/use-cases/parse-cli-options.ts` with `--coverage-threshold=<value>`, carrying the resolved `TCoverageThresholdPct | undefined` on `TRunCliOptions`, and returning an error settlement for an uninterpretable value.

Satisfies 1.2.1, 1.2.2, 1.2.3, 1.2.4, 1.2.5, 1.2.6. Tests MUST cover every row of §2.3, plus: `coverageThreshold = 0.95 # { line = 0.7, function = 0.8, statement = 0.9 }` resolving to 95/95 (1.2.5); a `coverageThreshold` under a section other than `[test]` being ignored; `--coverage-threshold=95` and `--coverage-threshold=0.95` both resolving to 95/95; `--coverage-threshold=1` resolving to 100/100; and `--coverage-threshold=101`, `--coverage-threshold=-1`, `--coverage-threshold=abc` each returning a usage error.

Proves it: `bun test src/lib/to-threshold-pct.test.ts src/parse/parse-bunfig-threshold.test.ts src/use-cases/parse-cli-options.test.ts` exits 0.

### 4.3 Gate evaluation and exit code

Add `src/use-cases/evaluate-coverage-gate.ts` with its test. Extend `src/use-cases/resolve-exit-code.ts` to fold `coverage-gate-failed` into the exit state and return `3` per §2.8.

Satisfies 1.2.9, 1.2.10, 1.2.11. Tests MUST cover: a coverage event with a failing row producing two events in order; a coverage event with all rows at or above the threshold producing one event; equality at the threshold passing (1.2.8); no threshold producing one event; a non-coverage event passing through untouched; exit `3` for gate-failure-only; exit `1` when a test also failed; exit `2` when no summary was seen even though the gate failed; exit `0` for a clean run.

Proves it: `bun test src/use-cases/evaluate-coverage-gate.test.ts src/use-cases/resolve-exit-code.test.ts` exits 0.

### 4.4 Shared failure wording

Add `src/lib/format-coverage-gate.ts` with its test, producing exactly §2.4.

Satisfies 1.2.12. Tests MUST cover singular and plural file counts and two-decimal formatting of a whole number (`100` renders as `100.00`).

Proves it: `bun test src/lib/format-coverage-gate.test.ts` exits 0.

### 4.5 Reporters

Change all five reporters per §2.5 and §2.6, each with tests added to its existing `*.test.ts`.

Satisfies 1.1.1, 1.1.2, 1.1.3, 1.1.4, 1.1.5, 1.1.6, 1.2.12. Per reporter the tests MUST cover a `kind: 'coverage'` passthrough event and a `coverage-gate-failed` event; for nyan and markdown they MUST assert the buffered content appears in the `run-end`/`end()` output and not at the moment the event arrives. `src/reporters/nyan-reporter.test.ts:376-401` MUST remain unchanged and passing.

Proves it: `bun test src/reporters/` exits 0, and `git diff src/reporters/nyan-reporter.test.ts` shows no change to the test at lines 376-401.

### 4.6 Driver wiring

Extend `TCliDeps` and the `main` loop in `src/cli.ts` per §2.7: resolve the threshold from flag then `bunfig.toml`, apply `evaluateCoverageGate` to each parsed event before handing it to the reporter and the exit-code fold, and emit the 1.2.6 stderr note when the bunfig value is uninterpretable. Update `src/bin.ts`, the `HELP` text, `src/index.ts` exports (new types, `parseCoverageTable`, `parseBunfigThreshold`, `evaluateCoverageGate`, `formatCoverageGateFailure`), and the `makeDeps` helper in `src/cli.test.ts`.

Satisfies 1.2.1, 1.2.6, 1.2.13. `src/cli.test.ts` MUST gain one end-to-end test per reporter mode (default, `--nyan`, `--markdown`, `--block`, `--agent`) that feeds `lowCoverageFixture` with `--coverage-threshold=0.95`, and asserts the output contains `src/add.ts` coverage data, contains `COVERAGE FAIL`, and that `main` returned `3`. It MUST also gain: the same fixture with the threshold taken from a fake `readTextFile` returning `[test]\ncoverageThreshold = 0.95\n`, exiting `3`; the same fixture with no threshold configured, exiting `0` while still printing the table; and `coverageFixture` (100% coverage) with `--coverage-threshold=0.95`, exiting `0`.

Proves it: `bun test src/cli.test.ts` exits 0.

### 4.7 README

Update `README.md`: the flag table gains `--coverage-threshold=<n>`, the exit-code table becomes §2.8, and the sentence `--coverage and bun's other flags are not a problem: the coverage table passes through intact rather than being misread as test output.` is replaced by a short Coverage section stating that the table is reproduced in every reporter, that the threshold comes from `--coverage-threshold` or `[test].coverageThreshold` in `./bunfig.toml`, that only the `lines` and `functions` keys of the inline-table form are evaluated, and that a failing gate exits `3`.

Satisfies 1.2.1, 1.2.12. Proves it: `bash ~/.dotfiles/pi/skills/my-markdown-authoring/scripts/check-markdown.sh README.md` exits 0.

### 4.8 Full verification

Run, and report the exit status of each:

```bash
bun test --coverage
bun run typecheck
bun run check
bash ~/.dotfiles/pi/skills/ts/my-ts-test-conventions/scripts/check-test-conventions.sh
bun ~/.dotfiles/pi/skills/ts/my-ts-functional-conventions/scripts/check-immutable-params.ts
```

Satisfies 1.3.1, 1.3.2, 1.3.3, 1.3.4. All five MUST exit 0; `bun test --coverage` exiting 0 is also the proof that the repository's own 95% per-file gate still passes with the new modules in place. Then confirm `git status --short` shows only intended source changes and the pre-existing untracked `SPEC-INIT.md` (1.3.5).

## 5. Rationale

**Evidence behind the gate semantics.** All four observations are from bun 1.3.14 (`bun --version` → `1.3.14`) in a throwaway project outside this repository, since deleted.

- **E1** A run with one passing test and 25% function coverage against `coverageThreshold = 0.95` exited `1` and printed a coverage table textually indistinguishable from a passing one. bun gives no line to key off, so buntap has to compute the verdict itself.
- **E2** `All files` is the unweighted mean of the per-file percentages (`25.00` and `100.00` produced `62.50`), not a weighted total.
- **E3** Nine files at `100.00` and one at `60.00` produced `All files | 96.00` and still exited `1`. The gate is per file, which is why 1.2.7 ignores the `All files` row.
- **E4** With the inline-table form, `{ functions = 1.0 }` failed a run whose functions were `100.00` and lines `50.00`; `{ functions = 0.2 }` passed the same run; `{ lines = 0.4 }` failed a run whose lines were `100.00` and functions `25.00`. Unspecified metrics behave as 100%. Singular keys (`{ line = 1.0 }`) disabled the gate entirely, as did `{ }`. Hence §2.3.

**Why buntap computes the gate rather than reading bun's exit code.** The pipeline discards it before buntap starts, which is the same reason buntap already reconstructs pass/fail from the summary (`README.md:3`).

**Why exit `3` rather than `1`.** The success criterion is that an agent can tell "coverage is too low" from "a test failed" using the exit code alone. Reusing `1` forces it to parse stdout, which is exactly the fragility the signal exists to remove. `3` is free: `0`, `1`, and `2` are the only codes buntap currently returns.

**Why `1` still wins over `3`.** When a test fails the coverage numbers are unreliable anyway — untaken branches in a failing run — and the actionable instruction is to fix the test. One exit code can only carry one instruction.

**Why read `bunfig.toml` instead of requiring the flag.** The request was framed in terms of the `bunfig.toml` minimums, and duplicating the threshold on every invocation is the kind of configuration that drifts. The flag remains as the override and as the testable core: the gate logic never touches the filesystem, so it is exercised entirely with string inputs.

**Why a hand-rolled TOML reader rather than a dependency.** buntap is advertised as zero-dependency, and Node 22 has no TOML parser. The reader needs one key from one section. §2.3 and §1.2.6 confine the blast radius: anything it cannot interpret means no gate, never a wrong gate.

**Why `statements` is recognised but never evaluated.** bun accepts the key and it activates bun's gate, so ignoring it entirely would make buntap pass runs bun failed. Evaluating it is impossible from text output that has no statements column. Recognising it, and gating on the lines and functions defaults it brings with it, matches bun on everything buntap can see.

**Rejected: wrapping bun.** `buntap -- bun test --coverage` would own the child's exit code and need no gate replication, but it turns a stdin filter into a process runner, changes every documented invocation, and makes `2>&1` ambiguous. Rejected as a much larger change to the tool's contract for a problem the parsed table already answers.

**Rejected: `set -o pipefail`.** It would restore bun's exit code to the shell, but not to buntap, so the output would still carry no coverage signal — and it is a change to the caller's shell, not to this tool.

**Rejected: colouring the signal.** Identical bytes in all five reporters are worth more than emphasis, because the consumer this exists for is an agent reading a pipe.

**Rejected: emitting a `coverage-gate-passed` event.** Nothing consumes it. An event that exists only for symmetry is five more reporter branches to test.
