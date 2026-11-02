# Contributing

Thank you for wanting to improve bun-test-reporters.

## Licensing of contributions

bun-test-reporters is released under the [MIT License](LICENSE).

By submitting a contribution — a pull request, a patch, a code suggestion in an issue or a review — you agree that:

- You have the right to submit it, and it is your own work or work you are authorised to contribute.
- Your contribution is licensed under the project licence in force at the time it is merged.
- The maintainer may relicense the project, including your contribution, under different terms in future, without asking you again.

That last point is the one worth being explicit about, because it is the one that is hard to fix later. Relicensing requires the permission of every copyright holder in the codebase, so a single contribution made without this agreement can block it for everyone. Asking once, here, avoids having to track people down years later.

This grant runs to the maintainer only. It does not give anyone else rights beyond the project licence, and it does not transfer your copyright: you keep it, and you may use your own contribution however you like elsewhere.

If you cannot agree to this, please open an issue describing the change rather than submitting the code. A described idea carries no licence, and is welcome.

## Branching and pull requests

`main` is always installable. Every change arrives through a short-lived branch and a pull request, including the maintainer's.

- Branch from `main`, named `<owner>/<topic>` — `losandes/archive-verb`.
- [Conventional Commits](https://www.conventionalcommits.org): `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`. Present tense, imperative.
- Keep a pull request to one concern. One that fixes a bug and tidies the surrounding file is two reviews pretending to be one.
- Run the checks. A change is not ready while anything is red.
- Explain **why**, in the commit body and in the description. What the diff does is already visible; what it is for is not.
- Rebase rather than merge `main` into your branch; squash on merge, so `main` stays linear and each entry is one reviewable change.
