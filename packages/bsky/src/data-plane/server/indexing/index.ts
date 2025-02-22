import { sql } from 'kysely'
import { CID } from 'multiformats/cid'
import { AtpAgent, ComAtprotoSyncGetLatestCommit } from '@atproto/api'
import { DAY, HOUR } from '@atproto/common'
import { IdResolver, getPds } from '@atproto/identity'
import { ValidationError } from '@atproto/lexicon'
import {
  VerifiedRepo,
  WriteOpAction,
  getAndParseRecord,
  readCarWithRoot,
  verifyRepo,
} from '@atproto/repo'
import { AtUri } from '@atproto/syntax'
import { subLogger } from '../../../logger'
import { retryXrpc } from '../../../util/retry'
import { BackgroundQueue } from '../background'
import { Database } from '../db'
import { Actor } from '../db/tables/actor'
import * as Block from './plugins/block'
import * as ChatDeclaration from './plugins/chat-declaration'
import * as FeedGenerator from './plugins/feed-generator'
import * as Follow from './plugins/follow'
import * as Labeler from './plugins/labeler'
import * as Like from './plugins/like'
import * as List from './plugins/list'
import * as ListBlock from './plugins/list-block'
import * as ListItem from './plugins/list-item'
import * as Post from './plugins/post'
import * as Postgate from './plugins/post-gate'
import * as Profile from './plugins/profile'
import * as Repost from './plugins/repost'
import * as StarterPack from './plugins/starter-pack'
import * as Threadgate from './plugins/thread-gate'
import { RecordProcessor } from './processor'

export class IndexingService {
  records: {
    post: Post.PluginType
    threadGate: Threadgate.PluginType
    postGate: Postgate.PluginType
    like: Like.PluginType
    repost: Repost.PluginType
    follow: Follow.PluginType
    profile: Profile.PluginType
    list: List.PluginType
    listItem: ListItem.PluginType
    listBlock: ListBlock.PluginType
    block: Block.PluginType
    feedGenerator: FeedGenerator.PluginType
    starterPack: StarterPack.PluginType
    labeler: Labeler.PluginType
    chatDeclaration: ChatDeclaration.PluginType
  }

  constructor(
    public db: Database,
    public idResolver: IdResolver,
    public background: BackgroundQueue,
  ) {
    this.records = {
      post: Post.makePlugin(this.db, this.background),
      threadGate: Threadgate.makePlugin(this.db, this.background),
      postGate: Postgate.makePlugin(this.db, this.background),
      like: Like.makePlugin(this.db, this.background),
      repost: Repost.makePlugin(this.db, this.background),
      follow: Follow.makePlugin(this.db, this.background),
      profile: Profile.makePlugin(this.db, this.background),
      list: List.makePlugin(this.db, this.background),
      listItem: ListItem.makePlugin(this.db, this.background),
      listBlock: ListBlock.makePlugin(this.db, this.background),
      block: Block.makePlugin(this.db, this.background),
      feedGenerator: FeedGenerator.makePlugin(this.db, this.background),
      starterPack: StarterPack.makePlugin(this.db, this.background),
      labeler: Labeler.makePlugin(this.db, this.background),
      chatDeclaration: ChatDeclaration.makePlugin(this.db, this.background),
    }
  }

  transact(txn: Database) {
    txn.assertTransaction()
    return new IndexingService(txn, this.idResolver, this.background)
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

    const actorInfo = { handle, indexedAt: timestamp }
    await this.db.db
      .insertInto('actor')
      .values({ did, ...actorInfo })
      .onConflict((oc) => oc.column('did').doUpdateSet(actorInfo))
      .returning('did')
      .executeTakeFirst()
  }

  async indexRepo(did: string, commit?: string) {
    this.db.assertNotTransaction()
    const now = new Date().toISOString()
    const { pds, signingKey } = await this.idResolver.did.resolveAtprotoData(
      did,
      true,
    )
    const { api } = new AtpAgent({ service: pds })

    const { data: car } = await retryXrpc(() =>
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
            const parsed = await getAndParseRecord(blocks, cid)
            await this.indexRecord(
              uri,
              cid,
              parsed.record,
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
    return res.reduce(
      (acc, cur) => {
        acc[cur.uri] = {
          uri: new AtUri(cur.uri),
          cid: CID.parse(cur.cid),
        }
        return acc
      },
      {} as Record<string, { uri: AtUri; cid: CID }>,
    )
  }

  async setCommitLastSeen(did: string, commit: CID, rev: string) {
    const { ref } = this.db.db.dynamic
    await this.db.db
      .insertInto('actor_sync')
      .values({
        did,
        commitCid: commit.toString(),
        repoRev: rev ?? null,
      })
      .onConflict((oc) => {
        const excluded = (col: string) => ref(`excluded.${col}`)
        return oc.column('did').doUpdateSet({
          commitCid: sql`${excluded('commitCid')}`,
          repoRev: sql`${excluded('repoRev')}`,
        })
      })
      .execute()
  }

  findIndexerForCollection(collection: string) {
    const indexers = Object.values(
      this.records as Record<string, RecordProcessor<unknown, unknown>>,
    )
    return indexers.find((indexer) => indexer.collection === collection)
  }

  async updateActorStatus(did: string, active: boolean, status: string = '') {
    let upstreamStatus: string | null
    if (active) {
      upstreamStatus = null
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
      await retryXrpc(() => api.com.atproto.sync.getLatestCommit({ did }))
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
    await this.db.db.deleteFrom('labeler').where('creator', '=', did).execute()
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
    await this.db.db
      .deleteFrom('thread_gate')
      .where('creator', '=', did)
      .execute()
    await this.db.db
      .deleteFrom('post_gate')
      .where('creator', '=', did)
      .execute()
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

type IndexOp =
  | ({
      op: 'create' | 'update'
    } & UriAndCid)
  | ({ op: 'delete' } & UriAndCid)

const findDiffFromCheckout = (
  curr: Record<string, UriAndCid>,
  checkout: Record<string, UriAndCid>,
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
): Record<string, UriAndCid> => {
  const records: Record<string, UriAndCid> = {}
  for (const create of verifiedRepo.creates) {
    const uri = AtUri.make(did, create.collection, create.rkey)
    records[uri.toString()] = {
      uri,
      cid: create.cid,
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
