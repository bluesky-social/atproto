import { Selectable } from 'kysely'
import { CID } from 'multiformats/cid'
import { DAY, HOUR } from '@atproto/common'
import { IdResolver } from '@atproto/identity'
import { WriteOpAction } from '@atproto/repo'
import { AtUri } from '@atproto/syntax'
import { Database } from '../db'
import { Actor } from '../db/tables/actor'
import * as Follow from './plugins/follow'
import * as Like from './plugins/like'
import * as Post from './plugins/post'
import * as Profile from './plugins/profile'
import { RecordProcessor } from './processor'

export class IndexingService {
  records: {
    post: Post.PluginType
    like: Like.PluginType
    follow: Follow.PluginType
    profile: Profile.PluginType
  }

  constructor(
    public db: Database,
    public idResolver: IdResolver,
  ) {
    this.records = {
      post: Post.makePlugin(this.db),
      like: Like.makePlugin(this.db),
      follow: Follow.makePlugin(this.db),
      profile: Profile.makePlugin(this.db),
    }
  }

  transact(txn: Database) {
    txn.assertTransaction()
    return new IndexingService(txn, this.idResolver)
  }

  async indexRecord(
    uri: AtUri,
    cid: CID,
    obj: unknown,
    action: WriteOpAction.Create | WriteOpAction.Update,
    timestamp: string,
  ) {
    this.db.assertNotTransaction()
    await this.db.transaction(async (txn) => {
      const indexingTx = this.transact(txn)
      const indexer = indexingTx.findIndexerForCollection(uri.collection)
      if (!indexer) return
      if (action === WriteOpAction.Create) {
        await indexer.insertRecord(uri, cid, obj, timestamp)
      } else {
        await indexer.updateRecord(uri, cid, obj, timestamp)
      }
    })
  }

  async deleteRecord(uri: AtUri) {
    this.db.assertNotTransaction()
    await this.db.transaction(async (txn) => {
      const indexingTx = this.transact(txn)
      const indexer = indexingTx.findIndexerForCollection(uri.collection)
      if (!indexer) return
      await indexer.deleteRecord(uri)
    })
  }

  async indexHandle(did: string, timestamp: string, force = false) {
    this.db.assertNotTransaction()
    const actor = await this.db.db
      .selectFrom('actor')
      .where('did', '=', did)
      .selectAll()
      .executeTakeFirst()
    if (!force && !needsHandleReindex(actor, timestamp)) {
      return
    }
    const atpData = await this.idResolver.did.resolveAtprotoData(did, true)
    const handleToDid = await this.idResolver.handle.resolve(atpData.handle)

    const handle: string | null =
      did === handleToDid ? atpData.handle.toLowerCase() : null

    const actorWithHandle =
      handle !== null
        ? await this.db.db
            .selectFrom('actor')
            .where('handle', '=', handle)
            .selectAll()
            .executeTakeFirst()
        : null

    if (handle && actorWithHandle && did !== actorWithHandle.did) {
      await this.db.db
        .updateTable('actor')
        .where('actor.did', '=', actorWithHandle.did)
        .set({ handle: null })
        .execute()
    }

    const actorInfo = {
      handle,
      pdsEndpoint: atpData.pds,
      indexedAt: timestamp,
    }
    await this.db.db
      .insertInto('actor')
      .values({ did, ...actorInfo })
      .onConflict((oc) => oc.column('did').doUpdateSet(actorInfo))
      .execute()
  }

  async updateActorStatus(did: string, active: boolean, status = '') {
    let upstreamStatus: string
    if (active) {
      upstreamStatus = 'active'
    } else if (['deactivated', 'suspended', 'takendown'].includes(status)) {
      upstreamStatus = status
    } else {
      throw new Error(`Unrecognized account status: ${status}`)
    }
    await this.db.db
      .updateTable('actor')
      .set({ upstreamStatus })
      .where('did', '=', did)
      .execute()
  }

  async deleteActor(did: string) {
    this.db.assertNotTransaction()
    await this.unindexActor(did)
    await this.db.db.deleteFrom('actor').where('did', '=', did).execute()
  }

  async unindexActor(did: string) {
    this.db.assertNotTransaction()
    await this.db.db
      .deleteFrom('like')
      .where('subject', 'like', `at://${did}/%`)
      .execute()
    await this.db.db.deleteFrom('post').where('creator', '=', did).execute()
    await this.db.db.deleteFrom('follow').where('creator', '=', did).execute()
    await this.db.db
      .deleteFrom('follow')
      .where('subjectDid', '=', did)
      .execute()
    await this.db.db.deleteFrom('like').where('creator', '=', did).execute()
  }

  findIndexerForCollection(collection: string) {
    const indexers = Object.values(
      this.records as Record<string, RecordProcessor<unknown, unknown>>,
    )
    return indexers.find((indexer) => indexer.collection === collection)
  }
}

const needsHandleReindex = (
  actor: Selectable<Actor> | undefined,
  timestamp: string,
) => {
  if (!actor) return true
  const timeDiff =
    new Date(timestamp).getTime() - new Date(actor.indexedAt).getTime()
  if (timeDiff > DAY) return true
  if (actor.handle === null && timeDiff > HOUR) return true
  return false
}
