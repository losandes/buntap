import type { TSettlement } from '../typedefs/settlement.js'
import { classifyLine } from './classify-line.js'
import { stripAnsi } from './strip-ansi.js'

export const parseDiscoveredFiles = (
  lines: readonly string[],
): TSettlement<readonly string[], string> => {
  const clean = lines.map(stripAnsi)
  const files = [
    ...new Set(
      clean.flatMap((line) => {
        const classified = classifyLine(line)
        return classified.kind === 'file-header' ? [classified.path] : []
      }),
    ),
  ]
  const searched = clean
    .map((line) => /Searched (\d+) files?\b/.exec(line))
    .find((match) => match !== null)
  if (searched && Number(searched[1]) !== files.length)
    return {
      status: 'error',
      error: `could not list the test files bun matched (bun searched ${searched[1]}, bunt recognised ${files.length})`,
    }
  return { status: 'ok', data: files }
}
