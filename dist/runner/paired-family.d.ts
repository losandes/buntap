import type { TPairedRunnerDeps } from './paired-runner.js';
export declare const isTestFileName: (path: string) => boolean;
export declare const isSourceFileName: (path: string) => boolean;
export declare const toOwnerSource: (fileExists: (path: string) => boolean) => (testPath: string) => string | undefined;
export declare const listFamily: (deps: Readonly<Pick<TPairedRunnerDeps, "listDir" | "fileExists">>) => (source: string) => readonly string[];
