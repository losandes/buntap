import { isAbsolute, relative, resolve } from 'node:path';
import { globToRegExp } from '../lib/glob-to-regexp.js';
import { parseBunfigCoverageIgnore } from '../parse/parse-bunfig-coverage-ignore.js';
import { isSourceFileName, listFamily } from './paired-family.js';
export const toCwdRelative = (cwd) => (arg) => relative(cwd, resolve(cwd, arg)).replace(/\\/g, '/');
export const resolvePairedArguments = (deps) => (args) => {
    const patterns = [
        ...args.exempt,
        ...parseBunfigCoverageIgnore(deps.readTextFile(`${deps.cwd}/bunfig.toml`) ?? ''),
    ].map(globToRegExp);
    return args.filters.reduce((state, arg) => {
        const source = toCwdRelative(deps.cwd)(arg);
        if (deps.pathKind(source) !== 'file' || !isSourceFileName(source))
            return {
                ...state,
                discoveryFilters: [...state.discoveryFilters, arg],
            };
        const family = listFamily(deps)(source);
        if (family.length > 0)
            return {
                ...state,
                familyTests: [...new Set([...state.familyTests, ...family])],
            };
        return patterns.some((pattern) => pattern.test(source))
            ? state
            : { ...state, untested: [...state.untested, arg] };
    }, { discoveryFilters: [], familyTests: [], untested: [] });
};
export const findUnmatchedFilters = (cwd) => (filters, discovered) => filters.filter((arg) => {
    const normal = isAbsolute(arg) || arg.startsWith('./') || arg.startsWith('../')
        ? toCwdRelative(cwd)(arg).replace(/\/$/, '')
        : arg;
    return !discovered.some((test) => test.includes(normal));
});
//# sourceMappingURL=resolve-paired-arguments.js.map