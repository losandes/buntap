/**
 * Maps a raw coverage threshold number to a percentage, matching bun's own
 * dual reading of `coverageThreshold`: `0`–`1` is a fraction, `1`–`100` is
 * already a percentage. Anything outside that range, or not finite, has no
 * defensible reading and resolves to `undefined`.
 */
export const toThresholdPct = (value) => {
    if (!Number.isFinite(value))
        return undefined;
    if (value < 0 || value > 100)
        return undefined;
    if (value <= 1)
        return value * 100;
    return value;
};
//# sourceMappingURL=to-threshold-pct.js.map