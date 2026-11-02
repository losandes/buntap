import type { TRunEvent } from './run-events.js';
export type TReporterDeps = Readonly<{
    columns: number;
    isTty: boolean;
    color: boolean;
}>;
export type TReporter<TState> = Readonly<{
    initial: TState;
    next: (state: TState, event: TRunEvent) => Readonly<{
        state: TState;
        output: string;
    }>;
    end: (state: TState) => string;
}>;
export type TReporterInstance = Readonly<{
    next: (event: TRunEvent) => string;
    end: () => string;
}>;
