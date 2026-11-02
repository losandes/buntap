import { parseRun } from '../parse/parse-run.js';
import { readLines } from '../parse/read-lines.js';
import { encodeRunEvent, encodeRunnerExit, encodeRunnerStart, } from '../protocol/encode-protocol-line.js';
import { mergeAsyncIterables } from './merge-async-iterables.js';
/**
 * §1.1: runs `bun test`, emitting the protocol on `deps.write` and nothing
 * else. Reuses `parseRun` — the same parser `buntap` runs over raw text —
 * over the merged child output, so no line bun produces is interpreted
 * twice by two different classifiers (§1.1.5).
 */
export const runBunt = (deps) => async (argv) => {
    deps.write(encodeRunnerStart(argv));
    const child = deps.spawn(argv);
    const unregister = deps.onSignal((signal) => child.kill(signal));
    const merged = mergeAsyncIterables([child.stdout, child.stderr]);
    for await (const event of parseRun(readLines(merged))) {
        deps.write(encodeRunEvent(event));
    }
    const result = await child.exited;
    unregister();
    deps.write(encodeRunnerExit(result.code, result.signal));
    return result.code ?? 1;
};
//# sourceMappingURL=bunt-runner.js.map