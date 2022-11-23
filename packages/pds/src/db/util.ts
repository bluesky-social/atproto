import {
  DummyDriver,
  DynamicModule,
  RawBuilder,
  SelectQueryBuilder,
  sql,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
} from 'kysely'
import { safeParse } from '@hapi/bourne'
import { InvalidRequestError } from '@atproto/xrpc-server'

export const actorWhereClause = (actor: string) => {
  if (actor.startsWith('did:')) {
    return sql<0 | 1>`"did_handle"."did" = ${actor}`
  } else {
    return sql<0 | 1>`"did_handle"."handle" = ${actor}`
  }
}

export const countAll = sql<number>`count(*)`

export const paginate = <QB extends SelectQueryBuilder<any, any, any>, T>(
  qb: QB,
  opts:
    | {
        limit?: number
        before?: string
        by: DbRef
      }
    | {
        limit?: number
        before?: string
        keyset: Keyset<T>
      },
) => {
  if ('by' in opts) {
    return qb
      .if(opts.limit !== undefined, (q) => q.limit(opts.limit as number))
      .orderBy(opts.by, 'desc')
      .if(opts.before !== undefined, (q) => q.where(opts.by, '<', opts.before))
  }
  const cursor = opts.keyset.unpack(opts.before)
  const keysetCondition = getKeysetCondition(cursor, opts.keyset)
  return qb
    .if(opts.limit !== undefined, (q) => q.limit(opts.limit as number))
    .orderBy(opts.keyset.primary, 'desc')
    .orderBy(opts.keyset.secondary, 'desc')
    .if(keysetCondition !== undefined, (qb) =>
      keysetCondition ? qb.where(keysetCondition) : qb,
    )
}

type DefaultRow = { createdAt: string; uri: string }
export class Keyset<T = DefaultRow> {
  constructor(public primary: DbRef, public secondary: DbRef) {}
  cursorFromResult(result: T): Cursor
  cursorFromResult<T extends DefaultRow>(result: T): Cursor {
    return {
      primary: result.createdAt,
      secondary: result.uri,
    }
  }
  packFromResult(results: T | T[]): string | undefined {
    const result = Array.isArray(results) ? results.at(-1) : results
    if (result === undefined) return
    return this.pack(this.cursorFromResult(result))
  }
  pack(cursor?: Cursor): string | undefined {
    if (cursor === undefined) return
    return JSON.stringify([cursor.primary, cursor.secondary])
  }
  unpack(cursorStr?: string): Cursor | undefined {
    if (cursorStr === undefined) return
    const result = safeParse(cursorStr)
    if (!Array.isArray(result)) {
      throw new InvalidRequestError('Malformed cursor')
    }
    const [primary, secondary, ...others] = result
    if (
      typeof primary !== 'string' ||
      typeof secondary !== 'string' ||
      others.length > 0
    ) {
      throw new InvalidRequestError('Malformed cursor')
    }
    return {
      primary,
      secondary,
    }
  }
}

type Cursor = { primary: string; secondary: string }

// Keyset condition for a cursor
const getKeysetCondition = <T>(
  cursor: Cursor | undefined,
  keyset: Keyset<T>,
) => {
  if (cursor === undefined) return undefined
  return sql`((${keyset.primary} < ${cursor.primary}) or (${keyset.primary} = ${cursor.primary} and ${keyset.secondary} < ${cursor.secondary}))`
}

export const dummyDialect = {
  createAdapter() {
    return new SqliteAdapter()
  },
  createDriver() {
    return new DummyDriver()
  },
  createIntrospector(db) {
    return new SqliteIntrospector(db)
  },
  createQueryCompiler() {
    return new SqliteQueryCompiler()
  },
}

export type DbRef = RawBuilder | ReturnType<DynamicModule['ref']>
