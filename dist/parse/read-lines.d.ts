/**
 * Splits an async byte/string stream into lines, tolerating both `\n` and
 * `\r\n`, without buffering the whole stream: each chunk is appended to the
 * carry from the previous chunk and every complete line is yielded as soon
 * as it appears.
 */
export declare const readLines: (input: AsyncIterable<Buffer | string>) => AsyncGenerator<string>;
