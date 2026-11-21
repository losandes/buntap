export const toPairedSourcePath = (testPath: string): string | undefined =>
  /\.test\.[^./]+$/.test(testPath)
    ? testPath.replace(/\.test(\.[^./]+)$/, '$1')
    : undefined
