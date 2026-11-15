/**
 * Verbatim captures of `bun test 2>&1` from bun 1.3.14, taken against
 * throwaway test files in a scratch directory outside this repository (since
 * deleted). Every regex in `classify-line.ts` is derived from these shapes.
 */

export const mixedResultsFixture = `bun test v1.3.14 (0d9b296a)

src/b.test.ts:
(pass) top level [0.04ms]
1 | import { expect, test } from "bun:test";
2 | test("top level", () => { expect("a").toBe("a"); });
3 | test("throws", () => { throw new Error("boom\\nsecond line"); });
                                                              ^
error: boom
second line
      at <anonymous> (/private/tmp/buntap-fixtures-85186/src/b.test.ts:3:59)
(fail) throws [0.12ms]

src/a.test.ts:
(pass) math > adds [0.01ms]
1 | import { expect, test, describe } from "bun:test";
2 | describe("math", () => {
3 |   test("adds", () => { expect(1 + 1).toBe(2); });
4 |   test("fails", () => { expect(1 + 1).toBe(3); });
                                          ^
error: expect(received).toBe(expected)

Expected: 3
Received: 2

      at <anonymous> (/private/tmp/buntap-fixtures-85186/src/a.test.ts:4:39)
(fail) math > fails [0.08ms]
(skip) math > skipped
(todo) math > todo thing

 2 pass
 1 skip
 1 todo
 2 fail
 3 expect() calls
Ran 6 tests across 2 files. [14.00ms]
`

export const coverageFixture = `bun test v1.3.14 (0d9b296a)

src/add.test.ts:
(pass) adds [0.06ms]
------------|---------|---------|-------------------
File        | % Funcs | % Lines | Uncovered Line #s
------------|---------|---------|-------------------
All files   |  100.00 |  100.00 |
 src/add.ts |  100.00 |  100.00 | 
------------|---------|---------|-------------------

 1 pass
 0 fail
 1 expect() calls
Ran 1 test across 1 file. [9.00ms]
`

export const lowCoverageFixture = `bun test v1.3.14 (0d9b296a)

src/add.test.ts:
(pass) adds [0.06ms]

src/full.test.ts:
(pass) a1 [0.03ms]
-------------|---------|---------|-------------------
File         | % Funcs | % Lines | Uncovered Line #s
-------------|---------|---------|-------------------
All files    |   62.50 |  100.00 |
 src/add.ts  |   25.00 |  100.00 | 
 src/full.ts |  100.00 |  100.00 | 
-------------|---------|---------|-------------------

 2 pass
 0 fail
 2 expect() calls
Ran 2 tests across 2 files. [78.00ms]
`

export const unhandledErrorFixture = `bun test v1.3.14 (0d9b296a)

src/e.test.ts:

# Unhandled error between tests
-------------------------------
error: Cannot find module './nope.ts' from '/private/tmp/buntap-fixtures-85186/src/e.test.ts'
-------------------------------


 0 pass
 1 fail
 1 error
Ran 1 test across 1 file. [12.00ms]
`

/**
 * Captured from `bun test 2>&1` against a scratch suite of 122 files (since
 * deleted) on bun 1.4.4: one file holds a `test.skip`, another a `test.todo`.
 * Both print inline under their own file header *and* bun reprints them a
 * second time, unattributed to any file header, in a trailing "N tests
 * skipped:" / "N tests todo:" roll-up immediately before the final counts.
 */
export const skipTodoRollupFixture = `bun test v1.4.4 (38afee6c8)

src/a.test.ts:
(pass) pass a [0.01ms]

src/zz_skip.test.ts:
(skip) skip me

src/zz_todo.test.ts:
(todo) someday

src/b.test.ts:
(pass) pass b

1 tests skipped:
(skip) skip me


1 tests todo:
(todo) someday

 2 pass
 1 skip
 1 todo
 0 fail
 2 expect() calls
Ran 4 tests across 4 files. [11.00ms]
`

/**
 * Captured from `bun test 2>&1` on bun 1.4.4 against a scratch suite large
 * enough to trigger bun's trailing roll-up (observed at 63 and 122 files,
 * not at 3), trimmed to three files. The failing test prints inline under
 * its own file header *and* a second time under "1 tests failed:", with no
 * file header of its own.
 */
export const failRollupFixture = `bun test v1.4.4 (38afee6c8)

src/b.test.ts:
1 | import { test, expect } from "bun:test"
2 | test("boom", () => { expect(1).toBe(2) })
                                   ^
error: expect(received).toBe(expected)

Expected: 2
Received: 1

      at <anonymous> (/private/tmp/buntap-small/src/b.test.ts:2:32)
(fail) boom [0.21ms]

src/c.test.ts:
(skip) skip me

src/a.test.ts:
(pass) ok

1 tests skipped:
(skip) skip me


1 tests failed:
(fail) boom [0.21ms]

 1 pass
 1 skip
 1 fail
 2 expect() calls
Ran 3 tests across 3 files. [5.00ms]
`

export const consoleLogBeforePassFixture = `bun test v1.3.14 (0d9b296a)

src/log.test.ts:
hello from test
(pass) with log [0.06ms]

 1 pass
 0 fail
 1 expect() calls
Ran 1 test across 1 file. [7.00ms]
`
