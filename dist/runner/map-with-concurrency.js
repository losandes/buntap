/** Each lane advances after either settlement, so a rejection never drops work. */
export const mapWithConcurrency = (limit) => (items, fn) => {
    // Local scheduler state: callers only receive the per-item promises.
    let lanes = Array.from({ length: Math.min(items.length, Math.max(1, limit)) }, () => Promise.resolve());
    return items.map((item, index) => {
        const lane = index % lanes.length;
        const result = (lanes[lane] ?? Promise.resolve()).then(() => fn(item));
        lanes = lanes.with(lane, result.then(() => undefined, () => undefined));
        return result;
    });
};
//# sourceMappingURL=map-with-concurrency.js.map