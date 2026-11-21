import { expect, test } from 'bun:test'
import { mapWithConcurrency } from './map-with-concurrency.js'

for (const limit of [1, 2, 10]) {
  test(
    [
      `given concurrency ${limit}`,
      'when mapping async work',
      'it should bound live work and preserve item order',
    ].join(', '),
    async () => {
      // given
      let active = 0
      let maximum = 0
      const items = [1, 2, 3, 4, 5]
      // when
      const pending = mapWithConcurrency(limit)(items, async (item) => {
        active += 1
        maximum = Math.max(maximum, active)
        await Promise.resolve()
        active -= 1
        return item * 2
      })
      const settled = await Promise.allSettled(pending)
      // then
      expect(maximum).toBe(Math.min(limit, items.length))
      expect(settled).toEqual(
        items.map((item) => ({ status: 'fulfilled', value: item * 2 })),
      )
    },
  )
}

test(
  [
    'given a task that rejects',
    'when mapping with one worker',
    'it should preserve the rejection and still process later items',
  ].join(', '),
  async () => {
    // given
    const error = new Error('broken')
    // when
    const settled = await Promise.allSettled(
      mapWithConcurrency(1)([1, 2], (item) =>
        item === 1 ? Promise.reject(error) : Promise.resolve(item),
      ),
    )
    // then
    expect(settled).toEqual([
      { status: 'rejected', reason: error },
      { status: 'fulfilled', value: 2 },
    ])
  },
)

test(
  [
    'given no items',
    'when mapping concurrently',
    'it should return no promises',
  ].join(', '),
  () => {
    // given
    const processItem = Promise.resolve.bind(Promise)
    // when
    const actual = mapWithConcurrency(2)([], processItem)
    // then
    expect(actual).toEqual([])
  },
)
