/** Replays `buffered` ahead of whatever `iterator` has left to give. */
const toAsyncIterable = (buffered, iterator) => ({
    [Symbol.asyncIterator]: () => {
        const prefix = buffered[Symbol.iterator]();
        return {
            next: () => {
                const fromPrefix = prefix.next();
                return fromPrefix.done !== true
                    ? Promise.resolve(fromPrefix)
                    : iterator.next();
            },
        };
    },
});
const consume = async (iterator, buffered) => {
    const next = await iterator.next();
    if (next.done === true) {
        return { firstLine: undefined, rest: toAsyncIterable(buffered, iterator) };
    }
    if (next.value.trim().length > 0) {
        return {
            firstLine: next.value,
            rest: toAsyncIterable([...buffered, next.value], iterator),
        };
    }
    return consume(iterator, [...buffered, next.value]);
};
/**
 * §1.3.2: finds the first non-empty line without discarding anything \u2014
 * every line read while searching, including the one that answered the
 * search, is replayed in order ahead of the rest of the stream.
 */
export const peekFirstNonEmptyLine = (lines) => consume(lines[Symbol.asyncIterator](), []);
//# sourceMappingURL=peek-first-line.js.map