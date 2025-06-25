import { Insertable } from 'kysely'
import { CID } from 'multiformats/cid'
import { chunkArray } from '@atproto/common'
import { jsonStringToLex, stringifyLex } from '@atproto/lexicon'
import { AtUri } from '@atproto/syntax'
import { lexicons } from '../../../lexicon/lexicons'
import { BackgroundQueue } from '../background'
import { Database } from '../db'
import { DatabaseSchema } from '../db/database-schema'
import { Notification } from '../db/tables/notification'

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
  notifsForInsert: (obj: S) => Notif[]
  notifsForDelete: (
    prev: S,
    replacedBy: S | null,
  ) => { notifs: Notif[]; toDelete: string[] }
  updateAggregates?: (db: DatabaseSchema, obj: S) => Promise<void>
}

type Notif = Insertable<Notification>

export class RecordProcessor<T, S> {
  collection: string
  db: DatabaseSchema
  constructor(
    private appDb: Database,
    private background: BackgroundQueue,
    private params: RecordProcessorParams<T, S>,
  ) {
    this.db = appDb.db
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
    lexicons.assertValidRecord(this.params.lexId, obj)
  }

  async insertRecord(
    uri: AtUri,
    cid: CID,
    obj: unknown,
    timestamp: string,
    opts?: { disableNotifs?: boolean },
  ) {
    this.assertValidRecord(obj)
    await this.db
      .insertInto('record')
      .values({
        uri: uri.toString(),
        cid: cid.toString(),
        did: uri.host,
        json: stringifyLex(obj),
        indexedAt: timestamp,
      })
      .onConflict((oc) => oc.doNothing())
      .execute()
    const inserted = await this.params.insertFn(
      this.db,
      uri,
      cid,
      obj,
      timestamp,
    )
    if (inserted) {
      this.aggregateOnCommit(inserted)
      if (!opts?.disableNotifs) {
        await this.handleNotifs({ inserted })
      }
      return
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
    opts?: { disableNotifs?: boolean },
  ) {
    this.assertValidRecord(obj)
    await this.db
      .updateTable('record')
      .where('uri', '=', uri.toString())
      .set({
        cid: cid.toString(),
        json: stringifyLex(obj),
        indexedAt: timestamp,
      })
      .execute()
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
    this.aggregateOnCommit(deleted)
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
    this.aggregateOnCommit(inserted)
    if (!opts?.disableNotifs) {
      await this.handleNotifs({ inserted, deleted })
    }
  }

  async deleteRecord(uri: AtUri, cascading = false) {
    await this.db
      .deleteFrom('record')
      .where('uri', '=', uri.toString())
      .execute()
    await this.db
      .deleteFrom('duplicate_record')
      .where('uri', '=', uri.toString())
      .execute()
    const deleted = await this.params.deleteFn(this.db, uri)
    if (!deleted) return
    this.aggregateOnCommit(deleted)
    if (cascading) {
      await this.db
        .deleteFrom('duplicate_record')
        .where('duplicateOf', '=', uri.toString())
        .execute()
      return this.handleNotifs({ deleted })
    } else {
      const found = await this.db
        .selectFrom('duplicate_record')
        .innerJoin('record', 'record.uri', 'duplicate_record.uri')
        .where('duplicateOf', '=', uri.toString())
        .orderBy('duplicate_record.indexedAt', 'asc')
        .limit(1)
        .selectAll()
        .executeTakeFirst()

      if (!found) {
        return this.handleNotifs({ deleted })
      }
      const record = jsonStringToLex(found.json)
      if (!this.matchesSchema(record)) {
        return this.handleNotifs({ deleted })
      }
      const inserted = await this.params.insertFn(
        this.db,
        new AtUri(found.uri),
        CID.parse(found.cid),
        record,
        found.indexedAt,
      )
      if (inserted) {
        this.aggregateOnCommit(inserted)
      }
      await this.handleNotifs({ deleted, inserted: inserted ?? undefined })
    }
  }

  async handleNotifs(op: { deleted?: S; inserted?: S }) {
    let notifs: Notif[] = []
    const runOnCommit: ((db: Database) => Promise<void>)[] = []
    if (op.deleted) {
      const forDelete = this.params.notifsForDelete(
        op.deleted,
        op.inserted ?? null,
      )
      if (forDelete.toDelete.length > 0) {
        // Notifs can be deleted in background: they are expensive to delete and
        // listNotifications already excludes notifs with missing records.
        runOnCommit.push(async (db) => {
          await db.db
            .deleteFrom('notification')
            .where('recordUri', 'in', forDelete.toDelete)
            .execute()
        })
      }
      notifs = forDelete.notifs
    } else if (op.inserted) {
      notifs = this.params.notifsForInsert(op.inserted)
    }
    for (const chunk of chunkArray(notifs, 500)) {
      runOnCommit.push(async (db) => {
        const filtered = await this.filterNotifsForThreadMutes(chunk)
        await db.db.insertInto('notification').values(filtered).execute()
      })
    }
    // Need to ensure notif deletion always happens before creation, otherwise delete may clobber in a race.
    for (const fn of runOnCommit) {
      await fn(this.appDb) // these could be backgrounded
    }
  }

  async filterNotifsForThreadMutes(notifs: Notif[]): Promise<Notif[]> {
    const isBlocked = await Promise.all(
      notifs.map((n) => this.isNotifBlockedByThreadMute(n)),
    )
    return notifs.filter((_, i) => !isBlocked[i])
  }

  async isNotifBlockedByThreadMute(notif: Notif): Promise<boolean> {
    const subject = notif.reasonSubject
    if (!subject) return false
    if (subject.startsWith('did:')) return false
    const post = await this.db
      .selectFrom('post')
      .select(['uri', 'replyRoot'])
      .where('uri', '=', subject)
      .executeTakeFirst()
    if (!post) return false
    const threadRoot = post.replyRoot ?? post.uri
    const threadMute = await this.db
      .selectFrom('thread_mute')
      .selectAll()
      .where('mutedByDid', '=', notif.did)
      .where('rootUri', '=', threadRoot)
      .executeTakeFirst()
    return !!threadMute
  }

  aggregateOnCommit(indexed: S) {
    const { updateAggregates } = this.params
    if (!updateAggregates) return
    this.appDb.onCommit(() => {
      this.background.add((db) => updateAggregates(db.db, indexed))
    })
  }
}

export default RecordProcessor
