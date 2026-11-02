export type TCliDeps = Readonly<{
    input: AsyncIterable<string>;
    write: (chunk: string) => void;
    writeError: (chunk: string) => void;
    columns: number;
    isTty: boolean;
    env: Readonly<Record<string, string | undefined>>;
    cwd: string;
    readTextFile: (path: string) => string | undefined;
}>;
export declare const main: (deps: TCliDeps) => (argv: readonly string[]) => Promise<number>;
