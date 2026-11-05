import type { LexMap } from '@atproto/lex-data'
import { cborToLexRecord } from '@atproto/repo'
import {
  type AtUriString,
  type DidString,
  type NsidString,
  type SpaceRefString,
  isAtUriString,
  isSpaceRefString,
  isValidDid,
} from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { fromJson } from '../../db/index.js'
import type { Policy } from '../../space-policy/policy.js'
import type {
  ActorDb,
  Space,
  SpaceRecord,
  SpaceRecordOplog,
  SpaceRepo,
  SpaceWriter,
} from '../db/index.js'

export class SpaceReader {
  constructor(public db: ActorDb) {}

  async getSpace(uri: SpaceRefString): Promise<Space | null> {
    const row = await this.db.db
      .selectFrom('space')
      .selectAll()
      .where('uri', '=', uri)
      .executeTakeFirst()
    return row ?? null
  }

  async getSpacePolicy(uri: SpaceRefString): Promise<Policy | null> {
    const row = await this.db.db
      .selectFrom('space_policy')
      .select('policyJson')
      .where('uri', '=', uri)
      .executeTakeFirst()
    return row ? fromJson(row.policyJson) : null
  }

  async getActiveSpacePolicy(uri: SpaceRefString): Promise<Policy> {
    const space = await this.getSpace(uri)
    const policy = await this.getSpacePolicy(uri)
    if (!space || space.deletedAt || !policy) {
      throw new InvalidRequestError('Space not found', 'SpaceNotFound')
    }
    return policy
  }

  /**
   * List the spaces this account holds a repo in or is the authority for, along with
   * the state of its repo in each. `spaceRev` is the latest revision in the space's
   * writer set, which is only kept for the spaces this account is the authority for.
   */
  async listSpaces(opts: {
    limit: number
    cursor?: string
    type?: NsidString
    authority?: DidString
  }) {
    const { limit, cursor, type, authority } = opts
    let builder = this.db.db
      .selectFrom('space')
      .leftJoin('space_repo', 'space_repo.space', 'space.uri')
      .select(['space.uri', 'space_repo.rev as repoRev', 'space_repo.setHash'])
      .select((eb) =>
        eb
          .selectFrom('space_writer')
          .whereRef('space_writer.space', '=', 'space.uri')
          .select(({ fn }) => fn.max('space_writer.spaceRev').as('spaceRev'))
          .as('spaceRev'),
      )
      .where('space.deletedAt', 'is', null)
      .orderBy('space.uri', 'asc')
      .limit(limit)
    if (authority) {
      builder = builder.where('space.authority', '=', authority)
    }
    if (type) {
      builder = builder.where('space.type', '=', type)
    }
    if (cursor) {
      if (!isSpaceRefString(cursor)) {
        throw new InvalidRequestError('Malformed cursor', 'InvalidCursor')
      }
      builder = builder.where('space.uri', '>', cursor)
    }
    return builder.execute()
  }

  async getRecord(
    uri: AtUriString,
    cid?: string | null,
  ): Promise<(Omit<SpaceRecord, 'value'> & { value: LexMap }) | null> {
    let builder = this.db.db
      .selectFrom('space_record')
      .selectAll()
      .where('uri', '=', uri)
    if (cid) {
      builder = builder.where('cid', '=', cid)
    }
    const row = await builder.executeTakeFirst()
    if (!row) return null
    return { ...row, value: cborToLexRecord(row.value) }
  }

  async listCollections(space: SpaceRefString): Promise<NsidString[]> {
    const rows = await this.db.db
      .selectFrom('space_record')
      .select('collection')
      .where('space', '=', space)
      .groupBy('collection')
      .execute()
    return rows.map((row) => row.collection)
  }

  async hasRecord(uri: AtUriString): Promise<boolean> {
    const row = await this.db.db
      .selectFrom('space_record')
      .select('uri')
      .where('uri', '=', uri)
      .executeTakeFirst()
    return !!row
  }

  async listRecords(
    space: SpaceRefString,
    opts: {
      limit: number
      cursor?: string
      collection?: NsidString
      excludeValues?: boolean
    },
  ): Promise<(Omit<SpaceRecord, 'value'> & { value?: LexMap })[]> {
    const { limit, cursor, collection, excludeValues } = opts
    let builder = this.db.db
      .selectFrom('space_record')
      .select(RECORD_COLUMNS)
      .where('space', '=', space)
      .orderBy('uri', 'desc')
      .limit(limit)
      .$if(!excludeValues, (qb) => qb.select('value'))
    if (collection) {
      builder = builder.where('collection', '=', collection)
    }
    if (cursor) {
      if (!isAtUriString(cursor)) {
        throw new InvalidRequestError('Malformed cursor', 'InvalidCursor')
      }
      builder = builder.where('uri', '<', cursor)
    }
    const rows = await builder.execute()
    return rows.map((row) => ({
      ...row,
      value: row.value && cborToLexRecord(row.value),
    }))
  }

  async *streamRecords(space: SpaceRefString): AsyncGenerator<SpaceRecord> {
    let cursor: AtUriString | undefined
    while (true) {
      let builder = this.db.db
        .selectFrom('space_record')
        .selectAll()
        .where('space', '=', space)
        // Every uri in a space repo shares a prefix, so this is also record path
        // order, as a serialized repo requires.
        .orderBy('uri', 'asc')
        .limit(500)
      if (cursor) {
        builder = builder.where('uri', '>', cursor)
      }
      const rows = await builder.execute()
      for (const row of rows) {
        yield row
      }
      cursor = rows.at(-1)?.uri
      if (!cursor) return
    }
  }

  async listRepoOps(
    space: SpaceRefString,
    opts: {
      limit: number
      since?: string
      cursor?: { rev: string; idx: number }
      excludeValues?: boolean
    },
  ): Promise<(SpaceRecordOplog & { value?: LexMap })[]> {
    const { limit, since, cursor, excludeValues } = opts
    // Joining on the op's cid as well as its uri means only the record's *current*
    // value comes back. An op a later one superseded joins to nothing, so its stale
    // value is left off rather than served.
    let builder = this.db.db
      .selectFrom('space_record_oplog')
      .leftJoin('space_record', (join) =>
        join
          .onRef('space_record.uri', '=', 'space_record_oplog.uri')
          .onRef('space_record.cid', '=', 'space_record_oplog.cid'),
      )
      .selectAll('space_record_oplog')
      .where('space_record_oplog.space', '=', space)
      .orderBy('space_record_oplog.rev', 'asc')
      .orderBy('space_record_oplog.idx', 'asc')
      .limit(limit)
      .$if(!excludeValues, (qb) => qb.select('space_record.value'))
    if (since) {
      builder = builder.where('space_record_oplog.rev', '>', since)
    }
    if (cursor) {
      builder = builder.where((eb) =>
        eb.or([
          eb('space_record_oplog.rev', '>', cursor.rev),
          eb.and([
            eb('space_record_oplog.rev', '=', cursor.rev),
            eb('space_record_oplog.idx', '>', cursor.idx),
          ]),
        ]),
      )
    }
    const rows = await builder.execute()
    return rows.map((row) => ({
      ...row,
      value: row.value ? cborToLexRecord(row.value) : undefined,
    }))
  }

  async getRepoState(space: SpaceRefString): Promise<SpaceRepo | null> {
    const row = await this.db.db
      .selectFrom('space_repo')
      .selectAll()
      .where('space', '=', space)
      .executeTakeFirst()
    return row ?? null
  }

  async listBlobs(
    space: SpaceRefString,
    opts: { limit: number; cursor?: string },
  ): Promise<string[]> {
    const { limit, cursor } = opts
    let builder = this.db.db
      .selectFrom('space_record_blob')
      .innerJoin('space_record', 'space_record.uri', 'recordUri')
      .select('blobCid')
      .where('space_record.space', '=', space)
      .groupBy('blobCid')
      .orderBy('blobCid', 'asc')
      .limit(limit)
    if (cursor) {
      builder = builder.where('blobCid', '>', cursor)
    }
    const rows = await builder.execute()
    return rows.map((row) => row.blobCid)
  }

  async isBlobInSpace(
    space: SpaceRefString,
    blobCid: string,
  ): Promise<boolean> {
    const row = await this.db.db
      .selectFrom('space_record_blob')
      .innerJoin('space_record', 'space_record.uri', 'recordUri')
      .select('blobCid')
      .where('space_record.space', '=', space)
      .where('blobCid', '=', blobCid)
      .executeTakeFirst()
    return !!row
  }

  async getMember(space: SpaceRefString, did: DidString) {
    const row = await this.db.db
      .selectFrom('memberspace_member')
      .select(['read', 'write'])
      .where('space', '=', space)
      .where('did', '=', did)
      .executeTakeFirst()
    return row
  }

  async listMembers(
    space: SpaceRefString,
    opts: { limit?: number; cursor?: string } = {},
  ) {
    let builder = this.db.db
      .selectFrom('memberspace_member')
      .select(['did', 'read', 'write'])
      .where('space', '=', space)
      .orderBy('did', 'asc')
    if (opts.limit) {
      builder = builder.limit(opts.limit)
    }
    if (opts.cursor) {
      if (!isValidDid(opts.cursor)) {
        throw new InvalidRequestError('Malformed cursor', 'InvalidCursor')
      }
      builder = builder.where('did', '>', opts.cursor)
    }
    return builder.execute()
  }

  async listWriters(
    space: SpaceRefString,
    opts: {
      limit?: number
      cursor?: string
    } = {},
  ): Promise<SpaceWriter[]> {
    let builder = this.db.db
      .selectFrom('space_writer')
      .selectAll()
      .where('space', '=', space)
      .orderBy('spaceRev', 'asc')
    if (opts.limit) {
      builder = builder.limit(opts.limit)
    }
    if (opts.cursor) {
      builder = builder.where('spaceRev', '>', opts.cursor)
    }
    return builder.execute()
  }

  async getCredentialRecipients(
    space: SpaceRefString,
  ): Promise<
    { service: string; serviceEndpoint: string; expiresAt: string }[]
  > {
    return this.db.db
      .selectFrom('space_credential_recipient')
      .select(['service', 'serviceEndpoint', 'expiresAt'])
      .where('space', '=', space)
      .where('expiresAt', '>', new Date().toISOString())
      .execute()
  }
}

// Everything but `value`, which the list reads select conditionally.
const RECORD_COLUMNS = [
  'uri',
  'space',
  'collection',
  'rkey',
  'cid',
  'repoRev',
  'indexedAt',
] as const
