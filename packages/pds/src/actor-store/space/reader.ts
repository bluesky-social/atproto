import { SqlBool, sql } from 'kysely'
import { LexMap } from '@atproto/lex-data'
import { cborToLexRecord } from '@atproto/repo'
import { DidString, SpaceRef } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import {
  ActorDb,
  SimplespaceConfig,
  SimplespaceMember,
  Space,
  SpaceRecord,
  SpaceRecordOplog,
  SpaceRepo,
  SpaceWriter,
} from '../db/index.js'

// The two halves of a space's config, as updateSpace patches them.
export type SpacePolicy = Pick<SimplespaceConfig, 'policy' | 'managingApp'>
export type SpaceAppAccess = Pick<
  SimplespaceConfig,
  'appAccessType' | 'appAllowed'
>

// A record's path within its space.
export type SpaceRecordPath = Pick<SpaceRecord, 'collection' | 'rkey'>

// An oplog row, plus the record's value when values were requested and this op's is
// still the current one.
export type SpaceOp = Omit<SpaceRecordOplog, 'space'> & { value?: LexMap }

// Where a paginated response left off. Ops are unique and ordered by (rev, idx), so
// this resumes exactly, even mid-rev.
export type OplogPosition = Pick<SpaceRecordOplog, 'rev' | 'idx'>

export class SpaceReader {
  constructor(public db: ActorDb) {}

  async getSpace(uri: string): Promise<Space | null> {
    const row = await this.db.db
      .selectFrom('space')
      .selectAll()
      .where('uri', '=', uri)
      .executeTakeFirst()
    return row ?? null
  }

  // Throws rather than returning null: a deleted space is indistinguishable from one
  // that never existed to everything but deleteSpace.
  async getActiveSpace(uri: string): Promise<Space> {
    const space = await this.getSpace(uri)
    if (!space || space.deletedAt) {
      throw new InvalidRequestError('Space not found', 'SpaceNotFound')
    }
    return space
  }

  /**
   * The governance for a space this account is the authority for. Null for a space
   * governed elsewhere — a member's store holds the repo but not the policy.
   */
  async getSpaceConfig(uri: string): Promise<SimplespaceConfig | null> {
    const row = await this.db.db
      .selectFrom('simplespace_config')
      .selectAll()
      .where('uri', '=', uri)
      .executeTakeFirst()
    return row ?? null
  }

  // The pair every credential decision needs: that the space is live here, and how it
  // is governed. Throws SpaceNotFound if this account isn't its authority.
  async getActiveSpaceConfig(uri: string): Promise<SimplespaceConfig> {
    await this.getActiveSpace(uri)
    const config = await this.getSpaceConfig(uri)
    if (!config) {
      throw new InvalidRequestError('Space not found', 'SpaceNotFound')
    }
    return config
  }

  async listSpaces(opts: {
    limit: number
    cursor?: string
    type?: string
    did?: string
  }): Promise<{ uri: string }[]> {
    const { limit, cursor, type, did } = opts
    // "Spaces the caller holds a repo in" — every local, non-deleted space row.
    let builder = this.db.db
      .selectFrom('space')
      .select(['uri'])
      .where('deletedAt', 'is', null)
      .orderBy('uri', 'asc')
      .limit(limit)
    if (did) {
      builder = builder.where('authority', '=', did)
    }
    if (type) {
      builder = builder.where('type', '=', type)
    }
    if (cursor !== undefined) {
      builder = builder.where('uri', '>', cursor)
    }
    return builder.execute()
  }

  async getRecord(
    space: string,
    collection: string,
    rkey: string,
    cid?: string | null,
  ): Promise<(SpaceRecordPath & { cid: string; value: LexMap }) | null> {
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
      collection: row.collection,
      rkey: row.rkey,
      cid: row.cid,
      value: cborToLexRecord(row.value),
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

  async listRecords(
    space: string,
    opts: {
      limit: number
      cursor?: string
      reverse?: boolean
      collection?: string
      includeValues?: boolean
    },
  ): Promise<(SpaceRecordPath & { cid: string; value?: LexMap })[]> {
    const { limit, cursor, reverse, collection, includeValues } = opts
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
    // A malformed cursor is ignored rather than an error, matching the rest of the
    // paginated read paths.
    const [cursorCollection, cursorRkey] = cursor?.split('/') ?? []
    if (cursorCollection && cursorRkey) {
      // Tuple comparison, written as raw sql because kysely's typed builder doesn't
      // expose it.
      builder = builder.where(
        reverse
          ? sql<SqlBool>`("collection", "rkey") > (${cursorCollection}, ${cursorRkey})`
          : sql<SqlBool>`("collection", "rkey") < (${cursorCollection}, ${cursorRkey})`,
      )
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
  ): Promise<Pick<SimplespaceMember, 'did'>[]> {
    let builder = this.db.db
      .selectFrom('simplespace_member')
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
  ): Promise<Omit<SpaceWriter, 'space'>[]> {
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
      .selectFrom('simplespace_member')
      .select('did')
      .where('space', '=', space)
      .where('did', '=', did)
      .executeTakeFirst()
    return !!row
  }

  /**
   * Whether this space's policy authorizes the user, for the policies answerable from
   * local state. A `managing-app` policy needs a call out to that app, so it returns
   * 'ask-managing-app' for the caller to resolve — see SimpleSpaceManager.authorizeUser.
   */
  async checkUserAuthorized(
    config: SimplespaceConfig,
    userDid: string,
  ): Promise<boolean | 'ask-managing-app'> {
    // The authority is the only party who can reconfigure the space, so it must not be
    // able to lock itself out.
    if (userDid === SpaceRef.parse(config.uri).spaceDid) return true

    switch (config.policy) {
      case 'public':
        return true
      case 'member-list':
        return this.isMember(config.uri, userDid)
      case 'managing-app':
        return 'ask-managing-app'
      default:
        return false
    }
  }

  async getRepoState(space: string): Promise<SpaceRepo | null> {
    const row = await this.db.db
      .selectFrom('space_repo')
      .selectAll()
      .where('space', '=', space)
      .executeTakeFirst()
    return row ?? null
  }

  /**
   * A repo's ops, ordered by (rev, idx), alongside the repo's current commit state.
   *
   * `since` is a rev — the caller's sync position — and `position` resumes a paginated
   * response mid-rev. A caller paging through holds `since` steady and passes back the
   * position from each response.
   */
  async listRepoOps(
    space: string,
    opts: {
      since?: string
      position?: OplogPosition
      limit: number
      includeValues?: boolean
    },
  ): Promise<{
    ops: SpaceOp[]
    state: SpaceRepo | null
    caughtUp: boolean
  }> {
    const { since, position, limit, includeValues } = opts

    // Table-qualified throughout: space_record shares most of these column names.
    let builder = this.db.db
      .selectFrom('space_record_oplog')
      .selectAll('space_record_oplog')
      .where('space_record_oplog.space', '=', space)
      .orderBy('space_record_oplog.rev', 'asc')
      .orderBy('space_record_oplog.idx', 'asc')
      // One extra row, to tell a full page from the last one.
      .limit(limit + 1)
    if (includeValues) {
      // Joining on the op's cid as well as its path means only the record's *current*
      // value comes back. An op that a later one superseded joins to nothing, so its
      // stale value is left off rather than served.
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
    if (since) {
      builder = builder.where('space_record_oplog.rev', '>', since)
    }
    if (position) {
      // Strictly after (rev, idx), so a page can resume in the middle of a rev.
      builder = builder.where(
        sql<SqlBool>`("space_record_oplog"."rev", "space_record_oplog"."idx") > (${position.rev}, ${position.idx})`,
      )
    }

    // `value` is only selected on the joined variant, so kysely can't type it here.
    const rows: Array<SpaceOp & { value?: unknown }> = await builder.execute()
    const hasMore = rows.length > limit
    const ops = rows
      .slice(0, limit)
      .map(({ value, ...op }) =>
        value instanceof Uint8Array
          ? { ...op, value: cborToLexRecord(value) }
          : op,
      )

    // Read after the ops, so a write landing in between shows up as the page trailing
    // the repo rather than as a commit paired with ops that precede it.
    const state = await this.getRepoState(space)
    const lastRev = ops.at(-1)?.rev
    const caughtUp =
      !hasMore && (lastRev === undefined || lastRev === state?.rev)
    return { ops, state, caughtUp }
  }

  /**
   * Paged so a caller can serialize a repo without buffering the whole thing.
   *
   * `value` is absent under `excludeValues` — the column isn't selected — so a caller
   * that needs bytes must not pass it.
   */
  async *streamRecords(
    space: string,
    opts: { batchSize?: number; excludeValues?: boolean } = {},
  ): AsyncGenerator<SpaceRecordPath & { cid: string; value?: Uint8Array }> {
    const batchSize = opts.batchSize ?? 500
    let cursor: SpaceRecordPath | undefined

    while (true) {
      let builder = this.db.db
        .selectFrom('space_record')
        .select(
          opts.excludeValues
            ? ['collection', 'rkey', 'cid']
            : ['collection', 'rkey', 'cid', 'value'],
        )
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

  // Scoped per-space: com.atproto.sync.listBlobs is unauthenticated and must
  // never enumerate these.
  async listBlobs(
    space: string,
    opts: { since?: string; cursor?: string; limit: number },
  ): Promise<string[]> {
    const { since, cursor, limit } = opts
    // Table-qualified throughout: the `space_record` join below shares the
    // space/collection/rkey column names.
    let builder = this.db.db
      .selectFrom('space_record_blob')
      .select('space_record_blob.blobCid as blobCid')
      .where('space_record_blob.space', '=', space)
      .groupBy('space_record_blob.blobCid')
      .orderBy('space_record_blob.blobCid', 'asc')
      .limit(limit)
    if (since) {
      builder = builder
        .innerJoin('space_record', (join) =>
          join
            .onRef('space_record.space', '=', 'space_record_blob.space')
            .onRef(
              'space_record.collection',
              '=',
              'space_record_blob.collection',
            )
            .onRef('space_record.rkey', '=', 'space_record_blob.rkey'),
        )
        .where('space_record.repoRev', '>', since)
    }
    if (cursor) {
      builder = builder.where('space_record_blob.blobCid', '>', cursor)
    }
    const rows = await builder.execute()
    return rows.map((row) => row.blobCid)
  }

  /**
   * Who to notify that a space was deleted: the accounts holding a repo in it, and the
   * services registered for its notifications. Not the member list — membership
   * doesn't imply a repo, and under a `public` or `managing-app` policy a writer need
   * never have been a member.
   */
  async listDeletionRecipients(space: string): Promise<{
    writers: DidString[]
    services: string[]
  }> {
    const [writers, recipients] = await Promise.all([
      this.db.db
        .selectFrom('space_writer')
        .select('did')
        .where('space', '=', space)
        .execute(),
      this.getCredentialRecipients(space),
    ])
    return {
      writers: writers.map((writer) => writer.did as DidString),
      services: recipients.map((recipient) => recipient.serviceDid),
    }
  }

  // A lapsed registration is left in place rather than deleted, so re-registering the
  // same service reuses its row.
  async getCredentialRecipients(
    space: string,
  ): Promise<Array<{ serviceDid: string; serviceEndpoint: string }>> {
    return this.db.db
      .selectFrom('space_credential_recipient')
      .select(['serviceDid', 'serviceEndpoint'])
      .where('space', '=', space)
      .where('expiresAt', '>', new Date().toISOString())
      .execute()
  }
}
