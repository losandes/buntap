import { expect, test } from 'bun:test'
import {
  createConsoleStyles,
  cursorUp,
  hideCursor,
  showCursor,
} from './console-styles.js'

test(
  [
    'given color is on',
    'when green wraps text',
    'it should add the ANSI escape codes',
  ].join(', '),
  () => {
    // given
    const styles = createConsoleStyles(true)

    // when
    const actual = styles.green('ok')

    // then
    expect(actual).toBe('\u001b[32mok\u001b[39m')
  },
)

test(
  [
    'given color is off',
    'when green wraps text',
    'it should return it unchanged',
  ].join(', '),
  () => {
    // given
    const styles = createConsoleStyles(false)

    // when
    const actual = styles.green('ok')

    // then
    expect(actual).toBe('ok')
  },
)

test(
  [
    'given color is on',
    'when ansi256 wraps text with a code',
    'it should emit the 256-colour escape',
  ].join(', '),
  () => {
    // given
    const styles = createConsoleStyles(true)

    // when
    const actual = styles.ansi256(42, 'x')

    // then
    expect(actual).toBe('\u001b[38;5;42mx\u001b[0m')
  },
)

test(
  [
    'given color is off',
    'when ansi256 wraps text with a code',
    'it should return it unchanged',
  ].join(', '),
  () => {
    // given
    const styles = createConsoleStyles(false)

    // when
    const actual = styles.ansi256(42, 'x')

    // then
    expect(actual).toBe('x')
  },
)

test(
  [
    'given every other style when color is on',
    'it should wrap with its own codes',
  ].join(', '),
  () => {
    // given
    const styles = createConsoleStyles(true)

    // when, then
    expect(styles.red('x')).toBe('\u001b[31mx\u001b[39m')
    expect(styles.yellow('x')).toBe('\u001b[33mx\u001b[39m')
    expect(styles.cyan('x')).toBe('\u001b[96mx\u001b[39m')
    expect(styles.black('x')).toBe('\u001b[30mx\u001b[39m')
    expect(styles.bgGreen('x')).toBe('\u001b[42mx\u001b[49m')
    expect(styles.bgRed('x')).toBe('\u001b[41mx\u001b[49m')
    expect(styles.bgYellow('x')).toBe('\u001b[43mx\u001b[49m')
    expect(styles.bgCyan('x')).toBe('\u001b[46mx\u001b[49m')
    expect(styles.bgMagenta('x')).toBe('\u001b[45mx\u001b[49m')
    expect(styles.dim('x')).toBe('\u001b[2mx\u001b[22m')
  },
)

test(
  [
    'given every other style when color is off',
    'it should pass text through unchanged',
  ].join(', '),
  () => {
    // given
    const styles = createConsoleStyles(false)

    // when, then
    expect(styles.red('x')).toBe('x')
    expect(styles.yellow('x')).toBe('x')
    expect(styles.cyan('x')).toBe('x')
    expect(styles.black('x')).toBe('x')
    expect(styles.bgGreen('x')).toBe('x')
    expect(styles.bgRed('x')).toBe('x')
    expect(styles.bgYellow('x')).toBe('x')
    expect(styles.bgCyan('x')).toBe('x')
    expect(styles.bgMagenta('x')).toBe('x')
    expect(styles.dim('x')).toBe('x')
  },
)

test(
  [
    'given a positive line count',
    'when cursorUp is called',
    'it should emit the move-up escape',
  ].join(', '),
  () => {
    // given
    const lines = 4

    // when
    const actual = cursorUp(lines)

    // then
    expect(actual).toBe('\u001b[4A')
  },
)

test(
  [
    'given zero lines',
    'when cursorUp is called',
    'it should emit nothing',
  ].join(', '),
  () => {
    // given
    const lines = 0

    // when
    const actual = cursorUp(lines)

    // then
    expect(actual).toBe('')
  },
)

test(
  [
    'given hideCursor is called',
    'it should return the hide escape sequence',
  ].join(', '),
  () => {
    // given
    // when
    const actual = hideCursor()

    // then
    expect(actual).toBe('\u001b[?25l')
  },
)

test(
  [
    'given showCursor is called',
    'it should return the show escape sequence',
  ].join(', '),
  () => {
    // given
    // when
    const actual = showCursor()

    // then
    expect(actual).toBe('\u001b[?25h')
  },
)
