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

`--coverage` and bun's other flags are not a problem: the coverage table passes through intact rather than being misread as test output.

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

| Flag         | Effect                                  |
| ------------ | --------------------------------------- |
| `--nyan`     | nyan cat reporter                       |
| `--markdown` | markdown reporter                       |
| `--block`    | inverse-video block reporter            |
| `--agent`    | minimal output, verbose only on failure |
| `--color`    | force colour on                         |
| `--no-color` | force colour off                        |
| `--help`     | print usage and exit `0`                |
| `--version`  | print the version and exit `0`          |

Giving two reporter flags together, or any flag not listed above, is an error: `buntap` prints usage to stderr and exits `2` rather than silently ignoring it. Colour is otherwise on only when stdout is a TTY and `NO_COLOR` is unset.

## Exit codes

| Code | Meaning                                                               |
| ---- | --------------------------------------------------------------------- |
| `0`  | the run reported no failures and no errors                            |
| `1`  | bun reported a failure, an error, or an unhandled error between tests |
| `2`  | a usage error, or no bun test summary was found on stdin              |

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
