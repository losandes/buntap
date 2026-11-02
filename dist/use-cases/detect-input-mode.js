import { decodeProtocolLine } from '../protocol/decode-protocol-line.js';
/**
 * §1.3.1: a line that decodes as a recognised protocol event selects
 * protocol mode; anything else — raw bun text, malformed JSON, an
 * unrecognised version — selects the existing text mode. Pure: takes the
 * first non-empty line already found, decides nothing about consuming it.
 */
export const detectInputMode = (firstNonEmptyLine) => decodeProtocolLine(firstNonEmptyLine).status === 'ok' ? 'protocol' : 'text';
//# sourceMappingURL=detect-input-mode.js.map