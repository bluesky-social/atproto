import { sql } from 'kysely'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AnyQb, DbRef } from './util'

type KeysetCursor = { primary: string; secondary: string }
type KeysetLabeledResult = {
  primary: string | number
  secondary: string | number
}

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
    return { primary, secondary }
  }
  getSql(labeled?: LR, direction?: 'asc' | 'desc', tryIndex?: boolean) {
    if (labeled === undefined) return
    if (tryIndex) {
      if (direction === 'asc') {
        return sql`((${this.primary}, ${this.secondary}) > (${labeled.primary}, ${labeled.secondary}))`
      }
      return sql`((${this.primary}, ${this.secondary}) < (${labeled.primary}, ${labeled.secondary}))`
    }
    if (direction === 'asc') {
      return sql`((${this.primary} > ${labeled.primary}) or (${this.primary} = ${labeled.primary} and ${this.secondary} > ${labeled.secondary}))`
    }
    return sql`((${this.primary} < ${labeled.primary}) or (${this.primary} = ${labeled.primary} and ${this.secondary} < ${labeled.secondary}))`
  }
  paginate<QB extends AnyQb>(
    qb: QB,
    opts: {
      limit?: number
      cursor?: string
      direction?: 'asc' | 'desc'
      tryIndex?: boolean
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

type CreatedAtCidResult = { createdAt: string; cid: string }
type TimeCidLabeledResult = KeysetCursor

export class CreatedAtCidKeyset extends GenericKeyset<
  CreatedAtCidResult,
  TimeCidLabeledResult
> {
  labelResult(result: CreatedAtCidResult) {
    return { primary: result.createdAt, secondary: result.cid }
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

export const paginate = <
  QB extends AnyQb,
  K extends GenericKeyset<unknown, KeysetLabeledResult>,
>(
  qb: QB,
  opts: {
    limit?: number
    cursor?: string
    direction?: 'asc' | 'desc'
    keyset: K
    tryIndex?: boolean
    nullsLast?: boolean
  },
): QB => {
  return opts.keyset.paginate(qb, opts)
}

const sortPosts = <T extends { createdAt: string; cid: string }>(
  a: T,
  b: T,
) => {
  if (a.createdAt > b.createdAt) return -1
  if (a.createdAt < b.createdAt) return 1
  return a.cid > b.cid ? -1 : 1
}

export const mergePaginatedPosts = <
  T extends { createdAt: string; cid: string },
>(
  followRes: T[],
  selfRes: T[],
  limit: number,
) => {
  return [...followRes, ...selfRes].sort(sortPosts).slice(0, limit)
}
