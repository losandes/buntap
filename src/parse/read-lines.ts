/**
 * The only recursion in this module: each call awaits exactly one chunk and
 * threads the carried-over partial line into the next call as a parameter,
 * rather than reassigning a `let`. This mirrors `parse-run.ts`'s `consume`,
 * which is the codebase's one sanctioned shape for a stream fold with no
 * mutable accumulator — `bindReporter`'s `state` and the CLI driver's
 * `exitState` remain the only two named `let` reassignments (§1.6.4).
 */
const consume = async function* (
  carry: string,
  iterator: AsyncIterator<Buffer | string>,
): AsyncGenerator<string> {
  const next = await iterator.next()
  if (next.done === true) {
    if (carry.length > 0) yield carry
    return
  }
  const text =
    carry +
    (typeof next.value === 'string' ? next.value : next.value.toString('utf8'))
  const lines = text.split(/\r\n|\n/)
  const nextCarry = lines.at(-1) ?? ''
  yield* lines.slice(0, -1)
  yield* consume(nextCarry, iterator)
}

/**
 * Splits an async byte/string stream into lines, tolerating both `\n` and
 * `\r\n`, without buffering the whole stream: each chunk is appended to the
 * carry from the previous chunk and every complete line is yielded as soon
 * as it appears.
 */
export const readLines = (
  input: AsyncIterable<Buffer | string>,
): AsyncGenerator<string> => consume('', input[Symbol.asyncIterator]())
