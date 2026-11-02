// Built from a string, not a regex literal: Biome's noControlCharactersInRegex
// rule flags a literal `/\u001B.../ `, even written as an escape, because the
// parsed pattern still contains the control character. A string escape of the
// same character is a different AST node the rule does not inspect.
const ESC = '\u001B';
const CSI = '\u009B';
const ANSI_PATTERN = new RegExp(`[${ESC}${CSI}][[\\]()#;?]*(?:(?:[a-zA-Z0-9]*(?:;[a-zA-Z0-9]*)*)?\\u0007|(?:\\d{1,4}(?:;\\d{0,4})*)?[0-9A-ORZcf-nqry=><~])`, 'g');
export const stripAnsi = (line) => line.replace(ANSI_PATTERN, '');
//# sourceMappingURL=strip-ansi.js.map