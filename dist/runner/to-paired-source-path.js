export const toPairedSourcePath = (testPath) => /\.test\.[^./]+$/.test(testPath)
    ? testPath.replace(/\.test(\.[^./]+)$/, '$1')
    : undefined;
//# sourceMappingURL=to-paired-source-path.js.map