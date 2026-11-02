export type TConsoleStyles = Readonly<{
    green: (input: string) => string;
    red: (input: string) => string;
    yellow: (input: string) => string;
    cyan: (input: string) => string;
    black: (input: string) => string;
    bgGreen: (input: string) => string;
    bgRed: (input: string) => string;
    bgYellow: (input: string) => string;
    bgCyan: (input: string) => string;
    bgMagenta: (input: string) => string;
    dim: (input: string) => string;
    ansi256: (code: number, input: string) => string;
}>;
/** Colour on or off per `TReporterDeps.color` (§1.4.8); the TAP reporter never calls this with `true`. */
export declare const createConsoleStyles: (color: boolean) => TConsoleStyles;
export declare const cursorUp: (lines: number) => string;
export declare const hideCursor: () => string;
export declare const showCursor: () => string;
