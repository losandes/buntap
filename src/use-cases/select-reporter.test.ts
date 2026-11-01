import { expect, test } from 'bun:test'
import type { TReporterDeps } from '../typedefs/reporter.js'
import { selectReporter } from './select-reporter.js'

const deps: TReporterDeps = { columns: 80, isTty: false, color: false }

const cases = [
  { reporter: 'tap', expectedOutput: 'TAP version 14\n' },
  { reporter: 'nyan', expectedOutput: '\n\u001b[?25l 0\n 0\n 0\n 0\n' },
  { reporter: 'agent', expectedOutput: '' },
  { reporter: 'block', expectedOutput: '' },
  { reporter: 'markdown', expectedOutput: '' },
] as const

for (const { reporter, expectedOutput } of cases) {
  test(
    [
      `given the ${reporter} reporter name`,
      'when selected',
      'it should respond to a run-start event accordingly',
    ].join(', '),
    () => {
      // given
      const options = { mode: 'run', reporter, colorMode: 'auto' } as const

      // when
      const instance = selectReporter(deps)(options)
      const output = instance.next({
        type: 'run-start',
        version: '1.3.14',
        revision: undefined,
      })

      // then
      expect(output).toBe(expectedOutput)
    },
  )
}

test(
  [
    'given an unrecognised reporter value',
    'when selected',
    'it should fall back to the TAP reporter',
  ].join(', '),
  () => {
    // given
    const options = { mode: 'run', reporter: 'tap', colorMode: 'auto' } as const

    // when
    const instance = selectReporter(deps)(options)
    const output = instance.next({
      type: 'run-start',
      version: '1.3.14',
      revision: undefined,
    })

    // then
    expect(output).toBe('TAP version 14\n')
  },
)
