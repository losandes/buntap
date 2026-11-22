import type { TSettlement } from '../typedefs/settlement.js';
export type TBuntArgs = Readonly<{
    mode: 'passthrough';
    argv: readonly string[];
}> | Readonly<{
    mode: 'paired';
    argv: readonly string[];
    flags: readonly string[];
    filters: readonly string[];
    concurrency: number | undefined;
}>;
export declare const parseBuntArgs: (argv: readonly string[]) => TSettlement<TBuntArgs, string>;
