import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import { Database } from '../db'
import { DatabaseSchema } from '../db/database-schema'

type RecordProcessorParams<T, S> = {
  lexId: string
  validate: (obj: unknown) => void
  insertFn: (
    db: DatabaseSchema,
    uri: AtUri,
    cid: CID,
    obj: T,
    timestamp: string,
  ) => Promise<S | null>
  deleteFn: (db: DatabaseSchema, uri: AtUri) => Promise<S | null>
  updateAggregates?: (db: DatabaseSchema, obj: S) => Promise<void>
}

export class RecordProcessor<T, S> {
  collection: string
  db: DatabaseSchema

  constructor(
    db: Database,
    private params: RecordProcessorParams<T, S>,
  ) {
    this.db = db.db
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

  assertValidRecord(obj: unknown): asserts obj is T {
    this.params.validate(obj)
  }

  async insertRecord(uri: AtUri, cid: CID, obj: unknown, timestamp: string) {
    this.assertValidRecord(obj)
    const inserted = await this.params.insertFn(
      this.db,
      uri,
      cid,
      obj,
      timestamp,
    )
    if (inserted && this.params.updateAggregates) {
      await this.params.updateAggregates(this.db, inserted)
    }
  }

  async updateRecord(uri: AtUri, cid: CID, obj: unknown, timestamp: string) {
    this.assertValidRecord(obj)
    const deleted = await this.params.deleteFn(this.db, uri)
    if (!deleted) {
      return this.insertRecord(uri, cid, obj, timestamp)
    }
    if (this.params.updateAggregates) {
      await this.params.updateAggregates(this.db, deleted)
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
    if (this.params.updateAggregates) {
      await this.params.updateAggregates(this.db, inserted)
    }
  }

  async deleteRecord(uri: AtUri) {
    const deleted = await this.params.deleteFn(this.db, uri)
    if (!deleted) return
    if (this.params.updateAggregates) {
      await this.params.updateAggregates(this.db, deleted)
    }
  }
}
