import { sql, DynamicModule } from 'kysely'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AnyQb, DbRef } from './types'

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
  constructor(
    public primary: DbRef,
    public secondary: DbRef,
  ) {}
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
}

type StatusKeysetParam = {
  lastReviewedAt: string | null
  lastReportedAt: string | null
  id: number
}

export class StatusKeyset extends GenericKeyset<StatusKeysetParam, Cursor> {
  labelResult(result: StatusKeysetParam): Cursor
  labelResult(result: StatusKeysetParam) {
    const primaryField = (
      this.primary as ReturnType<DynamicModule['ref']>
    ).dynamicReference.includes('lastReviewedAt')
      ? 'lastReviewedAt'
      : 'lastReportedAt'

    return {
      primary: result[primaryField]
        ? new Date(`${result[primaryField]}`).getTime().toString()
        : '',
      secondary: result.id.toString(),
    }
  }
  labeledResultToCursor(labeled: Cursor) {
    return {
      primary: labeled.primary,
      secondary: labeled.secondary,
    }
  }
  cursorToLabeledResult(cursor: Cursor) {
    return {
      primary: cursor.primary
        ? new Date(parseInt(cursor.primary, 10)).toISOString()
        : '',
      secondary: cursor.secondary,
    }
  }
  unpackCursor(cursorStr?: string): Cursor | undefined {
    if (!cursorStr) return
    const result = cursorStr.split('::')
    const [primary, secondary, ...others] = result
    if (!secondary || others.length > 0) {
      throw new InvalidRequestError('Malformed cursor')
    }
    return {
      primary,
      secondary,
    }
  }
  // This is specifically built to handle nullable columns as primary sorting column
  getSql(labeled?: Cursor, direction?: 'asc' | 'desc') {
    if (labeled === undefined) return
    if (direction === 'asc') {
      return !labeled.primary
        ? sql`(${this.primary} IS NULL AND ${this.secondary} > ${labeled.secondary})`
        : sql`((${this.primary}, ${this.secondary}) > (${labeled.primary}, ${labeled.secondary}) OR (${this.primary} is null))`
    } else {
      return !labeled.primary
        ? sql`(${this.primary} IS NULL AND ${this.secondary} < ${labeled.secondary})`
        : sql`((${this.primary}, ${this.secondary}) < (${labeled.primary}, ${labeled.secondary}) OR (${this.primary} is null))`
    }
  }
}

type TimeIdKeysetParam = {
  id: number
  createdAt: string | Date
}
type TimeIdResult = TimeIdKeysetParam

export class TimeIdKeyset extends GenericKeyset<TimeIdKeysetParam, Cursor> {
  labelResult(result: TimeIdResult): Cursor
  labelResult(result: TimeIdResult) {
    return { primary: result.createdAt, secondary: result.id.toString() }
  }
  labeledResultToCursor(labeled: Cursor) {
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
  const {
    limit,
    cursor,
    keyset,
    direction = 'desc',
    tryIndex,
    nullsLast,
  } = opts
  const keysetSql = keyset.getSql(keyset.unpack(cursor), direction, tryIndex)
  return qb
    .if(!!limit, (q) => q.limit(limit as number))
    .if(!nullsLast, (q) =>
      q.orderBy(keyset.primary, direction).orderBy(keyset.secondary, direction),
    )
    .if(!!nullsLast, (q) =>
      q
        .orderBy(
          direction === 'asc'
            ? sql`${keyset.primary} asc nulls last`
            : sql`${keyset.primary} desc nulls last`,
        )
        .orderBy(
          direction === 'asc'
            ? sql`${keyset.secondary} asc nulls last`
            : sql`${keyset.secondary} desc nulls last`,
        ),
    )
    .if(!!keysetSql, (qb) => (keysetSql ? qb.where(keysetSql) : qb)) as QB
}
