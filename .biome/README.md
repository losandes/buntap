# Biome plugins

Custom lint rules written in [GritQL](https://biomejs.dev/linter/plugins/), for conventions Biome has no built-in rule for. Each plugin enforces exactly one convention and states it in the diagnostic, so a reader gets the reasoning and the fix rather than only the prohibition.

These are deliberately self-contained: no diagnostic cites a file path, because the rules are meant to be copied into any repository and a path that resolves in one is noise in the next.

| Plugin | Enforces |
|---|---|
| `no-array-mutation.grit` | Arrays are built, not edited |
| `no-promise-all.grit` | Settle all tasks and measure the failures rather than discarding completed work |
| `no-object-mutation.grit` | Values are built, not edited |
| `no-intermediate-try-catch.grit` | Exception-to-settlement conversion happens in a helper or at a boundary |

Shipped but not enabled:

| Plugin | Enforces |
|---|---|
| `no-throw.grit` | Functions return failures rather than throwing them |

A plugin is loaded only if `biome.json` names it, so an unlisted file costs nothing and is available to any repository that wants it. `no-throw` pairs with `no-intermediate-try-catch` — nothing throws, and nothing converts an exception to a settlement part-way through — but switching it on is a refactor rather than a configuration change, because a codebase that throws reports every site at once.

Every enabled rule applies to every file. Nothing is scoped by directory, and the reasoning is in [Ownership, not location](#ownership-not-location).

Rules are split by what is mutated rather than by which method does it. An earlier split put `sort` and `reverse` in one file and `push`, `pop`, `shift`, `unshift` and `splice` in another, which gave the same concept two different scopes for no reason anyone chose. Where two rules could both claim a pattern, one owns it: computed assignment `obj[key] = value` belongs to the array rule, and `delete` is left to Biome's own `noDelete`.

Not every convention needs a plugin. Banning a package is `noRestrictedImports` in `biome.json`, which is how `fp-ts`, `purify-ts`, `monet`, and `true-myth` are kept out — results are discriminated unions on `status`, not `Either`/`Maybe`. Mutating a parameter is `noParameterAssign`, and reaching for `arguments` is `noArguments`. Check the built-in rules before writing a plugin.

A built-in that reports nothing may be switched off rather than satisfied. `recommended: true` does not enable every rule, so confirm with a deliberate violation before concluding a codebase is clean.

A plugin can be scoped to part of a repository by declaring it inside an override rather than at the top level. None of these use that today — see "Ownership, not location" for why the one rule that did was changed.

## Suppressing a diagnostic

Name the rule. The name is the plugin's filename without `.grit`:

```ts
// biome-ignore lint/plugin/no-promise-all: fixed tuple; every value is required, so there is no partial success to report
const [config, token] = await Promise.all([loadConfig(), getToken()])
```

Three things to know before you write one.

**The reason is mandatory.** Biome rejects a bare `// biome-ignore lint/plugin` as a parse error *and* still reports the underlying violation, so a suppression with no justification cannot be used to get a green build.

**Name the rule rather than suppressing all of them.** `lint/plugin` on its own silences every plugin diagnostic on that line, and a line often trips two — `o.last = xs.pop()` is both an array mutation and a property assignment. The unqualified form hides the second one, now and whenever a future plugin starts matching that line. Verified on Biome 2.5.15: suppressing `no-array-mutation` leaves the property assignment reported, and suppressing `no-object-mutation` leaves the `pop` reported.

**A misspelled rule name fails loudly.** `lint/plugin/does-not-exist` reports an unused-suppression error and leaves the original diagnostics in place, so a typo cannot quietly disable anything. The path and the `.grit` extension are both rejected; only the bare stem works.

Never use bare `// biome-ignore lint:` — it disables every rule on the line, built-in ones included.

Find every suppression in the repo, and the unqualified ones that should be narrowed:

```bash
rg -n 'biome-ignore lint/plugin' --glob '!node_modules'
rg -n 'biome-ignore lint/plugin:' --glob '!node_modules'
```

## No package is exempt

Plugins are declared at the top level of `biome.json`, so every rule applies to every file. A package with pre-existing violations fails `biome check` until it is fixed. That is intended: the failure is the record of the debt, and a rule that is switched off where it is most needed is not a rule.

It is technically possible to exempt a path, and the mechanism is worth knowing before anyone reaches for it. **Overrides can add plugins but cannot remove them** — a nested `"plugins": []` does not disable an inherited plugin. The only way to exempt a path is to declare the plugin *inside* an override that excludes it:

```json
"overrides": [
  { "includes": ["**", "!some/excluded/path/**"],
    "plugins": ["./.biome/no-promise-all.grit"] }
]
```

We do not do this. It was tried and removed, because an exclusion is invisible from inside the excluded package — the editor stays quiet, the rule appears not to exist, and the debt stops being felt by the only people positioned to repay it. A failing lint run is a worse experience and a better signal.

## Adding a plugin

1. Write the rule, and state the convention in the diagnostic — the rule itself, not a path to where it is written down, so the message survives being copied into another repository
2. Verify it fires on a violation *and* stays silent on the compliant form — a rule that never fires and a rule that always fires are equally useless
3. Bind the whole match with `as $node` and span *that*. Spanning an inner metavariable reports the diagnostic partway into the construct, so the suppression comment has to sit somewhere no reader would look for it
4. Confirm a suppression actually silences it. Biome reports a misplaced one as `suppressions/unused`, which is the fastest way to find a bad span
5. Measure the blast radius **with the linter**, not with `rg`. A shell glob does not mean what a Biome `includes` glob means — `*/use-cases/*.ts` misses nested paths that `**/use-cases/**/*.ts` matches, and the gap silently reads as zero
6. Decide what happens to existing violations, then add the plugin to `biome.json`
7. Add a row to the table above, naming the convention the rule enforces

## Known limits

- **No type information.** Anything needing a resolved type — whether a parameter is `Readonly`, whether a value is a `Promise` — cannot be written as a plugin.
- **`let` declarations are not matchable.** `const` is. Target the reassignment instead, which is the mutation the convention actually cares about.
- **No catch-all for trailing clauses.** `try { $body } $rest` matches nothing; every try/catch shape must be written out separately.
- **No catch-all for operators either.** Compound assignment needs one pattern per operator — fifteen of them, from `+=` to `>>>=` — and a missing one is a silent gap rather than an error.
- **`span = $_` is accepted and silently matches nothing.** A plugin written this way reports zero violations forever and looks like a clean codebase.

## Ownership, not location

Three of these rules are unambiguous: there is no layer where `sort` should mutate, where `Promise.all` should discard completed work, or where a settlement is the wrong return. They apply everywhere.

`no-object-mutation` is the awkward one, because `$obj.$prop = $val` cannot tell "I changed a value I own" from "I called an API whose interface is assignment". `element.innerHTML`, `ref.current`, `res.locals` and `canvas.width` are not shortcuts; they are the only way those libraries accept input.

An earlier version solved that by scoping the rule to `data/` and `use-cases/`, as a proxy for "every object here is one we constructed". The proxy holds only in a repository laid out that way. Anywhere else the globs match nothing and the rule reports zero — disabled rather than satisfied, which is the worst state for a check to be in because it is indistinguishable from compliance.

The exclusion list replaces the proxy. It is a maintenance surface and it will be incomplete, but it is visible in the rule, each entry says why it is there, and its failure mode is a false positive somebody can see.

A name earns a place on that list when the API offers no non-mutating alternative. Never because a violation was inconvenient to fix — that is how an exclusion list becomes a list of everything anybody ever hit.

## Scope is not a dial

When a new rule fails somewhere inconvenient, the fix is the code or an explicit suppression — not a narrower `includes`. Excluding a path to make your own rule pass produces a green build that means nothing, and the next reader cannot tell the difference between a clean codebase and a disabled one.

The one honest reason to narrow scope is that the convention genuinely does not apply to that code, decided before the rule is written rather than after it fails.
