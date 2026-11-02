/** Mirrors bun's own `[9.00ms]` formatting: always two decimal places. */
export const formatDuration = (durationMs) => {
    if (durationMs === undefined)
        return '0.00ms';
    return `${durationMs.toFixed(2)}ms`;
};
//# sourceMappingURL=format-duration.js.map