import { expect, test } from 'bun:test'
import { parseBunfigCoverageIgnore } from './parse-bunfig-coverage-ignore.js'

for (const { name, toml, expected } of [
  { name: 'absent key', toml: '', expected: [] },
  {
    name: 'key outside test',
    toml: 'coveragePathIgnorePatterns = "x"\n[other]\ncoveragePathIgnorePatterns = "y"',
    expected: [],
  },
  {
    name: 'commented key',
    toml: '[test]\n# coveragePathIgnorePatterns = "x"',
    expected: [],
  },
  {
    name: 'scalar value',
    toml: '[test]\ncoveragePathIgnorePatterns = "**/x.ts"',
    expected: ['**/x.ts'],
  },
  {
    name: 'unquoted value',
    toml: '[test]\ncoveragePathIgnorePatterns = false',
    expected: [],
  },
  {
    name: 'mixed quotes and hashes',
    toml: `[test]\ncoveragePathIgnorePatterns = ['a#b', "c#d"] # "ignored"`,
    expected: ['a#b', 'c#d'],
  },
  {
    name: 'multiline repository patterns',
    toml: '[test]\ncoverage = true\ncoveragePathIgnorePatterns = [\n "**/bin.ts", # x\n "**/bunt.ts",\n "**/spawn-bun-test.ts",\n]\nother = "ignored"',
    expected: ['**/bin.ts', '**/bunt.ts', '**/spawn-bun-test.ts'],
  },
  {
    name: 'first key wins',
    toml: '[test]\ncoveragePathIgnorePatterns = "x"\ncoveragePathIgnorePatterns = "y"',
    expected: ['x'],
  },
  {
    name: 'section change',
    toml: '[test]\nvalue = 1\n[other]\ncoveragePathIgnorePatterns = "x"',
    expected: [],
  },
  {
    name: 'unterminated array',
    toml: '[test]\ncoveragePathIgnorePatterns = [\n "x"',
    expected: ['x'],
  },
]) {
  test(
    [
      `given ${name}`,
      'when reading coverage-ignore patterns',
      'it should return only the configured test patterns without failing',
    ].join(', '),
    () => {
      // given
      // when
      const actual = parseBunfigCoverageIgnore(toml)
      // then
      expect(actual).toEqual(expected)
    },
  )
}
