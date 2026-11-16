import type { TCliOptions } from '../typedefs/cli-options.js';
import type { TSettlement } from '../typedefs/settlement.js';
export type TCliEnv = Readonly<Record<string, string | undefined>>;
/** Pure argv and environment parser: never throws, returns a settlement so the driver decides what to do with a usage error. A reporter flag supersedes `BUNTAP_REPORTER`. */
export declare const parseCliOptions: (env: TCliEnv) => (argv: readonly string[]) => TSettlement<TCliOptions, string>;
