export const initialExitState = {
    sawFailure: false,
    summarySeen: false,
    coverageGateFailed: false,
};
/** Pure fold: one event in, the next exit state out. */
export const nextExitState = (state, event) => {
    if (event.type === 'test' && event.status === 'fail')
        return { ...state, sawFailure: true };
    if (event.type === 'unhandled-error')
        return { ...state, sawFailure: true };
    if (event.type === 'coverage-gate-failed')
        return { ...state, coverageGateFailed: true };
    if (event.type === 'run-end') {
        return {
            sawFailure: state.sawFailure || event.totals.fail > 0 || event.totals.errors > 0,
            summarySeen: event.summarySeen,
            coverageGateFailed: state.coverageGateFailed,
        };
    }
    return state;
};
/** §2.8: 2 when no summary was seen, 1 when any failure or error was reported, 3 when every test passed but the coverage gate did not, 0 otherwise. */
export const resolveExitCode = (state) => {
    if (!state.summarySeen)
        return 2;
    if (state.sawFailure)
        return 1;
    return state.coverageGateFailed ? 3 : 0;
};
//# sourceMappingURL=resolve-exit-code.js.map