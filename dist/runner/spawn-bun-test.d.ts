import type { TChildHandle } from './bunt-runner.js';
/**
 * The one true edge of `bunt`: a real OS process. §1.1.1: every argument is
 * appended verbatim and in order; §1.1.2: none of them are inspected here.
 * Untestable the way `bin.ts` is untestable — proven at integration time by
 * stage 7, not by a unit test with a fake process.
 */
export declare const spawnBunTest: (argv: readonly string[]) => TChildHandle;
