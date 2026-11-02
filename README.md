# buntap

A zero-dependency Node.js CLI that reads `bun test`'s console output on stdin and re-emits it through a TAP14, nyan, markdown, block, or agent reporter. It parses bun's default console reporter only — not `--reporter=junit`, `--dots`, or `--only-failures` — and it derives its own exit code from the parsed results, because a pipe discards bun's.

## Install

```bash
npm install -g buntap
```

## The one thing to get right: `2>&1`

bun writes its test results to **stderr**, not stdout. `bun test | buntap` therefore sees nothing but the startup banner on stdin, and `buntap` cannot report results it was never given. The canonical invocation redirects stderr into the pipe:

```bash
bun test 2>&1 | buntap
```

If you forget the redirect, `buntap` does not fail silently: it emits a valid, empty TAP14 document, writes a hint to stderr, and exits `2`. If you run this often, a shell function saves the four characters:

```bash
buntest() { bun test 2>&1 | buntap "$@"; }
```

## Usage

```bash
bun test 2>&1 | buntap             # TAP14 (default)
bun test 2>&1 | buntap --nyan      # nyan cat
bun test 2>&1 | buntap --markdown  # markdown report
bun test 2>&1 | buntap --block     # inverse-video block report
bun test 2>&1 | buntap --agent     # minimal output, verbose only on failure
```

## `bunt`: carrying bun's exit code through the pipe

`bun test 2>&1 | buntap` loses bun's own exit code to the pipe: a shell reports only the last command's status, so a compile error, a missing test file, or bun being killed by a signal is indistinguishable from an empty run. `bunt` closes that gap. It runs `bun test` for you and sends `buntap` a newline-delimited JSON protocol on stdout instead of raw text, carrying bun's own exit code and signal alongside everything `buntap` already parses.

```bash
bunt src/lib --coverage | buntap --nyan
```

`bunt` takes no flags of its own. Every argument is passed straight through to `bun test`, including `--help` and `--version` — there is no `bunt --help` separate from bun's own.

`buntap` decides which input it received by looking at the first non-empty line on stdin: a line that parses as the protocol's JSON selects **protocol mode**; anything else — bun's own banner, for instance — selects the **text mode** described above. Both modes render identically through every reporter, and `bun test 2>&1 | buntap` remains fully supported.

In protocol mode, `buntap` prints exactly one verdict line to stderr before it exits, naming the reason and the resolved code:

```text
buntap: 2 tests failed - exiting 1
```

That line never goes to stdout, so `--markdown` and `--agent` output stays machine-consumable when redirected to a file.

### Exit-code precedence (protocol mode only)

Resolved top to bottom; the first matching row wins.

| Condition                                   | Exit                  | Verdict line example                                                     |
| ------------------------------------------- | --------------------- | ------------------------------------------------------------------------ |
| Parsed failures or errors greater than zero | `1`                   | `buntap: 2 tests failed - exiting 1`                                     |
| No failures, coverage gate tripped          | `3`                   | `buntap: coverage below the configured minimum - exiting 3`              |
| No failures, bun was killed by a signal     | `128 + signal number` | `buntap: bun was killed by SIGINT - exiting 130`                         |
| No failures, bun exited nonzero             | that code             | `buntap: bun exited 1 before reporting any tests - exiting 1`            |
| No `runner-exit` line arrived               | `2`                   | `buntap: the runner stopped without reporting its exit code - exiting 2` |
| Otherwise                                   | `0`                   | `buntap: 247 tests passed - exiting 0`                                   |

Do not add `set -o pipefail` to this pipeline. `bunt` deliberately exits with bun's own exit code — so it behaves like `bun test` when run alone — and with `pipefail` the shell reports that code instead of the resolved one above, which defeats the reason this protocol exists.

## Coverage

`bun test --coverage`'s per-file coverage table is reproduced in every reporter, not just TAP. When a file falls below the configured minimum, buntap prints a `COVERAGE FAIL` block and exits `3`. The threshold comes from `--coverage-threshold=<n>` or from `[test].coverageThreshold` in `./bunfig.toml`; only the `lines` and `functions` keys of the inline-table form are evaluated (bun's text table has no statements column). A run with no threshold configured prints the table unchanged and exits `0`.

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

A four-line scoreboard, a rainbow trajectory, and a cat whose face tracks the run: `( ^ .^)` while everything passes, `( o .o)` once something is skipped, `( x .x)` once something fails. Ported from [Supposed](https://github.com/concordances/supposed)'s `NyanReporter`.

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

Nothing for a passing test. For a failure: the file, the full test name, and the complete captured diagnostics. One summary line at the end — on an all-passing run, that line is the entire output. Built for feeding an AI coding agent only what it needs to fix a test, not a transcript of everything that already worked.

## Flags

| Flag                       | Effect                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `--nyan`                   | nyan cat reporter                                                                                                               |
| `--markdown`               | markdown reporter                                                                                                               |
| `--block`                  | inverse-video block reporter                                                                                                    |
| `--agent`                  | minimal output, verbose only on failure                                                                                         |
| `--coverage-threshold=<n>` | fail with exit `3` when a file is below `<n>` (`0`-`1` or `0`-`100`); defaults to `[test].coverageThreshold` in `./bunfig.toml` |
| `--color`                  | force colour on                                                                                                                 |
| `--no-color`               | force colour off                                                                                                                |
| `--help`                   | print usage and exit `0`                                                                                                        |
| `--version`                | print the version and exit `0`                                                                                                  |

Giving two reporter flags together, or any flag not listed above, is an error: `buntap` prints usage to stderr and exits `2` rather than silently ignoring it. Colour is otherwise on only when stdout is a TTY and `NO_COLOR` is unset.

## Exit codes

| Code | Meaning                                                               |
| ---- | --------------------------------------------------------------------- |
| `0`  | no failures, no errors, and coverage at or above the threshold        |
| `1`  | bun reported a test failure, an error, or an unhandled error          |
| `2`  | a usage error, or no bun test summary was found on stdin              |
| `3`  | every test passed but at least one file is below the coverage minimum |

bun's own exit code never reaches `buntap` — it is the last command in the pipe, so the shell only sees its status. `buntap` reconstructs pass/fail from the parsed summary instead.

## Development

```bash
bun install
bun test             # run the suite
bun test --coverage  # the suite plus the 95% coverage gate
bun run check         # Biome
bun run typecheck     # tsc --noEmit
bun run build         # emit dist/
```

Source lives entirely under `src/`; `dist/` is generated and gitignored. Reporters are pure functions from `(state, event)` to `(state, output)`, so every one of them is tested by calling it with object literals — no process spawning, no console capture.
