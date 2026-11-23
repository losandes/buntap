export const formatPairedUnresolved = (untested, unmatched) => {
    const blocks = [
        ...(untested.length === 0
            ? []
            : [
                `buntap: ${untested.length} ${untested.length === 1 ? 'source has' : 'sources have'} no tests:`,
                ...untested.map((path) => `  ${path}`),
            ]),
        ...(unmatched.length === 0
            ? []
            : [
                `buntap: ${unmatched.length} argument${unmatched.length === 1 ? '' : 's'} matched no tests:`,
                ...unmatched.map((path) => `  ${path}`),
            ]),
    ];
    return blocks.length === 0 ? '' : `\n${blocks.join('\n')}\n`;
};
//# sourceMappingURL=format-paired-unresolved.js.map