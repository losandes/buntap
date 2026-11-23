import type { TPairedRunnerDeps } from './paired-runner.js';
export type TPairedResolution = Readonly<{
    discoveryFilters: readonly string[];
    familyTests: readonly string[];
    untested: readonly string[];
}>;
export declare const toCwdRelative: (cwd: string) => (arg: string) => string;
export declare const resolvePairedArguments: (deps: Readonly<Pick<TPairedRunnerDeps, "cwd" | "pathKind" | "listDir" | "fileExists" | "readTextFile">>) => (args: Readonly<{
    filters: readonly string[];
    exempt: readonly string[];
}>) => TPairedResolution;
export declare const findUnmatchedFilters: (cwd: string) => (filters: readonly string[], discovered: readonly string[]) => readonly string[];
