import { posix } from 'node:path';
export const isTestFileName = (path) => /[._](?:test|spec)\.(?:ts|tsx|js|jsx|mts|cts|mjs|cjs)$/.test(path);
export const isSourceFileName = (path) => /\.(?:ts|tsx|js|jsx|mts|cts|mjs|cjs)$/.test(path) && !isTestFileName(path);
export const toOwnerSource = (fileExists) => (testPath) => {
    const match = testPath.match(/^(.*)\.test\.(\w+)$/);
    if (match === null)
        return undefined;
    const exact = `${match[1]}.${match[2]}`;
    if (fileExists(exact))
        return exact;
    const stem = posix.basename(match[1] ?? '');
    const base = stem.match(/^(.+)\.[^.]+$/)?.[1];
    if (base === undefined)
        return undefined;
    const source = posix.join(posix.dirname(testPath), `${base}.${match[2]}`);
    return !isTestFileName(source) && fileExists(source) ? source : undefined;
};
export const listFamily = (deps) => (source) => {
    const dir = posix.dirname(source);
    const ext = posix.extname(source);
    const name = posix.basename(source, ext);
    return deps
        .listDir(dir)
        .filter((entry) => {
        const tail = entry.slice(name.length);
        return (entry.startsWith(name) &&
            (tail === `.test${ext}` || /^\.[^.]+\.test\.[^.]+$/.test(tail)) &&
            entry.endsWith(ext));
    })
        .map((entry) => posix.join(dir, entry))
        .filter((test) => toOwnerSource(deps.fileExists)(test) === source)
        .toSorted();
};
//# sourceMappingURL=paired-family.js.map