import { expect, test } from 'bun:test'
import { readLines } from './read-lines.js'

// A plain object, not an async generator: there is no await in the body, and
// wrapping each value of a synchronous iterator in Promise.resolve satisfies
// the AsyncIterable contract without Biome's useAwait flagging a needless
// `async function*`.
const asyncIterableOf = <TItem>(
  items: readonly TItem[],
): AsyncIterable<TItem> => ({
  [Symbol.asyncIterator]: () => {
    const iterator = items[Symbol.iterator]()
    return { next: () => Promise.resolve(iterator.next()) }
  },
})

const collect = async <TItem>(
  items: AsyncIterable<TItem>,
): Promise<readonly TItem[]> => {
  // The one accumulator in this test helper: a stream fold cannot be
  // expressed as a reduce because items arrive over time.
  let out: readonly TItem[] = []
  for await (const item of items) out = [...out, item]
  return out
}

test(
  [
    'given chunks split mid-line with \\n',
    'when read as lines',
    'it should yield complete lines',
  ].join(', '),
  async () => {
    // given
    const input = asyncIterableOf(['line one\nli', 'ne two\nline three'])

    // when
    const actual = await collect(readLines(input))

    // then
    expect(actual).toEqual(['line one', 'line two', 'line three'])
  },
)

test(
  [
    'given \\r\\n line endings',
    'when read as lines',
    'it should strip the carriage return',
  ].join(', '),
  async () => {
    // given
    const input = asyncIterableOf(['a\r\nb\r\nc'])

    // when
    const actual = await collect(readLines(input))

    // then
    expect(actual).toEqual(['a', 'b', 'c'])
  },
)

test(
  [
    'given a stream of Buffer chunks',
    'when read as lines',
    'it should decode them as utf8',
  ].join(', '),
  async () => {
    // given
    const input = asyncIterableOf([Buffer.from('hello\nworld\n', 'utf8')])

    // when
    const actual = await collect(readLines(input))

    // then
    expect(actual).toEqual(['hello', 'world'])
  },
)

test(
  [
    'given no trailing newline',
    'when read as lines',
    'it should still yield the final partial line',
  ].join(', '),
  async () => {
    // given
    const input = asyncIterableOf(['no newline at end'])

    // when
    const actual = await collect(readLines(input))

    // then
    expect(actual).toEqual(['no newline at end'])
  },
)

test(
  [
    'given an empty stream',
    'when read as lines',
    'it should yield nothing',
  ].join(', '),
  async () => {
    // given
    const input = asyncIterableOf([])

    // when
    const actual = await collect(readLines(input))

    // then
    expect(actual).toEqual([])
  },
)
