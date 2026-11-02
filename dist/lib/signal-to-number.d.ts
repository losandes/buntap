/**
 * §2.2: "128 + signal number" needs the POSIX number a signal name maps to.
 * `node:os`'s `constants.signals` is a plain data table, not an I/O call —
 * referencing it here keeps this lookup pure and platform-correct rather
 * than hand-maintaining a second copy of the table.
 */
export declare const signalToNumber: (signal: string) => number | undefined;
