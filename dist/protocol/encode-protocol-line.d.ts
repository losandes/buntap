import type { TRunEvent } from '../typedefs/run-events.js';
/** §1.2.3: emitted once, before the child produces any output. */
export declare const encodeRunnerStart: (argv: readonly string[]) => string;
/** §1.2.4: emitted once, after everything else. */
export declare const encodeRunnerExit: (code: number | null, signal: string | null) => string;
/** §1.2.5: an existing parser event, unchanged, with `v` added. */
export declare const encodeRunEvent: (event: TRunEvent) => string;
