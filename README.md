# buntap

Two zero-dependency Node.js commands. `buntap` reads `bun test`'s output on stdin and re-emits it through a TAP14, nyan, markdown, block, or agent reporter. `bunt` runs `bun test` for you and feeds `buntap` a JSON protocol instead of raw text, so bun's own exit code and signal survive the pipe. Only bun's default console reporter is parsed, not `--reporter=junit` or `--dots`.

## Install

buntap is not published to npm yet. Install it from GitHub, which resolves to the default branch, `latest`:

```bash
bun add -g github:losandes/buntap   # globally
bun add -d github:losandes/buntap   # or as a dev dependency of one project
```

npm works too, but npm 12 refuses git dependencies unless you opt in:

```bash
npm install -g --allow-git=all github:losandes/buntap   # on npm 11 and earlier, drop the flag
```

Either installs both executables, `buntap` and `bunt`, from the committed `dist/`. Nothing builds on install, so an install is exactly as current as the last `dist/` the maintainer committed.

## Usage

`bunt` is the invocation to reach for: it runs `bun test` itself.

```bash
bunt | buntap                     # TAP14 (default)
bunt | buntap --nyan              # nyan cat
bunt | buntap --markdown          # markdown report
bunt | buntap --block             # inverse-video block report
bunt --coverage | buntap --agent  # minimal output, verbose only on failure
bunt src/lib --coverage | buntap  # arguments go straight to `bun test`
```

Piping bun yourself is also fully supported, and every reporter renders identically either way:

```bash
bun test 2>&1 | buntap --nyan
```

**However**, loses bun's own exit code to the pipe: a shell reports only the last command's status, so a compile error, a missing test file, or bun being killed by a signal is indistinguishable from an empty run. That's why `bunt` exists: to normalize the test runner output into a document protocol.

## `bunt` arguments and paired coverage

Without `--paired`, every argument is appended to `bun test` verbatim and in order, and none of them are inspected. There is no `bunt --help` or `bunt --version`; `bun test` ignores both of those flags, so `bunt --version` simply runs your suite.

`--paired` measures each source using its whole sibling test family: for `x.ts`, that is `x.test.ts` and `x.<variant>.test.ts`, where `<variant>` is one non-empty segment without a dot. Extensions must match (`x.tsx` pairs with `x.test.tsx`, not `x.test.ts`). Each test has one owner: the exact source wins, so `x.driver.test.ts` belongs to `x.driver.ts` if that exists, otherwise to `x.ts`. A test with no owner, or with another naming convention such as `.spec.`, runs but contributes no coverage row. Imported sources whose own tests are outside the run do not affect the gate. A tested source that its family never loads contributes a 0% row.

```bash
bunt --paired src/lib | buntap --agent
bunt --paired --paired-concurrency=1 --timeout=10000 src/lib | buntap --agent
bunt --paired src/lib | buntap --agent --coverage-threshold=90
bunt --paired src/calc.ts src/other.test.ts | buntap --agent
bunt --paired src/types.ts '--paired-exempt=**/types.ts' --pass-with-no-tests | buntap --agent
```

`bunt` resolves existing source-file arguments directly to their families; it never passes a source path to bun as a test. Naming one test file also selects its whole family. Each family runs in one `bun test --coverage` process, so coverage reflects all its tests together. Ownerless tests run individually. `bunt` emits one coverage table containing only the paired rows. A gap with all tests passing exits `3`; failing tests take precedence and exit `1`. Without a minimum, coverage is rendered but no file is a gap. Whole-run coverage without `--paired` is unchanged.

Every named source with no tests is listed on `buntap`'s stderr under every reporter, even when other tests fail. With no failing tests, any untested source makes the pipeline exit `4`, ahead of coverage gaps, signals and bun's own failures. `--pass-with-no-tests` never excuses an untested source. It yields `0` for an empty paired selection only when no source is untested and discovery succeeded (or was unnecessary); without it an empty selection is nonzero.

Declare an exemption with repeatable `--paired-exempt=<glob>` flags. Sources matching `[test].coveragePathIgnorePatterns` in `./bunfig.toml` are automatically exempt. Exemptions apply only to sources with no tests; tested sources still run. Globs match the whole cwd-relative path and support `**` (including directories), `*` (within a segment), `?` (one non-slash character), and non-nested `{a,b}` alternatives; `**/` also matches no directory, and one leading `./` is ignored. Other characters, including brackets, are literal.

Directories and partial-path filters go to bun unchanged. A directory selects tests beneath it, not a check for untested sources beneath it. Any argument that matches no tests, including a deleted path or a non-code file, is listed as having matched no tests on stderr; that notice does not change the remaining arguments' exit status.

`--paired-concurrency=<n>` limits concurrent test processes and defaults to the available CPU parallelism. Every occurrence must be a positive decimal integer (`1`, `2`, …); the last occurrence wins. In paired mode, arguments starting with `-` are bun flags (apart from the paired options), and other arguments are source paths or discovery filters. Value-taking bun flags must therefore use `--flag=value`, not a separate value. `--coverage`, `--coverage-reporter…` and `--coverage-dir…` arguments are removed; family processes always receive `--coverage`.

A bare `--`, `-t`, any `--test-name-pattern…` argument, an invalid `--paired-concurrency=<n>`, or a bare or empty `--paired-exempt` is a usage error in paired mode: `bunt` writes a diagnostic to stderr, spawns nothing, and exits `2`. Paired measurement always runs whole test files.

### Paired-mode limits

- Discovery evaluates each matched test file's top-level code once before the real runs; test hooks do not run during discovery.
- Test files in one family share a process, including module state. Different families run in separate concurrent processes; suites sharing a port or file across families need `--paired-concurrency=1`.
- `bunfig.toml` controls coverage output. Its settings can override coverage command-line flags. Keep `"text"` in `coverageReporter`: without it, bun emits no table and every pair is reported at 0%. A source excluded by `coveragePathIgnorePatterns` is likewise reported at 0%.
- Concurrent processes overwrite a shared `lcov.info` when lcov output is configured; that file ends up containing one arbitrary test file's coverage, not the combined paired table.
- Discovery recognises `*.test.*`, `*_test.*` and `*.spec.*` headers. Bun also matches `_test_` and `_spec_` filenames; a discovery count mismatch exits `2` rather than silently omitting them. Only `.test.` siblings are paired.

## Exit-code precedence (protocol mode only)

Resolved top to bottom; the first matching row wins.

| Condition                                   | Exit                  | Verdict line example                                                     |
| ------------------------------------------- | --------------------- | ------------------------------------------------------------------------ |
| Parsed failures or errors greater than zero | `1`                   | `buntap: 2 tests failed - exiting 1`                                     |
| No failures, at least one untested source   | `4`                   | `buntap: 1 source has no tests - exiting 4`                              |
| No failures, coverage gate tripped          | `3`                   | `buntap: coverage below the configured minimum - exiting 3`              |
| No failures, bun was killed by a signal     | `128 + signal number` | `buntap: bun was killed by SIGINT - exiting 130`                         |
| No failures, paired run, bun exited `4`     | `2`                   | `buntap: bun exited 4 before reporting any tests - exiting 2`            |
| No failures, bun exited nonzero             | that code             | `buntap: bun exited 1 before reporting any tests - exiting 1`            |
| No `runner-exit` line arrived               | `2`                   | `buntap: the runner stopped without reporting its exit code - exiting 2` |
| Otherwise                                   | `0`                   | `buntap: 247 tests passed - exiting 0`                                   |

Exit `4` is reserved for untested sources in paired mode: a bun exit of `4` with no untested source is reported as `2`, with the verdict line naming the original code. The `runner-exit` wire event retains bun's real code. Unpaired runs still pass `4` through unchanged.

Do not add `set -o pipefail` to this pipeline. `bunt` preserves runner outcomes except for the paired untested-source result and the paired exit-`4` reservation; `buntap` resolves the full precedence. With `pipefail` the shell reports that code instead of the resolved one above, which defeats the reason this protocol exists.

## Coverage

`bun test --coverage`'s per-file coverage data is rendered in one of five modes - `full`, `failures`, `summary`, `bar`, `markdown` - chosen per reporter by default and overridable with `--coverage-report=<mode>`. When a file falls below the configured minimum, buntap prints a `COVERAGE FAIL` block and exits `3` in every mode; that block's format is the same in every mode, names the uncovered lines of each failing file, and the exit code never changes. The threshold comes from `--coverage-threshold=<n>` or from `[test].coverageThreshold` in `./bunfig.toml`; only the `lines` and `functions` keys of the inline-table form are evaluated (bun's text table has no statements column). A run with no threshold configured still renders the chosen mode and exits `0`.

### Coverage report modes

| Reporter   | Default mode | What it shows                                                              |
| ---------- | ------------ | -------------------------------------------------------------------------- |
| `tap`      | `full`       | bun's table unchanged; pinned, and cannot be overridden to another mode    |
| `agent`    | `summary`    | one line: overall percentages, file count, and the gate verdict            |
| `markdown` | `markdown`   | a headline, a worst-first table, and bun's table folded behind `<details>` |
| `nyan`     | `bar`        | a threshold-marked bar per file below `100%`, worst first                  |
| `block`    | `bar`        | a threshold-marked bar per file below `100%`, worst first                  |

`--coverage-report=<mode>` overrides the default for every reporter except `tap`, which always reports coverage in full; giving it any other mode is a usage error.

`summary`, the line the agent reporter prints on a clean run:

```text
coverage  lines 99.93%  funcs 99.93%  ·  48 files  ·  all above 95%
```

`bar`, nyan's default:

```text
coverage  95% minimum
  src/parse/parse-run.ts              lines   82.40%  ███████████████████░░░░░┊░  FAIL  118-140, 203
  src/runner/bunt-runner.ts           funcs   91.00%  █████████████████████░░░┊░  FAIL  77, 91-94
  src/cli.test.ts                     lines   99.52%  ████████████████████████┊█  ok    393-394
coverage  lines 94.10%  funcs 96.80%  ·  48 files  ·  2 below 95%
```

`markdown`, markdown's default:

````text
**Coverage: 2 of 48 files below 95%** — lines 94.10%, funcs 96.80%

| File | Lines | Funcs | Uncovered |
| --- | --- | --- | --- |
| `src/parse/parse-run.ts` | 82.40% | 97.00% | 118-140, 203 |
| `src/runner/bunt-runner.ts` | 99.10% | 91.00% | 77, 91-94 |

<details><summary>Full coverage table</summary>

```text
...bun's table, unmodified...
```

</details>
````

`COVERAGE FAIL`, printed in every mode when a file trips the threshold:

```text
COVERAGE FAIL 2 files below the minimum (functions 95.00%, lines 95.00%)
  src/add.ts functions 25.00%, lines 100.00% (uncovered 4-7, 12, 20-22)
  src/sub.ts functions 50.00%, lines 60.00%
```

Colour is never the only carrier of a distinction: every mode renders the same words and numbers with colour off as with colour on.

### TAP (default)

```text
TAP version 14
# src/a.test.ts
ok 1 - adds
not ok 2 - fails
  ---
  message: "expect(received).toBe(expected)"
  severity: fail
  duration_ms: 0.06
  ...
1..2
# tests 2
# pass 1
# fail 1
# skip 0
# todo 0
# duration_ms 9
```

Conforms to the [TAP version 14 specification](https://testanything.org/tap-version-14-specification.html). The TAP reporter never emits colour, regardless of `--color`.

### `--nyan`

A four-line scoreboard, a rainbow trajectory, and a cat whose face tracks the run: `( ^ .^)` while everything passes, `( o .o)` once something is skipped, `( x .x)` once something fails. Ported from [Supposed](https://github.com/concordances/supposed)'s `NyanReporter` (original credit goes to [mocha](https://mochajs.org/), I think).

### `--markdown`

````text
# Tests

- src/a.test.ts
  - math
    - adds
    - fails

## Errors

#### math > fails

```text
error: expect(received).toBe(expected)
```

## Totals

- **total**: 2
- **passed**: 1
- **failed**: 1
- **skipped**: 0
- **duration**: 9.00ms
````

### `--block`

One line per test, prefixed with an inverse-video badge: ` PASS ` on green, ` FAIL ` on red, ` SKIP ` on yellow, ` TODO ` on cyan.

### `--agent`

Nothing for a passing test. For a failure: the file, the full test name, and the complete captured diagnostics. One summary line at the end. On an all-passing run, that line is the entire output. Built for feeding an AI coding agent only what it needs to fix a test, not a transcript of everything that already worked.

## Flags

| Flag                       | Effect                                                                                                                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--nyan`                   | nyan cat reporter                                                                                                                                                                             |
| `--markdown`               | markdown reporter                                                                                                                                                                             |
| `--block`                  | inverse-video block reporter                                                                                                                                                                  |
| `--agent`                  | minimal output, verbose only on failure                                                                                                                                                       |
| `--coverage-threshold=<n>` | fail with exit `3` when a file is below `<n>` (`0`-`1` or `0`-`100`); defaults to `[test].coverageThreshold` in `./bunfig.toml`                                                               |
| `--coverage-report=<mode>` | how coverage is rendered: `full`, `failures`, `summary`, `bar`, or `markdown`; per-reporter default when absent (see [Coverage](#coverage)); the tap reporter always reports coverage in full |
| `--color`                  | force colour on                                                                                                                                                                               |
| `--no-color`               | force colour off                                                                                                                                                                              |
| `--help`                   | print usage and exit `0`                                                                                                                                                                      |
| `--version`                | print the version and exit `0`                                                                                                                                                                |

Giving two reporter flags together, or any flag not listed above, is an error: `buntap` prints usage to stderr and exits `2` rather than silently ignoring it. Colour is otherwise on only when stdout is a TTY and `NO_COLOR` is unset.

## Environment variables

| Variable                 | Effect                                                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `BUNTAP_REPORTER=<name>` | reporter to use when no reporter flag is given: `tap`, `nyan`, `markdown`, `block`, or `agent`; a reporter flag takes precedence |
| `NO_COLOR`               | turn colour off when neither `--color` nor `--no-color` is given                                                                 |

An empty `BUNTAP_REPORTER` is treated as unset. Any other unrecognised value is a usage error (exit `2`), unless a reporter flag is also given, in which case the variable is ignored.

`buntap` reads the variable, not `bunt`, and an inline assignment applies only to the command it precedes. Put it in front of `buntap`, or export it:

```bash
bunt | BUNTAP_REPORTER=nyan buntap   # works
export BUNTAP_REPORTER=nyan          # works for every run in this shell
BUNTAP_REPORTER=nyan bunt | buntap   # does not work: only bunt sees it
```

## Exit codes

| Code | Meaning                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------- |
| `0`  | no failures, no errors, no untested sources, and coverage at or above the threshold                           |
| `1`  | bun reported a test failure, an error, or an unhandled error                                                  |
| `2`  | a usage error, missing summary/runner exit, or paired runner-only exit `4`                                    |
| `3`  | no failures or untested sources, but a file is below the coverage minimum                                     |
| `4`  | paired mode only: at least one untested source and no failing test; outranks `3`, signals and runner failures |

Codes `0`–`3` are the whole range in text mode, where bun's own exit code never reaches `buntap`: bun is not the last command in the pipe, so the shell discards its status and `buntap` reconstructs pass/fail from the parsed summary. In protocol mode, `bunt` hands that code over and the precedence table above applies, which is the only way to get `128 + signal` or a passthrough of bun's own nonzero code.

## Development

```bash
bun install
bun run test           # the suite, through bunt and the nyan reporter
bun run test:tap       # the same suite through TAP14
bun run test:block     # ... the block reporter
bun run test:markdown  # ... the markdown reporter
bun run test:agent     # ... with --coverage and the 95% gate
bun run test:dist      # the suite through the built dist/ binaries
bun run lint           # Biome (lint:fix to apply)
bun run typecheck      # tsc --noEmit
bun run build          # emit dist/
```

The repository dogfoods: every `test*` script pipes `bun src/bunt.ts` into `bun src/bin.ts`, so a change to a reporter shows up in the output of the run that tests it. Plain `bun test` still works and prints bun's own output.

Source lives entirely under `src/`. `dist/` is generated but **committed**, because a GitHub install runs no build and the `bunt` and `buntap` bins would otherwise not exist. Rebuild and commit it in the same change that moves `src/`; `bun run test:ci` builds and then runs the suite through `dist/`, which is the check that it is current.

Reporters are pure functions from `(state, event)` to `(state, output)`, so every one of them is tested by calling it with object literals... no process spawning, no console capture.
