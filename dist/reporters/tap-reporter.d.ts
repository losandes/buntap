import type { TReporter } from '../typedefs/reporter.js';
export type TTapState = Readonly<{
    lineCount: number;
    versionEmitted: boolean;
}>;
export declare const tapReporter: TReporter<TTapState>;
