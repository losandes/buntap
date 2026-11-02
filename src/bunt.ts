#!/usr/bin/env node
import { runBunt } from './runner/bunt-runner.js'
import { spawnBunTest } from './runner/spawn-bun-test.js'

// §1.1.9: a truncated pipe (`bunt | head`) ends in EPIPE, not a bug.
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') process.exit(0)
})

// §1.1.8: forwards SIGINT/SIGTERM to the child; the runner's own loop then
// waits for the child to exit before this process does, because nothing
// here calls `process.exit()`.
const onSignal = (handler: (signal: NodeJS.Signals) => void): (() => void) => {
  const forward = (signal: NodeJS.Signals) => handler(signal)
  process.on('SIGINT', forward)
  process.on('SIGTERM', forward)
  return () => {
    process.off('SIGINT', forward)
    process.off('SIGTERM', forward)
  }
}

process.exitCode = await runBunt({
  spawn: spawnBunTest,
  write: (chunk) => void process.stdout.write(chunk),
  onSignal,
})(process.argv.slice(2))
