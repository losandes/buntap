#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { main } from './cli.js'
import { readLines } from './parse/read-lines.js'

// This is the one edge boundary that owns converting a throwing Node API
// into an optional value (§1.2.6: unreadable/missing resolves to no gate).
const readTextFile = (path: string): string | undefined => {
  // biome-ignore lint/plugin/no-intermediate-try-catch: this is that boundary
  try {
    return readFileSync(path, 'utf8')
  } catch (_err) {
    return undefined
  }
}

// A truncated pipe (`buntap | head`) ends in EPIPE, not a bug; without this,
// Node's default unhandled 'error' event crashes with a stack trace.
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') process.exit(0)
})

process.exitCode = await main({
  input: readLines(process.stdin),
  write: (chunk) => void process.stdout.write(chunk),
  writeError: (chunk) => void process.stderr.write(chunk),
  columns: process.stdout.columns ?? 75,
  isTty: Boolean(process.stdout.isTTY),
  env: process.env,
  cwd: process.cwd(),
  readTextFile,
})(process.argv.slice(2))
