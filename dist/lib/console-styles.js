const wrap = (open, close) => (input) => `\u001b[${open}m${input}\u001b[${close}m`;
const passthrough = (input) => input;
/** Colour on or off per `TReporterDeps.color` (§1.4.8); the TAP reporter never calls this with `true`. */
export const createConsoleStyles = (color) => color
    ? {
        green: wrap(32, 39),
        red: wrap(31, 39),
        yellow: wrap(33, 39),
        cyan: wrap(96, 39),
        black: wrap(30, 39),
        bgGreen: wrap(42, 49),
        bgRed: wrap(41, 49),
        bgYellow: wrap(43, 49),
        bgCyan: wrap(46, 49),
        bgMagenta: wrap(45, 49),
        dim: wrap(2, 22),
        ansi256: (code, input) => `\u001b[38;5;${code}m${input}\u001b[0m`,
    }
    : {
        green: passthrough,
        red: passthrough,
        yellow: passthrough,
        cyan: passthrough,
        black: passthrough,
        bgGreen: passthrough,
        bgRed: passthrough,
        bgYellow: passthrough,
        bgCyan: passthrough,
        bgMagenta: passthrough,
        dim: passthrough,
        ansi256: (_code, input) => input,
    };
export const cursorUp = (lines) => lines > 0 ? `\u001b[${lines}A` : '';
export const hideCursor = () => '\u001b[?25l';
export const showCursor = () => '\u001b[?25h';
//# sourceMappingURL=console-styles.js.map