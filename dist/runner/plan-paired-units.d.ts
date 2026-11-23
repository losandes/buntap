import type { TPairedRunnerDeps } from './paired-runner.js';
export type TPairedUnit = Readonly<{
    source: string | undefined;
    tests: readonly string[];
}>;
export declare const planPairedUnits: (deps: Readonly<Pick<TPairedRunnerDeps, "listDir" | "fileExists">>) => (selected: readonly string[]) => readonly TPairedUnit[];
