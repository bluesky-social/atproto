import { sql } from 'kysely'
import { CID } from 'multiformats/cid'
import AtpAgent, { ComAtprotoSyncGetLatestCommit } from '@atproto/api'
import {
  readCarWithRoot,
  WriteOpAction,
  verifyRepo,
  Commit,
  VerifiedRepo,
} from '@atproto/repo'
import { AtUri } from '@atproto/syntax'
import { IdResolver, getPds } from '@atproto/identity'
import { DAY, HOUR } from '@atproto/common'
import { ValidationError } from '@atproto/lexicon'
import { PrimaryDatabase } from '../../db'
import * as Post from './plugins/post'
import * as Like from './plugins/like'
import * as Repost from './plugins/repost'
import * as Follow from './plugins/follow'
import * as Profile from './plugins/profile'
import * as List from './plugins/list'
import * as ListItem from './plugins/list-item'
import * as ListBlock from './plugins/list-block'
import * as Block from './plugins/block'
import * as FeedGenerator from './plugins/feed-generator'
import RecordProcessor from './processor'
import { subLogger } from '../../logger'
import { retryHttp } from '../../util/retry'
import { BackgroundQueue } from '../../background'
import { NotificationServer } from '../../notifications'
import { AutoModerator } from '../../auto-moderator'
import { Actor } from '../../db/tables/actor'

export class IndexingService {
  records: {
    post: Post.PluginType
    like: Like.PluginType
    repost: Repost.PluginType
    follow: Follow.PluginType
    profile: Profile.PluginType
    list: List.PluginType
    listItem: ListItem.PluginType
    listBlock: ListBlock.PluginType
    block: Block.PluginType
    feedGenerator: FeedGenerator.PluginType
  }

  constructor(
    public db: PrimaryDatabase,
    public idResolver: IdResolver,
    public autoMod: AutoModerator,
    public backgroundQueue: BackgroundQueue,
    public notifServer?: NotificationServer,
  ) {
    this.records = {
      post: Post.makePlugin(this.db, backgroundQueue, notifServer),
      like: Like.makePlugin(this.db, backgroundQueue, notifServer),
      repost: Repost.makePlugin(this.db, backgroundQueue, notifServer),
      follow: Follow.makePlugin(this.db, backgroundQueue, notifServer),
      profile: Profile.makePlugin(this.db, backgroundQueue, notifServer),
      list: List.makePlugin(this.db, backgroundQueue, notifServer),
      listItem: ListItem.makePlugin(this.db, backgroundQueue, notifServer),
      listBlock: ListBlock.makePlugin(this.db, backgroundQueue, notifServer),
      block: Block.makePlugin(this.db, backgroundQueue, notifServer),
      feedGenerator: FeedGenerator.makePlugin(
        this.db,
        backgroundQueue,
        notifServer,
      ),
    }
  }

  transact(txn: PrimaryDatabase) {
    txn.assertTransaction()
    return new IndexingService(
      txn,
      this.idResolver,
      this.autoMod,
      this.backgroundQueue,
      this.notifServer,
    )
  }

  static creator(
    idResolver: IdResolver,
    autoMod: AutoModerator,
    backgroundQueue: BackgroundQueue,
    notifServer?: NotificationServer,
  ) {
    return (db: PrimaryDatabase) =>
      new IndexingService(db, idResolver, autoMod, backgroundQueue, notifServer)
  }

  async indexRecord(
    uri: AtUri,
    cid: CID,
    obj: unknown,
    action: WriteOpAction.Create | WriteOpAction.Update,
    timestamp: string,
    opts?: { disableNotifs?: boolean; disableLabels?: boolean },
  ) {
    this.db.assertNotTransaction()
    await this.db.transaction(async (txn) => {
      const indexingTx = this.transact(txn)
      const indexer = indexingTx.findIndexerForCollection(uri.collection)
      if (!indexer) return
      if (action === WriteOpAction.Create) {
        await indexer.insertRecord(uri, cid, obj, timestamp, opts)
      } else {
        await indexer.updateRecord(uri, cid, obj, timestamp)
      }
    })
    if (!opts?.disableLabels) {
      this.autoMod.processRecord(uri, cid, obj)
    }
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
    if (!force && !needsHandleReindex(actor, timestamp)) {
      return
    }
    const atpData = await this.idResolver.did.resolveAtprotoData(did, true)
    const handleToDid = await this.idResolver.handle.resolve(atpData.handle)

    const handle: string | null =
      did === handleToDid ? atpData.handle.toLowerCase() : null

    if (actor && actor.handle !== handle) {
      const actorWithHandle =
        handle !== null
          ? await this.db.db
              .selectFrom('actor')
              .where('handle', '=', handle)
              .selectAll()
              .executeTakeFirst()
          : null

      // handle contention
      if (handle && actorWithHandle && did !== actorWithHandle.did) {
        await this.db.db
          .updateTable('actor')
          .where('actor.did', '=', actorWithHandle.did)
          .set({ handle: null })
          .execute()
      }
    }

    const actorInfo = { handle, indexedAt: timestamp }
    await this.db.db
      .insertInto('actor')
      .values({ did, ...actorInfo })
      .onConflict((oc) => oc.column('did').doUpdateSet(actorInfo))
      .returning('did')
      .executeTakeFirst()

    if (handle) {
      this.autoMod.processHandle(handle, did)
    }
  }

  async indexRepo(did: string, commit?: string) {
    this.db.assertNotTransaction()
    const now = new Date().toISOString()
    const { pds, signingKey } = await this.idResolver.did.resolveAtprotoData(
      did,
      true,
    )
    const { api } = new AtpAgent({ service: pds })

    const { data: car } = await retryHttp(() =>
      api.com.atproto.sync.getRepo({ did }),
    )
    const { root, blocks } = await readCarWithRoot(car)
    const verifiedRepo = await verifyRepo(blocks, root, did, signingKey)

    const currRecords = await this.getCurrentRecords(did)
    const repoRecords = formatCheckout(did, verifiedRepo)
    const diff = findDiffFromCheckout(currRecords, repoRecords)

    await Promise.all(
      diff.map(async (op) => {
        const { uri, cid } = op
        try {
          if (op.op === 'delete') {
            await this.deleteRecord(uri)
          } else {
            await this.indexRecord(
              uri,
              cid,
              op.value,
              op.op === 'create' ? WriteOpAction.Create : WriteOpAction.Update,
              now,
            )
          }
        } catch (err) {
          if (err instanceof ValidationError) {
            subLogger.warn(
              { did, commit, uri: uri.toString(), cid: cid.toString() },
              'skipping indexing of invalid record',
            )
          } else {
            subLogger.error(
              { err, did, commit, uri: uri.toString(), cid: cid.toString() },
              'skipping indexing due to error processing record',
            )
          }
        }
      }),
    )
  }

  async getCurrentRecords(did: string) {
    const res = await this.db.db
      .selectFrom('record')
      .where('did', '=', did)
      .select(['uri', 'cid'])
      .execute()
    return res.reduce((acc, cur) => {
      acc[cur.uri] = {
        uri: new AtUri(cur.uri),
        cid: CID.parse(cur.cid),
      }
      return acc
    }, {} as Record<string, { uri: AtUri; cid: CID }>)
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
        repoRev: commit.rev ?? null,
        rebaseCount: details.rebase ? 1 : 0,
        tooBigCount: details.tooBig ? 1 : 0,
      })
      .onConflict((oc) => {
        const sync = (col: string) => ref(`actor_sync.${col}`)
        const excluded = (col: string) => ref(`excluded.${col}`)
        return oc.column('did').doUpdateSet({
          commitCid: sql`${excluded('commitCid')}`,
          commitDataCid: sql`${excluded('commitDataCid')}`,
          repoRev: sql`${excluded('repoRev')}`,
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
      await retryHttp(() => api.com.atproto.sync.getLatestCommit({ did }))
      return true
    } catch (err) {
      if (err instanceof ComAtprotoSyncGetLatestCommit.RepoNotFoundError) {
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
    await this.db.db
      .deleteFrom('list_block')
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

type UriAndCid = {
  uri: AtUri
  cid: CID
}

type RecordDescript = UriAndCid & {
  value: unknown
}

type IndexOp =
  | ({
      op: 'create' | 'update'
    } & RecordDescript)
  | ({ op: 'delete' } & UriAndCid)

const findDiffFromCheckout = (
  curr: Record<string, UriAndCid>,
  checkout: Record<string, RecordDescript>,
): IndexOp[] => {
  const ops: IndexOp[] = []
  for (const uri of Object.keys(checkout)) {
    const record = checkout[uri]
    if (!curr[uri]) {
      ops.push({ op: 'create', ...record })
    } else {
      if (curr[uri].cid.equals(record.cid)) {
        // no-op
        continue
      }
      ops.push({ op: 'update', ...record })
    }
  }
  for (const uri of Object.keys(curr)) {
    const record = curr[uri]
    if (!checkout[uri]) {
      ops.push({ op: 'delete', ...record })
    }
  }
  return ops
}

const formatCheckout = (
  did: string,
  verifiedRepo: VerifiedRepo,
): Record<string, RecordDescript> => {
  const records: Record<string, RecordDescript> = {}
  for (const create of verifiedRepo.creates) {
    const uri = AtUri.make(did, create.collection, create.rkey)
    records[uri.toString()] = {
      uri,
      cid: create.cid,
      value: create.record,
    }
  }
  return records
}

const needsHandleReindex = (actor: Actor | undefined, timestamp: string) => {
  if (!actor) return true
  const timeDiff =
    new Date(timestamp).getTime() - new Date(actor.indexedAt).getTime()
  // revalidate daily
  if (timeDiff > DAY) return true
  // revalidate more aggressively for invalidated handles
  if (actor.handle === null && timeDiff > HOUR) return true
  return false
}
