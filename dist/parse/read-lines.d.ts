/**
 * Splits an async byte/string stream into lines, tolerating both `\n` and
 * `\r\n`, without buffering the whole stream: each chunk is appended to the
 * carry from the previous chunk and every complete line is yielded as soon
 * as it appears.
 *
 * The `let carry` is deliberate. This was previously a `yield*` recursion,
 * one nested async generator per chunk, and every line then had to be
 * delegated back up through that whole chain: a long enough stream
 * overflowed the call stack ("Maximum call stack size exceeded"). The
 * iterator is driven by hand rather than with `for await` so that, as before,
 * a consumer that stops early does not tear down the source.
 */
export declare function readLines(input: Readonly<AsyncIterable<Buffer | string>>): AsyncGenerator<string>;
