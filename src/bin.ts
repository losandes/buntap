#!/usr/bin/env node
import { main } from './cli.js'
import { readLines } from './parse/read-lines.js'

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
})(process.argv.slice(2))
