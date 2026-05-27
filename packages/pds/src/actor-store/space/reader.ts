import { sql } from 'kysely'
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

export class SpaceReader {
  constructor(public db: ActorDb) {}

  async getSpace(uri: string): Promise<{
    uri: string
    isOwner: boolean
    isMember: boolean
    deletedAt: string | null
  } | null> {
    const row = await this.db.db
      .selectFrom('space')
      .selectAll()
      .where('uri', '=', uri)
      .executeTakeFirst()
    if (!row) return null
    return {
      uri: row.uri,
      isOwner: row.isOwner === 1,
      isMember: row.isMember === 1,
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
    let builder = this.db.db
      .selectFrom('space')
      .select(['uri', 'isOwner'])
      .where(sql`("isOwner" = 1 OR "isMember" = 1)`)
      .orderBy('uri', 'asc')
      .limit(limit)
    // Filter by URI shape `ats://<did>/<type>/<skey>`. DIDs can't contain `/`
    // so a `%/<type>/%` LIKE is unambiguous.
    if (did && type) {
      builder = builder.where('uri', 'like', `ats://${did}/${type}/%`)
    } else if (did) {
      builder = builder.where('uri', 'like', `ats://${did}/%`)
    } else if (type) {
      builder = builder.where('uri', 'like', `ats://%/${type}/%`)
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
    },
  ): Promise<{ collection: string; rkey: string; cid: string }[]> {
    const { limit, cursor, reverse, collection } = opts
    // Pagination is ordered by (collection, rkey) so a single cursor works
    // across collections. Cursor format: `${collection}/${rkey}`.
    const direction = reverse ? 'asc' : 'desc'
    let builder = this.db.db
      .selectFrom('space_record')
      .select(['collection', 'rkey', 'cid'])
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
        const op = reverse ? sql`>` : sql`<`
        builder = builder.where(
          sql`("collection", "rkey") ${op} (${cursorKey.collection}, ${cursorKey.rkey})`,
        )
      }
    }
    const rows = await builder.execute()
    return rows.map((r) => ({
      collection: r.collection,
      rkey: r.rkey,
      cid: r.cid,
    }))
  }

  async listMembers(
    space: string,
    opts: { limit: number; cursor?: string },
  ): Promise<{ did: string; memberRev: string }[]> {
    let builder = this.db.db
      .selectFrom('space_member')
      .select(['did', 'memberRev'])
      .where('space', '=', space)
      .orderBy('did', 'asc')
      .limit(opts.limit)
    if (opts.cursor !== undefined) {
      builder = builder.where('did', '>', opts.cursor)
    }
    const rows = await builder.execute()
    return rows
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

  async getMemberState(
    space: string,
  ): Promise<{ setHash: Buffer | null; rev: string | null } | null> {
    const row = await this.db.db
      .selectFrom('space_member_state')
      .select(['setHash', 'rev'])
      .where('space', '=', space)
      .executeTakeFirst()
    if (!row) return null
    return {
      setHash: row.setHash ? Buffer.from(row.setHash) : null,
      rev: row.rev,
    }
  }

  async getRepoOplog(
    space: string,
    opts: { since?: string; limit?: number },
  ): Promise<{
    ops: Array<{
      rev: string
      idx: number
      action: string
      collection: string
      rkey: string
      cid: string | null
      prev: string | null
    }>
    setHash: Buffer | null
    rev: string | null
  }> {
    let builder = this.db.db
      .selectFrom('space_record_oplog')
      .selectAll()
      .where('space', '=', space)
      .orderBy('rev', 'asc')
      .orderBy('idx', 'asc')
    if (opts.since) {
      builder = builder.where('rev', '>', opts.since)
    }
    if (opts.limit) {
      builder = builder.limit(opts.limit)
    }
    const rows = await builder.execute()
    const state = await this.getRepoState(space)
    return {
      ops: rows.map((r) => ({
        rev: r.rev,
        idx: r.idx,
        action: r.action,
        collection: r.collection,
        rkey: r.rkey,
        cid: r.cid,
        prev: r.prev,
      })),
      setHash: state?.setHash ?? null,
      rev: state?.rev ?? null,
    }
  }

  async getMemberOplog(
    space: string,
    opts: { since?: string; limit?: number },
  ): Promise<{
    ops: Array<{
      rev: string
      idx: number
      action: string
      did: string
    }>
    setHash: Buffer | null
    rev: string | null
  }> {
    let builder = this.db.db
      .selectFrom('space_member_oplog')
      .selectAll()
      .where('space', '=', space)
      .orderBy('rev', 'asc')
      .orderBy('idx', 'asc')
    if (opts.since) {
      builder = builder.where('rev', '>', opts.since)
    }
    if (opts.limit) {
      builder = builder.limit(opts.limit)
    }
    const rows = await builder.execute()
    const state = await this.getMemberState(space)
    return {
      ops: rows.map((r) => ({
        rev: r.rev,
        idx: r.idx,
        action: r.action,
        did: r.did,
      })),
      setHash: state?.setHash ?? null,
      rev: state?.rev ?? null,
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
