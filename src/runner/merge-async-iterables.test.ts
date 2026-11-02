import { expect, test } from 'bun:test'
import { mergeAsyncIterables } from './merge-async-iterables.js'

const fromArray = <T>(values: readonly T[]): AsyncIterable<T> => ({
  [Symbol.asyncIterator]: () => {
    const iterator = values[Symbol.iterator]()
    return { next: () => Promise.resolve(iterator.next()) }
  },
})

/** A controllable source: the test decides exactly when each value arrives. */
type TDeferredSource<T> = Readonly<{
  iterable: AsyncIterable<T>
  emit: (value: T) => void
  end: () => void
}>

const deferredSource = <T>(): TDeferredSource<T> => {
  // Local accumulators for a queue fed from outside its own iteration — the
  // same stream-fold shape as `read-lines.ts`'s `consume`, except the
  // "chunks" arrive from test code rather than from an upstream iterator.
  let resolvers: readonly ((result: IteratorResult<T>) => void)[] = []
  let queued: readonly IteratorResult<T>[] = []

  return {
    iterable: {
      [Symbol.asyncIterator]: () => ({
        next: () =>
          new Promise((resolve) => {
            const next = queued.at(0)
            if (next !== undefined) {
              queued = queued.slice(1)
              resolve(next)
              return
            }
            resolvers = [...resolvers, resolve]
          }),
      }),
    },
    emit: (value) => {
      const resolver = resolvers.at(0)
      if (resolver !== undefined) {
        resolvers = resolvers.slice(1)
        resolver({ done: false, value })
        return
      }
      queued = [...queued, { done: false, value }]
    },
    end: () => {
      for (const resolver of resolvers) {
        resolver({ done: true, value: undefined })
      }
      resolvers = []
    },
  }
}

test(
  [
    'given two finite sources',
    'when merged',
    'it should yield every value from both',
  ].join(', '),
  async () => {
    // given
    const a = fromArray(['a1', 'a2'])
    const b = fromArray(['b1', 'b2'])

    // when
    let actual: readonly string[] = []
    for await (const value of mergeAsyncIterables([a, b])) {
      actual = [...actual, value]
    }

    // then
    expect(new Set(actual)).toEqual(new Set(['a1', 'a2', 'b1', 'b2']))
  },
)

test(
  [
    'given a source that resolves after a slower one it was raced against',
    'when merged',
    'it should yield values in the order they actually resolved',
  ].join(', '),
  async () => {
    // given
    const a = deferredSource<string>()
    const b = deferredSource<string>()
    let seen: readonly string[] = []
    const iterator = mergeAsyncIterables([a.iterable, b.iterable])[
      Symbol.asyncIterator
    ]()

    // when
    const first = iterator.next()
    b.emit('from-b-first')
    seen = [...seen, (await first).value as string]

    const second = iterator.next()
    a.emit('from-a-second')
    seen = [...seen, (await second).value as string]

    // then
    expect(seen).toEqual(['from-b-first', 'from-a-second'])
  },
)

test(
  ['given no sources at all', 'when merged', 'it should yield nothing'].join(
    ', ',
  ),
  async () => {
    // given
    // when
    let actual: readonly unknown[] = []
    for await (const value of mergeAsyncIterables([])) {
      actual = [...actual, value]
    }

    // then
    expect(actual).toEqual([])
  },
)

test(
  [
    'given a value is emitted before next() is ever called',
    'when next() is called',
    'it should resolve immediately from the queue rather than waiting',
  ].join(', '),
  async () => {
    // given
    const source = deferredSource<string>()
    source.emit('queued-before-read')

    // when
    const actual = await source.iterable[Symbol.asyncIterator]().next()

    // then
    expect(actual).toEqual({ done: false, value: 'queued-before-read' })
  },
)

test(
  [
    'given a pending read with nothing emitted yet',
    'when the source ends',
    'it should resolve that read as done rather than leaving it hanging',
  ].join(', '),
  async () => {
    // given
    const source = deferredSource<string>()
    const iterator = source.iterable[Symbol.asyncIterator]()
    const pending = iterator.next()

    // when
    source.end()

    // then
    expect(await pending).toEqual({ done: true, value: undefined })
  },
)
