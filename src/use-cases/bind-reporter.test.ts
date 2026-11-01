import { expect, test } from 'bun:test'
import type { TReporter } from '../typedefs/reporter.js'
import type { TRunEvent } from '../typedefs/run-events.js'
import { bindReporter } from './bind-reporter.js'

type TCountState = Readonly<{ count: number }>

const countingReporter: TReporter<TCountState> = {
  initial: { count: 0 },
  next: (state, _event) => ({
    state: { count: state.count + 1 },
    output: `${state.count + 1}\n`,
  }),
  end: (state) => `done:${state.count}`,
}

test(
  [
    'given a reporter bound to an instance',
    'when next is called twice',
    'it should thread state between calls',
  ].join(', '),
  () => {
    // given
    const instance = bindReporter(countingReporter)
    const event: TRunEvent = { type: 'file-start', path: 'a.test.ts' }

    // when
    const first = instance.next(event)
    const second = instance.next(event)

    // then
    expect(first).toBe('1\n')
    expect(second).toBe('2\n')
  },
)

test(
  [
    'given a reporter bound to an instance',
    'when end is called',
    'it should see the final state',
  ].join(', '),
  () => {
    // given
    const instance = bindReporter(countingReporter)
    const event: TRunEvent = { type: 'file-start', path: 'a.test.ts' }
    instance.next(event)
    instance.next(event)

    // when
    const actual = instance.end()

    // then
    expect(actual).toBe('done:2')
  },
)
