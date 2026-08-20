import { sql } from 'kysely'
import { describe, expect, it } from 'vitest'
import { GenericKeyset, GenericSingleKey } from './pagination.js'

type Row = { primary: string; secondary: string }

class TestKeyset extends GenericKeyset<Row, Row> {
  labelResult(result: Row) {
    return result
  }
  labeledResultToCursor(labeled: Row) {
    return labeled
  }
  cursorToLabeledResult(cursor: Row) {
    return cursor
  }
}

class TestSingleKey extends GenericSingleKey<
  { primary: string },
  { primary: string }
> {
  labelResult(result: { primary: string }) {
    return result
  }
  labeledResultToCursor(labeled: { primary: string }) {
    return labeled
  }
  cursorToLabeledResult(cursor: { primary: string }) {
    return cursor
  }
}

const cases: [
  string,
  (length: number) => { items: unknown[]; cursor?: string },
][] = [
  [
    'keyset',
    (length) =>
      new TestKeyset(sql.ref('primary'), sql.ref('secondary')).page(
        makeKeysetRows(length),
        3,
      ),
  ],
  [
    'single key',
    (length) =>
      new TestSingleKey(sql.ref('primary')).page(makeSingleKeyRows(length), 3),
  ],
]

describe.each(cases)('%s page', (_, pageRows) => {
  it.each([
    ['empty', 0, undefined],
    ['short terminal', 2, undefined],
    ['exact-limit terminal', 3, undefined],
    ['nonterminal', 4, '2'],
  ] as const)('%s page', (_, rowCount, expectedCursorPart) => {
    const page = pageRows(rowCount)

    expect(page.items).toHaveLength(Math.min(rowCount, 3))
    if (expectedCursorPart === undefined) {
      expect(page.cursor).toBeUndefined()
    } else {
      expect(page.cursor).toContain(expectedCursorPart)
    }
  })
})

function makeKeysetRows(length: number): Row[] {
  return Array.from({ length }, (_, i) => ({
    primary: `${i}`,
    secondary: `${i}`,
  }))
}

function makeSingleKeyRows(length: number): { primary: string }[] {
  return Array.from({ length }, (_, i) => ({ primary: `${i}` }))
}
