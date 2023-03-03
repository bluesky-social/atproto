import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/uri'
import * as common from '@atproto/common'
import DatabaseSchema from '../../../db/database-schema'
import { Message } from '../../../event-stream/messages'
import { lexicons } from '../../../lexicon/lexicons'
import { WriteOpAction } from '@atproto/repo'

type RecordProcessorParams<T, S> = {
  lexId: string
  indexFn: (
    db: DatabaseSchema,
    uri: AtUri,
    cid: CID,
    obj: T,
    timestamp: string,
  ) => Promise<S | null>
  findDuplicate: (
    db: DatabaseSchema,
    uri: AtUri,
    obj: T,
  ) => Promise<AtUri | null>
  deleteFn: (db: DatabaseSchema, uri: AtUri) => Promise<S | null>
  eventsForIndex: (obj: S) => Message[]
  eventsForDelete: (prev: S, replacedBy: S | null) => Message[]
}

export class RecordProcessor<T, S> {
  collection: string
  constructor(
    private db: DatabaseSchema,
    private params: RecordProcessorParams<T, S>,
  ) {
    this.collection = this.params.lexId
  }

  matchesSchema(obj: unknown): obj is T {
    try {
      this.assertValidRecord(obj)
      return true
    } catch {
      return false
    }
  }

  assertValidRecord(obj: unknown): void {
    lexicons.assertValidRecord(this.params.lexId, obj)
  }

  async indexRecord(
    uri: AtUri,
    cid: CID,
    obj: unknown,
    action: WriteOpAction.Create | WriteOpAction.Update,
    timestamp: string,
  ): Promise<Message[]> {
    if (!this.matchesSchema(obj)) {
      throw new Error(`Record does not match schema: ${this.params.lexId}`)
    }
    // @TODO distinguish indexing w/ conflict on uri vs unique key
    const indexed = await this.params.indexFn(this.db, uri, cid, obj, timestamp)
    // if this was a new record, return events
    if (indexed) {
      // @TODO
      return this.params.eventsForIndex(indexed)
    }
    // if duplicate, insert into duplicates table with no events
    const found = await this.params.findDuplicate(this.db, uri, obj)
    if (found?.toString() === uri.toString()) {
      return []
    }
    if (found) {
      const dupe = {
        uri: uri.toString(),
        cid: cid.toString(),
        duplicateOf: found.toString(),
        indexedAt: timestamp,
      }
      await this.db
        .insertInto('duplicate_record')
        .values(dupe)
        .onConflict((oc) => oc.doUpdateSet(dupe))
        .execute()
    } else {
      await this.db
        .deleteFrom('duplicate_record')
        .where('uri', '=', uri.toString())
        .execute()
    }
    return []
  }

  async deleteRecord(uri: AtUri, cascading = false): Promise<Message[]> {
    const deleted = await this.params.deleteFn(this.db, uri)
    if (!deleted) return []
    if (cascading) {
      await this.db
        .deleteFrom('duplicate_record')
        .where('duplicateOf', '=', uri.toString())
        .execute()
      return this.params.eventsForDelete(deleted, null)
    } else {
      const found = await this.db
        .selectFrom('duplicate_record')
        // @TODO remove ipld_block dependency from app-view
        .innerJoin('ipld_block', (join) =>
          join
            .onRef('ipld_block.cid', '=', 'duplicate_record.cid')
            .on('ipld_block.creator', '=', uri.host),
        )
        .where('duplicateOf', '=', uri.toString())
        .orderBy('duplicate_record.indexedAt', 'asc')
        .limit(1)
        .selectAll()
        .executeTakeFirst()

      if (!found) {
        return this.params.eventsForDelete(deleted, null)
      }
      const record = common.cborDecode(found.content)
      if (!this.matchesSchema(record)) {
        return this.params.eventsForDelete(deleted, null)
      }
      const indexed = await this.params.indexFn(
        this.db,
        new AtUri(found.uri),
        CID.parse(found.cid),
        record,
        found.indexedAt,
      )
      return this.params.eventsForDelete(deleted, indexed)
    }
  }
}

export default RecordProcessor
