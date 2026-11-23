#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { buntMain } from './runner/bunt-main.js'
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

process.exitCode = await buntMain({
  spawn: spawnBunTest,
  write: (chunk) => void process.stdout.write(chunk),
  writeError: (chunk) => void process.stderr.write(chunk),
  fileExists: existsSync,
  cwd: process.cwd(),
  pathKind: (path) => {
    // biome-ignore lint/plugin/no-intermediate-try-catch: this is that boundary
    try {
      const stat = statSync(path)
      return stat.isFile()
        ? 'file'
        : stat.isDirectory()
          ? 'directory'
          : undefined
    } catch {
      return undefined
    }
  },
  listDir: (dir) => {
    // biome-ignore lint/plugin/no-intermediate-try-catch: this is that boundary
    try {
      return readdirSync(dir)
    } catch {
      return []
    }
  },
  readTextFile: (path) => {
    // biome-ignore lint/plugin/no-intermediate-try-catch: this is that boundary
    try {
      return readFileSync(path, 'utf8')
    } catch {
      return undefined
    }
  },
  now: Date.now,
  defaultConcurrency: availableParallelism(),
  onSignal,
})(process.argv.slice(2))
