export type TPeeked = Readonly<{
    firstLine: string | undefined;
    rest: AsyncIterable<string>;
}>;
/**
 * §1.3.2: finds the first non-empty line without discarding anything \u2014
 * every line read while searching, including the one that answered the
 * search, is replayed in order ahead of the rest of the stream.
 */
export declare const peekFirstNonEmptyLine: (lines: Readonly<AsyncIterable<string>>) => Promise<TPeeked>;
