import { expect, test } from 'bun:test'
import { renderVerdictLine } from './render-verdict-line.js'

test(
  [
    'given a verdict with a message and a code',
    'when rendered',
    'it should print the buntap-prefixed verdict line',
  ].join(', '),
  () => {
    // given
    const verdict = { code: 1, message: '2 tests failed' }

    // when
    const actual = renderVerdictLine(verdict)

    // then
    expect(actual).toBe('buntap: 2 tests failed - exiting 1\n')
  },
)
