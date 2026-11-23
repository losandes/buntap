import type { TBuntRunnerDeps, TChildHandle } from './bunt-runner.js';
import type { TBuntArgs } from './parse-bunt-args.js';
import type { TSpawnOptions } from './spawn-bun-test.js';
export type TPairedRunnerDeps = TBuntRunnerDeps & Readonly<{
    spawn: (argv: readonly string[], options?: TSpawnOptions) => TChildHandle;
    writeError: (chunk: string) => void;
    fileExists: (path: string) => boolean;
    cwd: string;
    pathKind: (path: string) => 'file' | 'directory' | undefined;
    listDir: (dir: string) => readonly string[];
    readTextFile: (path: string) => string | undefined;
    now: () => number;
    defaultConcurrency: number;
}>;
export declare const runPaired: (deps: TPairedRunnerDeps) => (args: Readonly<Extract<TBuntArgs, {
    mode: "paired";
}>>) => Promise<number>;
