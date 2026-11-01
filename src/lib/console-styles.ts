export type TConsoleStyles = Readonly<{
  green: (input: string) => string
  red: (input: string) => string
  yellow: (input: string) => string
  cyan: (input: string) => string
  black: (input: string) => string
  bgGreen: (input: string) => string
  bgRed: (input: string) => string
  bgYellow: (input: string) => string
  bgCyan: (input: string) => string
  bgMagenta: (input: string) => string
  ansi256: (code: number, input: string) => string
}>

const wrap =
  (open: number, close: number) =>
  (input: string): string =>
    `\u001b[${open}m${input}\u001b[${close}m`

const passthrough = (input: string): string => input

/** Colour on or off per `TReporterDeps.color` (§1.4.8); the TAP reporter never calls this with `true`. */
export const createConsoleStyles = (color: boolean): TConsoleStyles =>
  color
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
        ansi256: (_code, input) => input,
      }

export const cursorUp = (lines: number): string =>
  lines > 0 ? `\u001b[${lines}A` : ''
export const hideCursor = (): string => '\u001b[?25l'
export const showCursor = (): string => '\u001b[?25h'
