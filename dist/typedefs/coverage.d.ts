export type TCoverageThresholdPct = Readonly<{
    functionsPct: number;
    linesPct: number;
}>;
export type TCoverageRow = Readonly<{
    file: string;
    functionsPct: number;
    linesPct: number;
    uncovered: readonly string[];
}>;
export type TCoverageTotals = Readonly<{
    functionsPct: number;
    linesPct: number;
    files: number;
}>;
