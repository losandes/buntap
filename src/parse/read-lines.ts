/**
 * Splits an async byte/string stream into lines, tolerating both `\n` and
 * `\r\n`, without buffering the whole stream: each chunk is appended to a
 * carry-over buffer and every complete line is yielded as soon as it appears.
 */
export const readLines = async function* (
  input: AsyncIterable<Buffer | string>,
): AsyncGenerator<string> {
  let carry = '' // the one accumulator for the partial line spanning two chunks
  for await (const chunk of input) {
    const text =
      carry + (typeof chunk === 'string' ? chunk : chunk.toString('utf8'))
    const lines = text.split(/\r\n|\n/)
    carry = lines.at(-1) ?? ''
    for (const line of lines.slice(0, -1)) yield line
  }
  if (carry.length > 0) yield carry
}
