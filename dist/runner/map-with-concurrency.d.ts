/** Each lane advances after either settlement, so a rejection never drops work. */
export declare const mapWithConcurrency: (limit: number) => <T, R>(items: readonly T[], fn: (item: T) => Promise<R>) => readonly Promise<R>[];
