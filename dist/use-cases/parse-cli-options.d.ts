import type { TCliOptions } from '../typedefs/cli-options.js';
import type { TSettlement } from '../typedefs/settlement.js';
/** Pure argv parser: never throws, returns a settlement so the driver decides what to do with a usage error. */
export declare const parseCliOptions: (argv: readonly string[]) => TSettlement<TCliOptions, string>;
