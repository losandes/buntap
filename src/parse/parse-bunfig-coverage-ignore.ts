// Preserve hashes within strings while removing TOML comments.
const withoutComment = (line: string): string =>
  line.match(/^(?:"(?:\\.|[^"\\])*"|'[^']*'|[^#"'])*/)?.[0] ?? ''

export const parseBunfigCoverageIgnore = (toml: string): readonly string[] => {
  const lines = toml.split(/\r?\n/).map(withoutComment)
  const found = lines.reduce(
    (state, line, index) => {
      if (state.value !== undefined) return state
      const section = line.trim().match(/^\[([^\]]+)\]$/)?.[1]
      if (section !== undefined) return { ...state, section }
      const value = line.match(
        /^\s*coveragePathIgnorePatterns\s*=\s*(.*)$/,
      )?.[1]
      return state.section === 'test' && value !== undefined
        ? { ...state, value, index }
        : state
    },
    { section: '', value: undefined as string | undefined, index: 0 },
  )
  if (found.value === undefined) return []
  const value =
    found.value.startsWith('[') && !found.value.includes(']')
      ? ([found.value, ...lines.slice(found.index + 1)]
          .join('\n')
          .split(']')[0] ?? '')
      : found.value
  return Array.from(
    value.matchAll(/"((?:\\.|[^"\\])*)"|'([^']*)'/g),
    (match) => match[1] ?? match[2] ?? '',
  )
}
