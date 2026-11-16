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
export async function* readLines(input) {
    const iterator = input[Symbol.asyncIterator]();
    let carry = '';
    while (true) {
        const next = await iterator.next();
        if (next.done === true) {
            if (carry.length > 0)
                yield carry;
            return;
        }
        const text = carry +
            (typeof next.value === 'string'
                ? next.value
                : next.value.toString('utf8'));
        const lines = text.split(/\r\n|\n/);
        yield* lines.slice(0, -1);
        carry = lines.at(-1) ?? '';
    }
}
//# sourceMappingURL=read-lines.js.map