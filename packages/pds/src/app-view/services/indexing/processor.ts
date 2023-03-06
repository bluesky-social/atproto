import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/uri'
import * as common from '@atproto/common'
import DatabaseSchema from '../../../db/database-schema'
import { Message } from '../../../event-stream/messages'
import { lexicons } from '../../../lexicon/lexicons'

// @NOTE re: insertions and deletions. Due to how record updates are handled,
// (insertFn) should have the same effect as (insertFn -> deleteFn -> insertFn).
type RecordProcessorParams<T, S> = {
  lexId: string
  insertFn: (
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
  eventsForInsert: (obj: S) => Message[]
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

  async insertRecord(
    uri: AtUri,
    cid: CID,
    obj: unknown,
    timestamp: string,
  ): Promise<Message[]> {
    if (!this.matchesSchema(obj)) {
      throw new Error(`Record does not match schema: ${this.params.lexId}`)
    }
    const inserted = await this.params.insertFn(
      this.db,
      uri,
      cid,
      obj,
      timestamp,
    )
    // if this was a new record, return events
    if (inserted) {
      return this.params.eventsForInsert(inserted)
    }
    // if duplicate, insert into duplicates table with no events
    const found = await this.params.findDuplicate(this.db, uri, obj)
    if (found && found.toString() !== uri.toString()) {
      await this.db
        .insertInto('duplicate_record')
        .values({
          uri: uri.toString(),
          cid: cid.toString(),
          duplicateOf: found.toString(),
          indexedAt: timestamp,
        })
        .onConflict((oc) => oc.doNothing())
        .execute()
    }
    return []
  }

  // Currently using a very simple strategy for updates: purge the existing index
  // for the uri then replace it. The main upside is that this allows the indexer
  // for each collection to avoid bespoke logic for in-place updates, which isn't
  // straightforward in the general case. We still get nice control over notifications.
  async updateRecord(
    uri: AtUri,
    cid: CID,
    obj: unknown,
    timestamp: string,
  ): Promise<Message[]> {
    if (!this.matchesSchema(obj)) {
      throw new Error(`Record does not match schema: ${this.params.lexId}`)
    }

    // If the updated record was a dupe, update dupe info for it
    const dupe = await this.params.findDuplicate(this.db, uri, obj)
    if (dupe) {
      await this.db
        .updateTable('duplicate_record')
        .where('uri', '=', uri.toString())
        .set({
          cid: cid.toString(),
          duplicateOf: dupe.toString(),
          indexedAt: timestamp,
        })
        .execute()
    } else {
      await this.db
        .deleteFrom('duplicate_record')
        .where('uri', '=', uri.toString())
        .execute()
    }

    const deleted = await this.params.deleteFn(this.db, uri)
    if (!deleted) {
      // If a record was updated but hadn't been indexed yet, treat it like a plain insert.
      return this.insertRecord(uri, cid, obj, timestamp)
    }
    const inserted = await this.params.insertFn(
      this.db,
      uri,
      cid,
      obj,
      timestamp,
    )
    if (!inserted) {
      throw new Error(
        'Record update failed: removed from index but could not be replaced',
      )
    }
    return this.params.eventsForDelete(deleted, inserted)
  }

  async deleteRecord(uri: AtUri, cascading = false): Promise<Message[]> {
    await this.db
      .deleteFrom('duplicate_record')
      .where('uri', '=', uri.toString())
      .execute()
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
      const inserted = await this.params.insertFn(
        this.db,
        new AtUri(found.uri),
        CID.parse(found.cid),
        record,
        found.indexedAt,
      )
      return this.params.eventsForDelete(deleted, inserted)
    }
  }
}

export default RecordProcessor
