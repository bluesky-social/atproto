import { LexMap } from '@atproto/lex-data'
import { cborToLexRecord } from '@atproto/repo'
import { InvalidRequestError } from '@atproto/xrpc-server'
import {
  ActorDb,
  SimplespaceConfig,
  Space,
  SpaceRecord,
  SpaceRecordOplog,
  SpaceRepo,
  SpaceWriter,
} from '../db/index.js'

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

  async getSpaceConfig(uri: string): Promise<SimplespaceConfig | null> {
    const row = await this.db.db
      .selectFrom('simplespace_config')
      .selectAll()
      .where('uri', '=', uri)
      .executeTakeFirst()
    return row ?? null
  }

  async getActiveSpaceConfig(uri: string): Promise<SimplespaceConfig> {
    const space = await this.getSpace(uri)
    const config = await this.getSpaceConfig(uri)
    if (!space || space.deletedAt || !config) {
      throw new InvalidRequestError('Space not found', 'SpaceNotFound')
    }
    return config
  }

  async listSpaces(opts: {
    limit: number
    cursor?: string
    type?: string
    authority?: string
  }): Promise<Space[]> {
    const { limit, cursor, type, authority } = opts
    let builder = this.db.db
      .selectFrom('space')
      .selectAll()
      .where('deletedAt', 'is', null)
      .orderBy('uri', 'asc')
      .limit(limit)
    if (authority) {
      builder = builder.where('authority', '=', authority)
    }
    if (type) {
      builder = builder.where('type', '=', type)
    }
    if (cursor) {
      builder = builder.where('uri', '>', cursor)
    }
    return builder.execute()
  }

  async getRecord(
    uri: string,
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

  async hasRecord(uri: string): Promise<boolean> {
    const row = await this.db.db
      .selectFrom('space_record')
      .select('uri')
      .where('uri', '=', uri)
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
      excludeValues?: boolean
    },
  ): Promise<(Omit<SpaceRecord, 'value'> & { value?: LexMap })[]> {
    const { limit, cursor, reverse, collection, excludeValues } = opts
    let builder = this.db.db
      .selectFrom('space_record')
      .select(RECORD_COLUMNS)
      .where('space', '=', space)
      .orderBy('uri', reverse ? 'asc' : 'desc')
      .limit(limit)
      .$if(!excludeValues, (qb) => qb.select('value'))
    if (collection) {
      builder = builder.where('collection', '=', collection)
    }
    if (cursor) {
      builder = builder.where('uri', reverse ? '>' : '<', cursor)
    }
    const rows = await builder.execute()
    return rows.map((row) => ({
      ...row,
      value: row.value && cborToLexRecord(row.value),
    }))
  }

  async *streamRecords(
    space: string,
    opts: { excludeValues?: boolean } = {},
  ): AsyncGenerator<Omit<SpaceRecord, 'value'> & { value?: Uint8Array }> {
    let cursor: string | undefined
    while (true) {
      let builder = this.db.db
        .selectFrom('space_record')
        .select(RECORD_COLUMNS)
        .where('space', '=', space)
        .orderBy('uri', 'asc')
        .limit(500)
        .$if(!opts.excludeValues, (qb) => qb.select('value'))
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
    space: string,
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

  async getRepoState(space: string): Promise<SpaceRepo | null> {
    const row = await this.db.db
      .selectFrom('space_repo')
      .selectAll()
      .where('space', '=', space)
      .executeTakeFirst()
    return row ?? null
  }

  async listBlobs(
    space: string,
    opts: { limit: number; since?: string; cursor?: string },
  ): Promise<string[]> {
    const { limit, since, cursor } = opts
    let builder = this.db.db
      .selectFrom('space_record_blob')
      .innerJoin('space_record', 'space_record.uri', 'recordUri')
      .select('blobCid')
      .where('space_record.space', '=', space)
      .groupBy('blobCid')
      .orderBy('blobCid', 'asc')
      .limit(limit)
    if (since) {
      builder = builder.where('space_record.repoRev', '>', since)
    }
    if (cursor) {
      builder = builder.where('blobCid', '>', cursor)
    }
    const rows = await builder.execute()
    return rows.map((row) => row.blobCid)
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

  async listMembers(
    space: string,
    opts: { limit: number; cursor?: string },
  ): Promise<{ did: string }[]> {
    let builder = this.db.db
      .selectFrom('simplespace_member')
      .select('did')
      .where('space', '=', space)
      .orderBy('did', 'asc')
      .limit(opts.limit)
    if (opts.cursor) {
      builder = builder.where('did', '>', opts.cursor)
    }
    return builder.execute()
  }

  async listWriters(
    space: string,
    opts: { limit?: number; cursor?: string } = {},
  ): Promise<SpaceWriter[]> {
    let builder = this.db.db
      .selectFrom('space_writer')
      .selectAll()
      .where('space', '=', space)
      .orderBy('did', 'asc')
    if (opts.limit) {
      builder = builder.limit(opts.limit)
    }
    if (opts.cursor) {
      builder = builder.where('did', '>', opts.cursor)
    }
    return builder.execute()
  }

  async getCredentialRecipients(
    space: string,
  ): Promise<{ serviceDid: string; serviceEndpoint: string }[]> {
    return this.db.db
      .selectFrom('space_credential_recipient')
      .select(['serviceDid', 'serviceEndpoint'])
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
