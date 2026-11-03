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

## `bunt` takes no args or flags

`bunt` takes no flags of its own: every argument is appended to `bun test` verbatim and in order, and none of them are inspected. There is consequently no `bunt --help` or `bunt --version`; `bun test` ignores both of those flags, so `bunt --version` simply runs your suite.

## Exit-code precedence (protocol mode only)

Resolved top to bottom; the first matching row wins.

| Condition                                   | Exit                  | Verdict line example                                                     |
| ------------------------------------------- | --------------------- | ------------------------------------------------------------------------ |
| Parsed failures or errors greater than zero | `1`                   | `buntap: 2 tests failed - exiting 1`                                     |
| No failures, coverage gate tripped          | `3`                   | `buntap: coverage below the configured minimum - exiting 3`              |
| No failures, bun was killed by a signal     | `128 + signal number` | `buntap: bun was killed by SIGINT - exiting 130`                         |
| No failures, bun exited nonzero             | that code             | `buntap: bun exited 1 before reporting any tests - exiting 1`            |
| No `runner-exit` line arrived               | `2`                   | `buntap: the runner stopped without reporting its exit code - exiting 2` |
| Otherwise                                   | `0`                   | `buntap: 247 tests passed - exiting 0`                                   |

Do not add `set -o pipefail` to this pipeline. `bunt` deliberately exits with bun's own exit code so it behaves like `bun test` when run alone. With `pipefail` the shell reports that code instead of the resolved one above, which defeats the reason this protocol exists.

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

## Exit codes

| Code | Meaning                                                               |
| ---- | --------------------------------------------------------------------- |
| `0`  | no failures, no errors, and coverage at or above the threshold        |
| `1`  | bun reported a test failure, an error, or an unhandled error          |
| `2`  | a usage error, or no bun test summary was found on stdin              |
| `3`  | every test passed but at least one file is below the coverage minimum |

Those four are the whole range in text mode, where bun's own exit code never reaches `buntap`: bun is not the last command in the pipe, so the shell discards its status and `buntap` reconstructs pass/fail from the parsed summary. In protocol mode, `bunt` hands that code over and the precedence table above applies, which is the only way to get `128 + signal` or a passthrough of bun's own nonzero code.

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
