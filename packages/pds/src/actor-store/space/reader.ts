import { SqlBool, sql } from 'kysely'
import { LexMap } from '@atproto/lex-data'
import { cborToLexRecord } from '@atproto/repo'
import { ActorDb } from '../db/index.js'

// Cursor is `${collection}/${rkey}`. Parser is lenient — returns null for a
// malformed cursor so callers can choose to ignore it instead of 500ing.
const parseListCursor = (
  cursor: string,
): { collection: string; rkey: string } | null => {
  const slash = cursor.indexOf('/')
  if (slash < 0) return null
  const collection = cursor.slice(0, slash)
  const rkey = cursor.slice(slash + 1)
  if (!collection || !rkey) return null
  return { collection, rkey }
}

export const formatListCursor = (collection: string, rkey: string): string =>
  `${collection}/${rkey}`

const parseStringArray = (raw: string): string[] => {
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) return []
  return parsed.filter((v): v is string => typeof v === 'string')
}

export type SpaceRow = {
  uri: string
  isOwner: boolean
  policy: string
  managingApp: string | null
  appAccessType: string
  appAllowed: string[]
  deletedAt: string | null
}

export class SpaceReader {
  constructor(public db: ActorDb) {}

  async getSpace(uri: string): Promise<SpaceRow | null> {
    const row = await this.db.db
      .selectFrom('space')
      .selectAll()
      .where('uri', '=', uri)
      .executeTakeFirst()
    if (!row) return null
    return {
      uri: row.uri,
      isOwner: row.isOwner === 1,
      policy: row.policy,
      managingApp: row.managingApp,
      appAccessType: row.appAccessType,
      appAllowed: parseStringArray(row.appAllowed),
      deletedAt: row.deletedAt,
    }
  }

  async listSpaces(opts: {
    limit: number
    cursor?: string
    type?: string
    did?: string
  }): Promise<{ uri: string; isOwner: boolean }[]> {
    const { limit, cursor, type, did } = opts
    // "Spaces the caller holds a repo in" — every local, non-deleted space row.
    let builder = this.db.db
      .selectFrom('space')
      .select(['uri', 'isOwner'])
      .where('deletedAt', 'is', null)
      .orderBy('uri', 'asc')
      .limit(limit)
    // Filter by URI shape `at://<did>/space/<type>/<skey>`. DIDs can't contain
    // `/` so a `%/space/<type>/%` LIKE is unambiguous.
    if (did && type) {
      builder = builder.where('uri', 'like', `at://${did}/space/${type}/%`)
    } else if (did) {
      builder = builder.where('uri', 'like', `at://${did}/space/%`)
    } else if (type) {
      builder = builder.where('uri', 'like', `at://%/space/${type}/%`)
    }
    if (cursor !== undefined) {
      builder = builder.where('uri', '>', cursor)
    }
    const rows = await builder.execute()
    return rows.map((r) => ({ uri: r.uri, isOwner: r.isOwner === 1 }))
  }

  async getRecord(
    space: string,
    collection: string,
    rkey: string,
    cid?: string | null,
  ): Promise<{ cid: string; value: LexMap; indexedAt: string } | null> {
    let builder = this.db.db
      .selectFrom('space_record')
      .where('space', '=', space)
      .where('collection', '=', collection)
      .where('rkey', '=', rkey)
      .selectAll()
    if (cid) {
      builder = builder.where('cid', '=', cid)
    }
    const row = await builder.executeTakeFirst()
    if (!row) return null
    return {
      cid: row.cid,
      value: cborToLexRecord(row.value),
      indexedAt: row.indexedAt,
    }
  }

  async hasRecord(
    space: string,
    collection: string,
    rkey: string,
  ): Promise<boolean> {
    const row = await this.db.db
      .selectFrom('space_record')
      .select('rkey')
      .where('space', '=', space)
      .where('collection', '=', collection)
      .where('rkey', '=', rkey)
      .executeTakeFirst()
    return !!row
  }

  async listCollections(space: string): Promise<string[]> {
    const rows = await this.db.db
      .selectFrom('space_record')
      .select('collection')
      .where('space', '=', space)
      .groupBy('collection')
      .execute()
    return rows.map((r) => r.collection)
  }

  async listRecords(
    space: string,
    opts: {
      limit: number
      cursor?: string
      reverse?: boolean
      collection?: string
      includeValues?: boolean
    },
  ): Promise<
    { collection: string; rkey: string; cid: string; value?: LexMap }[]
  > {
    const { limit, cursor, reverse, collection, includeValues } = opts
    // Pagination is ordered by (collection, rkey) so a single cursor works
    // across collections. Cursor format: `${collection}/${rkey}`.
    const direction = reverse ? 'asc' : 'desc'
    const columns = includeValues
      ? (['collection', 'rkey', 'cid', 'value'] as const)
      : (['collection', 'rkey', 'cid'] as const)
    let builder = this.db.db
      .selectFrom('space_record')
      .select(columns)
      .where('space', '=', space)
      .orderBy('collection', direction)
      .orderBy('rkey', direction)
      .limit(limit)
    if (collection) {
      builder = builder.where('collection', '=', collection)
    }
    if (cursor !== undefined) {
      const cursorKey = parseListCursor(cursor)
      if (cursorKey) {
        // Lexicographic tuple comparison: (collection, rkey) </> cursor.
        // Written with `sql` because not all kysely versions expose tuple
        // expressions in the typed builder.
        const { collection: c, rkey: r } = cursorKey
        builder = builder.where(
          reverse
            ? sql<SqlBool>`("collection", "rkey") > (${c}, ${r})`
            : sql<SqlBool>`("collection", "rkey") < (${c}, ${r})`,
        )
      }
    }
    const rows = await builder.execute()
    return rows.map((r) => ({
      collection: r.collection,
      rkey: r.rkey,
      cid: r.cid,
      ...(includeValues ? { value: cborToLexRecord(r.value) } : {}),
    }))
  }

  async listMembers(
    space: string,
    opts: { limit: number; cursor?: string },
  ): Promise<{ did: string }[]> {
    let builder = this.db.db
      .selectFrom('space_member')
      .select(['did'])
      .where('space', '=', space)
      .orderBy('did', 'asc')
      .limit(opts.limit)
    if (opts.cursor !== undefined) {
      builder = builder.where('did', '>', opts.cursor)
    }
    const rows = await builder.execute()
    return rows
  }

  async listWriters(
    space: string,
    opts: { limit: number; cursor?: string },
  ): Promise<{ did: string; rev: string; hash: Uint8Array }[]> {
    let builder = this.db.db
      .selectFrom('space_writer')
      .select(['did', 'rev', 'hash'])
      .where('space', '=', space)
      .orderBy('did', 'asc')
      .limit(opts.limit)
    if (opts.cursor !== undefined) {
      builder = builder.where('did', '>', opts.cursor)
    }
    return builder.execute()
  }

  async isMember(space: string, did: string): Promise<boolean> {
    const row = await this.db.db
      .selectFrom('space_member')
      .select('did')
      .where('space', '=', space)
      .where('did', '=', did)
      .executeTakeFirst()
    return !!row
  }

  async getSetHash(space: string): Promise<Buffer | null> {
    const row = await this.db.db
      .selectFrom('space_repo')
      .select('setHash')
      .where('space', '=', space)
      .executeTakeFirst()
    return row?.setHash ? Buffer.from(row.setHash) : null
  }

  async getRev(space: string): Promise<string | null> {
    const row = await this.db.db
      .selectFrom('space_repo')
      .select('rev')
      .where('space', '=', space)
      .executeTakeFirst()
    return row?.rev ?? null
  }

  async getRepoState(
    space: string,
  ): Promise<{ setHash: Buffer | null; rev: string | null } | null> {
    const row = await this.db.db
      .selectFrom('space_repo')
      .select(['setHash', 'rev'])
      .where('space', '=', space)
      .executeTakeFirst()
    if (!row) return null
    return {
      setHash: row.setHash ? Buffer.from(row.setHash) : null,
      rev: row.rev,
    }
  }

  /**
   * A rev is never split across responses: ops sharing a rev were applied atomically
   * and `since` advances by whole revs, so returning part of one would drop the
   * remainder. A rev larger than `limit` comes back whole.
   */
  async getRepoOplog(
    space: string,
    opts: { since?: string; limit: number; includeValues?: boolean },
  ): Promise<{
    ops: Array<{
      rev: string
      idx: number
      action: string
      collection: string
      rkey: string
      cid: string | null
      prev: string | null
      value?: LexMap
    }>
    caughtUp: boolean
    setHash: Buffer | null
    rev: string | null
  }> {
    const { since, limit, includeValues } = opts

    const query = (opts: { since?: string; rev?: string; limit?: number }) => {
      // Table-qualified throughout: the `space_record` join below shares the
      // space/rev/collection/rkey/cid column names.
      let builder = this.db.db
        .selectFrom('space_record_oplog')
        .where('space_record_oplog.space', '=', space)
        .orderBy('space_record_oplog.rev', 'asc')
        .orderBy('space_record_oplog.idx', 'asc')
        .selectAll('space_record_oplog')
      // Inline the record's current value, but only when the op's cid still
      // matches the live record — a value superseded by a later op is stale and
      // must be omitted. The join self-filters to the current row by cid.
      if (includeValues) {
        builder = builder
          .leftJoin('space_record', (join) =>
            join
              .onRef('space_record.space', '=', 'space_record_oplog.space')
              .onRef(
                'space_record.collection',
                '=',
                'space_record_oplog.collection',
              )
              .onRef('space_record.rkey', '=', 'space_record_oplog.rkey')
              .onRef('space_record.cid', '=', 'space_record_oplog.cid'),
          )
          .select('space_record.value as value')
      }
      if (opts.since) {
        builder = builder.where('space_record_oplog.rev', '>', opts.since)
      }
      if (opts.rev) {
        builder = builder.where('space_record_oplog.rev', '=', opts.rev)
      }
      if (opts.limit) builder = builder.limit(opts.limit)
      return builder.execute()
    }

    const rows = await query({ since, limit: limit + 1 })

    let kept = rows
    let caughtUp = true
    if (rows.length > limit) {
      caughtUp = false
      const lastRev = rows[rows.length - 1].rev
      const trimmed = rows.slice(0, limit).filter((r) => r.rev !== lastRev)
      // One rev filled the whole window, so re-read it in full.
      kept = trimmed.length > 0 ? trimmed : await query({ rev: rows[0].rev })
    }

    const state = await this.getRepoState(space)
    return {
      ops: kept.map((r) => {
        // Only present on joined rows; not in kysely's row type.
        const value = (r as { value?: Uint8Array | null }).value
        return {
          rev: r.rev,
          idx: r.idx,
          action: r.action,
          collection: r.collection,
          rkey: r.rkey,
          cid: r.cid,
          prev: r.prev,
          ...(value != null ? { value: cborToLexRecord(value) } : {}),
        }
      }),
      caughtUp,
      setHash: state?.setHash ?? null,
      rev: state?.rev ?? null,
    }
  }

  // Paged so a caller can serialize a repo without buffering the whole thing.
  async *streamRecords(
    space: string,
    opts: { batchSize?: number } = {},
  ): AsyncGenerator<{
    collection: string
    rkey: string
    cid: string
    value: Uint8Array
  }> {
    const batchSize = opts.batchSize ?? 500
    let cursor: { collection: string; rkey: string } | undefined

    while (true) {
      let builder = this.db.db
        .selectFrom('space_record')
        .select(['collection', 'rkey', 'cid', 'value'])
        .where('space', '=', space)
        .orderBy('collection', 'asc')
        .orderBy('rkey', 'asc')
        .limit(batchSize)
      if (cursor) {
        builder = builder.where(
          sql<SqlBool>`("collection", "rkey") > (${cursor.collection}, ${cursor.rkey})`,
        )
      }
      const rows = await builder.execute()
      if (rows.length === 0) return
      for (const row of rows) {
        yield row
      }
      if (rows.length < batchSize) return
      const last = rows[rows.length - 1]
      cursor = { collection: last.collection, rkey: last.rkey }
    }
  }

  async getCredentialRecipients(space: string): Promise<
    Array<{
      serviceDid: string
      serviceEndpoint: string
      lastIssuedAt: string
    }>
  > {
    const rows = await this.db.db
      .selectFrom('space_credential_recipient')
      .select(['serviceDid', 'serviceEndpoint', 'lastIssuedAt'])
      .where('space', '=', space)
      .execute()
    return rows
  }
}
