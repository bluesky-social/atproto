import { LexMap } from '@atproto/lex-data'
import { cborToLexRecord } from '@atproto/repo'
import { ActorDb } from '../db'

export class SpaceReader {
  constructor(public db: ActorDb) {}

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
    collection: string,
    opts: { limit: number; cursor?: string; reverse?: boolean },
  ): Promise<{ rkey: string; cid: string }[]> {
    const { limit, cursor, reverse } = opts
    let builder = this.db.db
      .selectFrom('space_record')
      .select(['rkey', 'cid'])
      .where('space', '=', space)
      .where('collection', '=', collection)
      .orderBy('rkey', reverse ? 'asc' : 'desc')
      .limit(limit)
    if (cursor !== undefined) {
      if (reverse) {
        builder = builder.where('rkey', '>', cursor)
      } else {
        builder = builder.where('rkey', '<', cursor)
      }
    }
    const rows = await builder.execute()
    return rows.map((r) => ({ rkey: r.rkey, cid: r.cid }))
  }

  async getSetHash(space: string): Promise<Buffer | null> {
    const row = await this.db.db
      .selectFrom('space_root')
      .select('setHash')
      .where('space', '=', space)
      .executeTakeFirst()
    return row ? Buffer.from(row.setHash) : null
  }

  async getRev(space: string): Promise<string | null> {
    const row = await this.db.db
      .selectFrom('space_root')
      .select('rev')
      .where('space', '=', space)
      .executeTakeFirst()
    return row?.rev ?? null
  }
}
