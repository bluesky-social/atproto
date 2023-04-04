import { SelectQueryBuilder, sql } from 'kysely'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { DbRef } from './util'

export type Cursor = { primary: string; secondary: string }
export type LabeledResult = {
  primary: string | number
  secondary: string | number
}

/**
 * The GenericKeyset is an abstract class that sets-up the interface and partial implementation
 * of a keyset-paginated cursor with two parts. There are three types involved:
 *  - Result: a raw result (i.e. a row from the db) containing data that will make-up a cursor.
 *    - E.g. { createdAt: '2022-01-01T12:00:00Z', cid: 'bafyx' }
 *  - LabeledResult: a Result processed such that the "primary" and "secondary" parts of the cursor are labeled.
 *    - E.g. { primary: '2022-01-01T12:00:00Z', secondary: 'bafyx' }
 *  - Cursor: the two string parts that make-up the packed/string cursor.
 *    - E.g. packed cursor '1641038400000::bafyx' in parts { primary: '1641038400000', secondary: 'bafyx' }
 *
 * These types relate as such. Implementers define the relations marked with a *:
 *   Result -*-> LabeledResult <-*-> Cursor <--> packed/string cursor
 *                     ↳ SQL Condition
 */
export abstract class GenericKeyset<R, LR extends LabeledResult> {
  constructor(public primary: DbRef, public secondary: DbRef) {}
  abstract labelResult(result: R): LR
  abstract labeledResultToCursor(labeled: LR): Cursor
  abstract cursorToLabeledResult(cursor: Cursor): LR
  packFromResult(results: R | R[]): string | undefined {
    const result = Array.isArray(results) ? results.at(-1) : results
    if (!result) return
    return this.pack(this.labelResult(result))
  }
  pack(labeled?: LR): string | undefined {
    if (!labeled) return
    const cursor = this.labeledResultToCursor(labeled)
    return this.packCursor(cursor)
  }
  unpack(cursorStr?: string): LR | undefined {
    const cursor = this.unpackCursor(cursorStr)
    if (!cursor) return
    return this.cursorToLabeledResult(cursor)
  }
  packCursor(cursor?: Cursor): string | undefined {
    if (!cursor) return
    return `${cursor.primary}::${cursor.secondary}`
  }
  unpackCursor(cursorStr?: string): Cursor | undefined {
    if (!cursorStr) return
    const result = cursorStr.split('::')
    const [primary, secondary, ...others] = result
    if (!primary || !secondary || others.length > 0) {
      throw new InvalidRequestError('Malformed cursor')
    }
    return {
      primary,
      secondary,
    }
  }
  getSql(labeled?: LR, direction?: 'asc' | 'desc') {
    if (labeled === undefined) return
    if (direction === 'asc') {
      return sql`((${this.primary} > ${labeled.primary}) or (${this.primary} = ${labeled.primary} and ${this.secondary} > ${labeled.secondary}))`
    }
    return sql`((${this.primary} < ${labeled.primary}) or (${this.primary} = ${labeled.primary} and ${this.secondary} < ${labeled.secondary}))`
  }
}

type SortAtCidResult = { sortAt: string; cid: string }
type TimeCidLabeledResult = Cursor

export class TimeCidKeyset<
  TimeCidResult = SortAtCidResult,
> extends GenericKeyset<TimeCidResult, TimeCidLabeledResult> {
  labelResult(result: TimeCidResult): TimeCidLabeledResult
  labelResult<TimeCidResult extends SortAtCidResult>(result: TimeCidResult) {
    return { primary: result.sortAt, secondary: result.cid }
  }
  labeledResultToCursor(labeled: TimeCidLabeledResult) {
    return {
      primary: new Date(labeled.primary).getTime().toString(),
      secondary: labeled.secondary,
    }
  }
  cursorToLabeledResult(cursor: Cursor) {
    const primaryDate = new Date(parseInt(cursor.primary, 10))
    if (isNaN(primaryDate.getTime())) {
      throw new InvalidRequestError('Malformed cursor')
    }
    return {
      primary: primaryDate.toISOString(),
      secondary: cursor.secondary,
    }
  }
}

export const paginate = <
  QB extends SelectQueryBuilder<any, any, any>,
  K extends GenericKeyset<unknown, any>,
>(
  qb: QB,
  opts: {
    limit?: number
    cursor?: string
    direction?: 'asc' | 'desc'
    keyset: K
  },
): QB => {
  const { limit, cursor, keyset, direction = 'desc' } = opts
  const keysetSql = keyset.getSql(keyset.unpack(cursor), direction)
  return qb
    .if(!!limit, (q) => q.limit(limit as number))
    .orderBy(keyset.primary, direction)
    .orderBy(keyset.secondary, direction)
    .if(!!keysetSql, (qb) => (keysetSql ? qb.where(keysetSql) : qb)) as QB
}
