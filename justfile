# pi-crust: every recipe lives in the package, not in this repository.
# `just crust <recipe>` reaches them; `just crust default` lists them.
#
# `set positional-arguments` + "$@" rather than {{ARGS}}: interpolation
# re-splits on whitespace, which turns a quoted prompt into one word.
set positional-arguments

crust *ARGS:
    #!/usr/bin/env bash
    set -euo pipefail
    home="${CRUST_HOME:-}"
    if [[ -z "$home" && -f .pi-crust/data/pi-crust-home ]]; then
      home="$(cat .pi-crust/data/pi-crust-home)"
    fi
    if [[ -z "$home" ]]; then
      common="$(git rev-parse --git-common-dir 2>/dev/null || true)"
      if [[ -n "$common" ]]; then
        root="$(cd "$(dirname "$common")" && pwd)"
        if [[ -f "$root/.pi-crust/data/pi-crust-home" ]]; then
          home="$(cat "$root/.pi-crust/data/pi-crust-home")"
        fi
      fi
    fi
    if [[ -z "$home" ]]; then
      echo "crust: cannot find the package home." >&2
      echo "  checked CRUST_HOME, .pi-crust/data/pi-crust-home, and \$(git rev-parse --git-common-dir)/../.pi-crust/data/pi-crust-home." >&2
      echo "  set CRUST_HOME to repair it." >&2
      exit 2
    fi
    exec bun "$home/runtime/cli.ts" "$@"
