import { expect, test } from 'bun:test'
import { peekFirstNonEmptyLine } from './peek-first-line.js'

const linesOf = (lines: readonly string[]): AsyncIterable<string> => ({
  [Symbol.asyncIterator]: () => {
    const iterator = lines[Symbol.iterator]()
    return { next: () => Promise.resolve(iterator.next()) }
  },
})

const collect = async (
  lines: AsyncIterable<string>,
): Promise<readonly string[]> => {
  let collected: readonly string[] = []
  for await (const line of lines) collected = [...collected, line]
  return collected
}

test(
  [
    'given a stream whose first line is non-empty',
    'when peeked',
    'it should return that line and replay it ahead of the rest',
  ].join(', '),
  async () => {
    // given
    const source = linesOf(['first', 'second'])

    // when
    const peeked = await peekFirstNonEmptyLine(source)
    const rest = await collect(peeked.rest)

    // then
    expect(peeked.firstLine).toBe('first')
    expect(rest).toEqual(['first', 'second'])
  },
)

test(
  [
    'given a stream with leading blank lines',
    'when peeked',
    'it should skip them to find the first non-empty line, but still replay them',
  ].join(', '),
  async () => {
    // given
    const source = linesOf(['', '  ', 'first non-empty', 'next'])

    // when
    const peeked = await peekFirstNonEmptyLine(source)
    const rest = await collect(peeked.rest)

    // then
    expect(peeked.firstLine).toBe('first non-empty')
    expect(rest).toEqual(['', '  ', 'first non-empty', 'next'])
  },
)

test(
  [
    'given an empty stream',
    'when peeked',
    'it should report no first line and replay nothing',
  ].join(', '),
  async () => {
    // given
    const source = linesOf([])

    // when
    const peeked = await peekFirstNonEmptyLine(source)
    const rest = await collect(peeked.rest)

    // then
    expect(peeked.firstLine).toBeUndefined()
    expect(rest).toEqual([])
  },
)

test(
  [
    'given a stream of only blank lines',
    'when peeked',
    'it should report no first line and replay all of them',
  ].join(', '),
  async () => {
    // given
    const source = linesOf(['', ''])

    // when
    const peeked = await peekFirstNonEmptyLine(source)
    const rest = await collect(peeked.rest)

    // then
    expect(peeked.firstLine).toBeUndefined()
    expect(rest).toEqual(['', ''])
  },
)
