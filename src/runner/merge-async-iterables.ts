type TPending<T> = Readonly<{
  index: number
  promise: Promise<IteratorResult<T>>
}>

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
export async function* mergeAsyncIterables<T>(
  iterables: readonly AsyncIterable<T>[],
): AsyncGenerator<T> {
  const iterators = iterables.map((iterable) =>
    iterable[Symbol.asyncIterator](),
  )

  let pending: readonly TPending<T>[] = iterators.map((iterator, index) => ({
    index,
    promise: iterator.next(),
  }))

  while (pending.length > 0) {
    const winner = await Promise.race(
      pending.map((entry) =>
        entry.promise.then((result) => ({ index: entry.index, result })),
      ),
    )

    if (winner.result.done === true) {
      pending = pending.filter((entry) => entry.index !== winner.index)
      continue
    }

    yield winner.result.value

    const iterator = iterators[winner.index]
    pending = pending.map((entry) =>
      entry.index === winner.index && iterator !== undefined
        ? { index: entry.index, promise: iterator.next() }
        : entry,
    )
  }
}
