import { sql } from 'kysely'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AnyQb, DbRef } from './util'

type KeysetCursor = { primary: string; secondary: string }
type KeysetLabeledResult = {
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
 *    - E.g. packed cursor '1641038400000__bafyx' in parts { primary: '1641038400000', secondary: 'bafyx' }
 *
 * These types relate as such. Implementers define the relations marked with a *:
 *   Result -*-> LabeledResult <-*-> Cursor <--> packed/string cursor
 *                     ↳ SQL Condition
 */
export abstract class GenericKeyset<R, LR extends KeysetLabeledResult> {
  constructor(
    public primary: DbRef,
    public secondary: DbRef,
  ) {}
  abstract labelResult(result: R): LR
  abstract labeledResultToCursor(labeled: LR): KeysetCursor
  abstract cursorToLabeledResult(cursor: KeysetCursor): LR
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
  packCursor(cursor?: KeysetCursor): string | undefined {
    if (!cursor) return
    return `${cursor.primary}__${cursor.secondary}`
  }
  unpackCursor(cursorStr?: string): KeysetCursor | undefined {
    if (!cursorStr) return
    const result = cursorStr.split('__')
    const [primary, secondary, ...others] = result
    if (!primary || !secondary || others.length > 0) {
      throw new InvalidRequestError('Malformed cursor')
    }
    return {
      primary,
      secondary,
    }
  }
  getSql(labeled?: LR, direction?: 'asc' | 'desc', tryIndex?: boolean) {
    if (labeled === undefined) return
    if (tryIndex) {
      // The tryIndex param will likely disappear and become the default implementation: here for now for gradual rollout query-by-query.
      if (direction === 'asc') {
        return sql`((${this.primary}, ${this.secondary}) > (${labeled.primary}, ${labeled.secondary}))`
      } else {
        return sql`((${this.primary}, ${this.secondary}) < (${labeled.primary}, ${labeled.secondary}))`
      }
    } else {
      // @NOTE this implementation can struggle to use an index on (primary, secondary) for pagination due to the "or" usage.
      if (direction === 'asc') {
        return sql`((${this.primary} > ${labeled.primary}) or (${this.primary} = ${labeled.primary} and ${this.secondary} > ${labeled.secondary}))`
      } else {
        return sql`((${this.primary} < ${labeled.primary}) or (${this.primary} = ${labeled.primary} and ${this.secondary} < ${labeled.secondary}))`
      }
    }
  }
  paginate<QB extends AnyQb>(
    qb: QB,
    opts: {
      limit?: number
      cursor?: string
      direction?: 'asc' | 'desc'
      tryIndex?: boolean
      // By default, pg does nullsFirst
      nullsLast?: boolean
    },
  ): QB {
    const { limit, cursor, direction = 'desc', tryIndex, nullsLast } = opts
    const keysetSql = this.getSql(this.unpack(cursor), direction, tryIndex)
    return qb
      .if(!!limit, (q) => q.limit(limit as number))
      .if(!nullsLast, (q) =>
        q.orderBy(this.primary, direction).orderBy(this.secondary, direction),
      )
      .if(!!nullsLast, (q) =>
        q
          .orderBy(
            direction === 'asc'
              ? sql`${this.primary} asc nulls last`
              : sql`${this.primary} desc nulls last`,
          )
          .orderBy(
            direction === 'asc'
              ? sql`${this.secondary} asc nulls last`
              : sql`${this.secondary} desc nulls last`,
          ),
      )
      .if(!!keysetSql, (qb) => (keysetSql ? qb.where(keysetSql) : qb)) as QB
  }
}

type SortAtCidResult = { sortAt: string; cid: string }
type TimeCidLabeledResult = KeysetCursor

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
  cursorToLabeledResult(cursor: KeysetCursor) {
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

export class CreatedAtDidKeyset extends TimeCidKeyset<{
  createdAt: string
  did: string // dids are treated identically to cids in TimeCidKeyset
}> {
  labelResult(result: { createdAt: string; did: string }) {
    return { primary: result.createdAt, secondary: result.did }
  }
}

export class IndexedAtDidKeyset extends TimeCidKeyset<{
  indexedAt: string
  did: string // dids are treated identically to cids in TimeCidKeyset
}> {
  labelResult(result: { indexedAt: string; did: string }) {
    return { primary: result.indexedAt, secondary: result.did }
  }
}

/**
 * This is being deprecated. Use {@link GenericKeyset#paginate} instead.
 */
export const paginate = <
  QB extends AnyQb,
  K extends GenericKeyset<unknown, any>,
>(
  qb: QB,
  opts: {
    limit?: number
    cursor?: string
    direction?: 'asc' | 'desc'
    keyset: K
    tryIndex?: boolean
    // By default, pg does nullsFirst
    nullsLast?: boolean
  },
): QB => {
  return opts.keyset.paginate(qb, opts)
}

type SingleKeyCursor = {
  primary: string
}

type SingleKeyLabeledResult = {
  primary: string | number
}

/**
 * GenericSingleKey is similar to {@link GenericKeyset} but for a single key cursor.
 */
export abstract class GenericSingleKey<R, LR extends SingleKeyLabeledResult> {
  constructor(public primary: DbRef) {}
  abstract labelResult(result: R): LR
  abstract labeledResultToCursor(labeled: LR): SingleKeyCursor
  abstract cursorToLabeledResult(cursor: SingleKeyCursor): LR
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
  packCursor(cursor?: SingleKeyCursor): string | undefined {
    if (!cursor) return
    return cursor.primary
  }
  unpackCursor(cursorStr?: string): SingleKeyCursor | undefined {
    if (!cursorStr) return
    const result = cursorStr.split('__')
    const [primary, ...others] = result
    if (!primary || others.length > 0) {
      throw new InvalidRequestError('Malformed cursor')
    }
    return {
      primary,
    }
  }
  getSql(labeled?: LR, direction?: 'asc' | 'desc') {
    if (labeled === undefined) return
    if (direction === 'asc') {
      return sql`${this.primary} > ${labeled.primary}`
    }
    return sql`${this.primary} < ${labeled.primary}`
  }
  paginate<QB extends AnyQb>(
    qb: QB,
    opts: {
      limit?: number
      cursor?: string
      direction?: 'asc' | 'desc'
      // By default, pg does nullsFirst
      nullsLast?: boolean
    },
  ): QB {
    const { limit, cursor, direction = 'desc', nullsLast } = opts
    const keySql = this.getSql(this.unpack(cursor), direction)
    return qb
      .if(!!limit, (q) => q.limit(limit as number))
      .if(!nullsLast, (q) => q.orderBy(this.primary, direction))
      .if(!!nullsLast, (q) =>
        q.orderBy(
          direction === 'asc'
            ? sql`${this.primary} asc nulls last`
            : sql`${this.primary} desc nulls last`,
        ),
      )
      .if(!!keySql, (qb) => (keySql ? qb.where(keySql) : qb)) as QB
  }
}

type SortAtResult = { sortAt: string }
type TimeLabeledResult = SingleKeyCursor

export class IsoTimeKey<TimeResult = SortAtResult> extends GenericSingleKey<
  TimeResult,
  TimeLabeledResult
> {
  labelResult(result: TimeResult): TimeLabeledResult
  labelResult<TimeResult extends SortAtResult>(result: TimeResult) {
    return { primary: result.sortAt }
  }
  labeledResultToCursor(labeled: TimeLabeledResult) {
    return {
      primary: new Date(labeled.primary).toISOString(),
    }
  }
  cursorToLabeledResult(cursor: SingleKeyCursor) {
    const primaryDate = new Date(cursor.primary)
    if (isNaN(primaryDate.getTime())) {
      throw new InvalidRequestError('Malformed cursor')
    }
    return {
      primary: primaryDate.toISOString(),
    }
  }
}

export class IsoSortAtKey extends IsoTimeKey<{
  sortAt: string
}> {
  labelResult(result: { sortAt: string }) {
    return { primary: result.sortAt }
  }
}
