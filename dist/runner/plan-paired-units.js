import { listFamily, toOwnerSource } from './paired-family.js';
export const planPairedUnits = (deps) => (selected) => [...new Set(selected)].reduce((units, test) => {
    const source = toOwnerSource(deps.fileExists)(test);
    if (source === undefined)
        return [...units, { source, tests: [test] }];
    const existing = units.find((unit) => unit.source === source);
    const tests = [
        ...new Set([
            ...(existing?.tests ?? []),
            ...listFamily(deps)(source),
            test,
        ]),
    ].toSorted();
    return existing === undefined
        ? [...units, { source, tests }]
        : units.map((unit) => (unit === existing ? { source, tests } : unit));
}, []);
//# sourceMappingURL=plan-paired-units.js.map