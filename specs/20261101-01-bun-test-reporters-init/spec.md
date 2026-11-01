# Bun Test Reporters

## Reference

- Bun's test reporters are documented here: https://bun.sh/docs/test/reporters. Make sure to explore the [Custom Reporters documentation](https://bun.sh/docs/test/reporters#custom-reporters)
- Supposed' nyan cat reporter can be found here: ../supposed/src/reporters/NyanReporter.js.
- [tap-nyan](https://github.com/marek629/tap-nyan) provides an example interface for piping output from one reporter to another.

## Objective

Write a nodejs utility that I can install globally, that enables me to pipe test
output from bun to a reporter of my choice (e.g. `bun test | buntap` or
`bun test | buntap --nyan`).

This utility needs to support / workaround bun's arguments, such as `--coverage`
so those don't break the output and are displayed as passthrough.

Build the following reporters:

- `buntap`: a TAP reporter that meets the TAP14 spec: https://testanything.org/tap-version-14-specification.html
- `buntap --nyan`: a nyan cat reporter based on ../supposed/src/reporters/NyanReporter.js
- `buntap --markdown`: a markdown reporter based on ../supposed/src/formatters/MarkdownFormatter.js
- `buntap --block`: a reporter based on ../supposed/src/formatters/BlockFormatter.js
- `buntap --agent`: a reporter based on the spirit of what CLAUDECODE=1 achieves with `CLAUDECODE=1 bun test`: minimal output unless a test fails with verbose output about the failure, and a summary at the end (similar to ../supposed/src/formatters/BriefFormatter.js) so we reduce tokens used to what an agent really needs to improve the tests or verify the outcomes.

## Requirements

- Use NodeJS latest LTE
- Use TypeScript
- Follow the conventions described in my ~/.dotfiles/pi/skills/adr records,
  as appropriate
- All source code should live in the src directory.
- Achieve 95+% coverage (aim for 100% wherever practical)
- Do not print lines to the console in your tests
- DO NOT commit this SPEC-INIT.md file.
- Add the package.json and any other configuration we need to be able to release this to package managers.
- Add a README with instructions on how to use it.
