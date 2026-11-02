import type { TTestStatus } from '../typedefs/run-events.js';
export type TClassifiedLine = Readonly<{
    kind: 'blank';
}> | Readonly<{
    kind: 'banner';
    version: string;
    revision: string | undefined;
}> | Readonly<{
    kind: 'file-header';
    path: string;
}> | Readonly<{
    kind: 'result';
    status: TTestStatus;
    name: string;
    durationMs: number | undefined;
}> | Readonly<{
    kind: 'unhandled-error-banner';
}> | Readonly<{
    kind: 'dash-rule';
}> | Readonly<{
    kind: 'coverage-rule';
}> | Readonly<{
    kind: 'summary-count';
    field: 'pass' | 'fail' | 'skip' | 'todo' | 'errors' | 'expectCalls';
    value: number;
}> | Readonly<{
    kind: 'summary-ran';
    tests: number;
    files: number;
    durationMs: number | undefined;
}> | Readonly<{
    kind: 'text';
    raw: string;
}>;
export declare const classifyLine: (line: string) => TClassifiedLine;
