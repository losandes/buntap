/**
 * §1.1.3: merges bun's stdout and stderr into one stream, in the order each
 * one actually produces a line, not stdout-then-stderr or vice versa.
 *
 * The `let pending` here is the ADR's sanctioned exception, not a fallback:
 * several iterators race concurrently for whichever produces its next value
 * first, which is a genuinely stateful coordination — the same shape as the
 * ADR's own "workers share one cursor" example — and expressing it without a
 * reassigned cursor would mean simulating that race rather than running it.
 */
export declare function mergeAsyncIterables<T>(iterables: readonly AsyncIterable<T>[]): AsyncGenerator<T>;
