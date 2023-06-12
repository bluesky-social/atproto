import { sql } from 'kysely'
import { CID } from 'multiformats/cid'
import AtpAgent, { ComAtprotoSyncGetHead } from '@atproto/api'
import {
  MemoryBlockstore,
  readCarWithRoot,
  WriteOpAction,
  verifyCheckoutWithCids,
  RepoContentsWithCids,
  Commit,
} from '@atproto/repo'
import { AtUri } from '@atproto/uri'
import { IdResolver, getPds } from '@atproto/identity'
import { chunkArray } from '@atproto/common'
import { ValidationError } from '@atproto/lexicon'
import Database from '../../db'
import * as Post from './plugins/post'
import * as Like from './plugins/like'
import * as Repost from './plugins/repost'
import * as Follow from './plugins/follow'
import * as Profile from './plugins/profile'
import * as List from './plugins/list'
import * as ListItem from './plugins/list-item'
import * as Block from './plugins/block'
import * as FeedGenerator from './plugins/feed-generator'
import RecordProcessor from './processor'
import { subLogger } from '../../logger'
import { retryHttp } from '../../util/retry'
import { Labeler } from '../../labeler'
import { BackgroundQueue } from '../../background'

export class IndexingService {
  records: {
    post: Post.PluginType
    like: Like.PluginType
    repost: Repost.PluginType
    follow: Follow.PluginType
    profile: Profile.PluginType
    list: List.PluginType
    listItem: ListItem.PluginType
    block: Block.PluginType
    feedGenerator: FeedGenerator.PluginType
  }

  constructor(
    public db: Database,
    public idResolver: IdResolver,
    public labeler: Labeler,
    public backgroundQueue: BackgroundQueue,
  ) {
    this.records = {
      post: Post.makePlugin(this.db, backgroundQueue),
      like: Like.makePlugin(this.db, backgroundQueue),
      repost: Repost.makePlugin(this.db, backgroundQueue),
      follow: Follow.makePlugin(this.db, backgroundQueue),
      profile: Profile.makePlugin(this.db, backgroundQueue),
      list: List.makePlugin(this.db, backgroundQueue),
      listItem: ListItem.makePlugin(this.db, backgroundQueue),
      block: Block.makePlugin(this.db, backgroundQueue),
      feedGenerator: FeedGenerator.makePlugin(this.db, backgroundQueue),
    }
  }

  transact(txn: Database) {
    txn.assertTransaction()
    return new IndexingService(
      txn,
      this.idResolver,
      this.labeler,
      this.backgroundQueue,
    )
  }

  static creator(
    idResolver: IdResolver,
    labeler: Labeler,
    backgroundQueue: BackgroundQueue,
  ) {
    return (db: Database) =>
      new IndexingService(db, idResolver, labeler, backgroundQueue)
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
    this.labeler.processRecord(uri, obj)
  }

  async deleteRecord(uri: AtUri, cascading = false) {
    this.db.assertNotTransaction()
    await this.db.transaction(async (txn) => {
      const indexingTx = this.transact(txn)
      const indexer = indexingTx.findIndexerForCollection(uri.collection)
      if (!indexer) return
      await indexer.deleteRecord(uri, cascading)
    })
  }

  async indexHandle(did: string, timestamp: string, force = false) {
    this.db.assertNotTransaction()
    const actor = await this.db.db
      .selectFrom('actor')
      .where('did', '=', did)
      .selectAll()
      .executeTakeFirst()
    if (actor && !force) {
      return
    }
    const { handle } = await this.idResolver.did.resolveAtprotoData(did, true)
    const handleToDid = await this.idResolver.handle.resolve(handle)
    if (did !== handleToDid) {
      return // No bidirectional link between did and handle
    }
    const actorInfo = { handle, indexedAt: timestamp }
    const inserted = await this.db.db
      .insertInto('actor')
      .values({ did, ...actorInfo })
      .onConflict((oc) => oc.doNothing())
      .returning('did')
      .executeTakeFirst()
    if (!inserted) {
      await this.db.db
        .updateTable('actor')
        .set(actorInfo)
        .where('did', '=', did)
        .execute()
    }
  }

  async indexRepo(did: string, commit: string) {
    this.db.assertNotTransaction()
    const now = new Date().toISOString()
    const { pds, signingKey } = await this.idResolver.did.resolveAtprotoData(
      did,
      true,
    )
    const { api } = new AtpAgent({ service: pds })

    const { data: car } = await retryHttp(() =>
      api.com.atproto.sync.getCheckout({ did, commit }),
    )
    const { root, blocks } = await readCarWithRoot(car)
    const storage = new MemoryBlockstore(blocks)
    const checkout = await verifyCheckoutWithCids(
      storage,
      root,
      did,
      signingKey,
    )

    // Wipe index for actor, prep for reindexing
    await this.unindexActor(did)

    // Iterate over all records and index them in batches
    const contentList = [...walkContentsWithCids(checkout.contents)]
    const chunks = chunkArray(contentList, 100)

    for (const chunk of chunks) {
      const processChunk = chunk.map(async (item) => {
        const { cid, collection, rkey, record } = item
        const uri = AtUri.make(did, collection, rkey)
        try {
          await this.indexRecord(uri, cid, record, WriteOpAction.Create, now)
        } catch (err) {
          if (err instanceof ValidationError) {
            subLogger.warn(
              { did, commit, uri: uri.toString(), cid: cid.toString() },
              'skipping indexing of invalid record',
            )
          } else {
            throw err
          }
        }
      })
      await Promise.all(processChunk)
    }
  }

  async setCommitLastSeen(
    commit: Commit,
    details: { commit: CID; rebase: boolean; tooBig: boolean },
  ) {
    const { ref } = this.db.db.dynamic
    await this.db.db
      .insertInto('actor_sync')
      .values({
        did: commit.did,
        commitCid: details.commit.toString(),
        commitDataCid: commit.data.toString(),
        rebaseCount: details.rebase ? 1 : 0,
        tooBigCount: details.tooBig ? 1 : 0,
      })
      .onConflict((oc) => {
        const sync = (col: string) => ref(`actor_sync.${col}`)
        const excluded = (col: string) => ref(`excluded.${col}`)
        return oc.column('did').doUpdateSet({
          commitCid: sql`${excluded('commitCid')}`,
          commitDataCid: sql`${excluded('commitDataCid')}`,
          rebaseCount: sql`${sync('rebaseCount')} + ${excluded('rebaseCount')}`,
          tooBigCount: sql`${sync('tooBigCount')} + ${excluded('tooBigCount')}`,
        })
      })
      .execute()
  }

  async checkCommitNeedsIndexing(commit: Commit) {
    const sync = await this.db.db
      .selectFrom('actor_sync')
      .select('commitDataCid')
      .where('did', '=', commit.did)
      .executeTakeFirst()
    if (!sync) return true
    return sync.commitDataCid !== commit.data.toString()
  }

  findIndexerForCollection(collection: string) {
    const indexers = Object.values(
      this.records as Record<string, RecordProcessor<unknown, unknown>>,
    )
    return indexers.find((indexer) => indexer.collection === collection)
  }

  async tombstoneActor(did: string) {
    this.db.assertNotTransaction()
    const actorIsHosted = await this.getActorIsHosted(did)
    if (actorIsHosted === false) {
      await this.db.db.deleteFrom('actor').where('did', '=', did).execute()
      await this.unindexActor(did)
      await this.db.db
        .deleteFrom('notification')
        .where('did', '=', did)
        .execute()
    }
  }

  private async getActorIsHosted(did: string) {
    const doc = await this.idResolver.did.resolve(did, true)
    const pds = doc && getPds(doc)
    if (!pds) return false
    const { api } = new AtpAgent({ service: pds })
    try {
      await retryHttp(() => api.com.atproto.sync.getHead({ did }))
      return true
    } catch (err) {
      if (err instanceof ComAtprotoSyncGetHead.HeadNotFoundError) {
        return false
      }
      return null
    }
  }

  async unindexActor(did: string) {
    this.db.assertNotTransaction()
    // per-record-type indexes
    await this.db.db.deleteFrom('profile').where('creator', '=', did).execute()
    await this.db.db.deleteFrom('follow').where('creator', '=', did).execute()
    await this.db.db.deleteFrom('repost').where('creator', '=', did).execute()
    await this.db.db.deleteFrom('like').where('creator', '=', did).execute()
    await this.db.db
      .deleteFrom('feed_generator')
      .where('creator', '=', did)
      .execute()
    // lists
    await this.db.db
      .deleteFrom('list_item')
      .where('creator', '=', did)
      .execute()
    await this.db.db.deleteFrom('list').where('creator', '=', did).execute()
    // blocks
    await this.db.db
      .deleteFrom('actor_block')
      .where('creator', '=', did)
      .execute()
    // posts
    const postByUser = (qb) =>
      qb
        .selectFrom('post')
        .where('post.creator', '=', did)
        .select('post.uri as uri')
    await this.db.db
      .deleteFrom('post_embed_image')
      .where('post_embed_image.postUri', 'in', postByUser)
      .execute()
    await this.db.db
      .deleteFrom('post_embed_external')
      .where('post_embed_external.postUri', 'in', postByUser)
      .execute()
    await this.db.db
      .deleteFrom('post_embed_record')
      .where('post_embed_record.postUri', 'in', postByUser)
      .execute()
    await this.db.db.deleteFrom('post').where('creator', '=', did).execute()
    // notifications
    await this.db.db
      .deleteFrom('notification')
      .where('notification.author', '=', did)
      .execute()
    // generic record indexes
    await this.db.db
      .deleteFrom('duplicate_record')
      .where('duplicate_record.duplicateOf', 'in', (qb) =>
        qb
          .selectFrom('record')
          .where('record.did', '=', did)
          .select('record.uri as uri'),
      )
      .execute()
    await this.db.db.deleteFrom('record').where('did', '=', did).execute()
  }
}

function* walkContentsWithCids(contents: RepoContentsWithCids) {
  for (const collection of Object.keys(contents)) {
    for (const rkey of Object.keys(contents[collection])) {
      const { cid, value } = contents[collection][rkey]
      yield { collection, rkey, cid, record: value }
    }
  }
}
