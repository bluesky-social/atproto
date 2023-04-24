import { sql } from 'kysely'
import { CID } from 'multiformats/cid'
import AtpAgent from '@atproto/api'
import {
  MemoryBlockstore,
  readCarWithRoot,
  WriteOpAction,
  verifyCheckoutWithCids,
  RepoContentsWithCids,
  Commit,
} from '@atproto/repo'
import { AtUri } from '@atproto/uri'
import { DidResolver } from '@atproto/did-resolver'
import { chunkArray } from '@atproto/common'
import { ValidationError } from '@atproto/lexicon'
import Database from '../../db'
import * as Post from './plugins/post'
import * as Like from './plugins/like'
import * as Repost from './plugins/repost'
import * as Follow from './plugins/follow'
import * as Profile from './plugins/profile'
import RecordProcessor from './processor'
import { subLogger } from '../../logger'
import { retryHttp } from '../../util/retry'
import { resolveExternalHandle } from '../../util/identity'
import { Labeler } from '../../labeler'

export class IndexingService {
  records: {
    post: Post.PluginType
    like: Like.PluginType
    repost: Repost.PluginType
    follow: Follow.PluginType
    profile: Profile.PluginType
  }

  constructor(
    public db: Database,
    public didResolver: DidResolver,
    public labeler: Labeler,
  ) {
    this.records = {
      post: Post.makePlugin(this.db.db),
      like: Like.makePlugin(this.db.db),
      repost: Repost.makePlugin(this.db.db),
      follow: Follow.makePlugin(this.db.db),
      profile: Profile.makePlugin(this.db.db),
    }
  }

  static creator(didResolver: DidResolver, labeler: Labeler) {
    return (db: Database) => new IndexingService(db, didResolver, labeler)
  }

  async indexRecord(
    uri: AtUri,
    cid: CID,
    obj: unknown,
    action: WriteOpAction.Create | WriteOpAction.Update,
    timestamp: string,
  ) {
    this.db.assertTransaction()
    const indexer = this.findIndexerForCollection(uri.collection)
    if (!indexer) return
    if (action === WriteOpAction.Create) {
      await indexer.insertRecord(uri, cid, obj, timestamp)
    } else {
      await indexer.updateRecord(uri, cid, obj, timestamp)
    }
    this.labeler.processRecord(uri, obj)
  }

  async deleteRecord(uri: AtUri, cascading = false) {
    this.db.assertTransaction()
    const indexer = this.findIndexerForCollection(uri.collection)
    if (!indexer) return
    await indexer.deleteRecord(uri, cascading)
  }

  async indexHandle(did: string, timestamp: string, force = false) {
    const actor = await this.db.db
      .selectFrom('actor')
      .where('did', '=', did)
      .selectAll()
      .executeTakeFirst()
    if (actor && !force) {
      return
    }
    const { handle } = await this.didResolver.resolveAtprotoData(did)
    const handleToDid = await resolveExternalHandle(handle)
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
    this.db.assertTransaction()
    const now = new Date().toISOString()
    const { pds, signingKey } = await this.didResolver.resolveAtprotoData(did)
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
    this.db.assertTransaction()
    const doc = await this.didResolver.resolveDid(did)
    if (doc === null) {
      await Promise.all([
        this.unindexActor(did),
        this.db.db.deleteFrom('actor').where('did', '=', did).execute(),
      ])
    }
  }

  async unindexActor(did: string) {
    this.db.assertTransaction()

    const postByUser = (qb) =>
      qb
        .selectFrom('post')
        .where('post.creator', '=', did)
        .select('post.uri as uri')

    await Promise.all([
      this.db.db
        .deleteFrom('post_embed_image')
        .where('post_embed_image.postUri', 'in', postByUser)
        .execute(),
      this.db.db
        .deleteFrom('post_embed_external')
        .where('post_embed_external.postUri', 'in', postByUser)
        .execute(),
      this.db.db
        .deleteFrom('post_embed_record')
        .where('post_embed_record.postUri', 'in', postByUser)
        .execute(),
      this.db.db
        .deleteFrom('duplicate_record')
        .where('duplicate_record.duplicateOf', 'in', (qb) =>
          qb
            .selectFrom('record')
            .where('record.did', '=', did)
            .select('record.uri as uri'),
        )
        .execute(),
    ])
    await Promise.all([
      this.db.db.deleteFrom('follow').where('creator', '=', did).execute(),
      this.db.db.deleteFrom('post').where('creator', '=', did).execute(),
      this.db.db.deleteFrom('profile').where('creator', '=', did).execute(),
      this.db.db.deleteFrom('repost').where('creator', '=', did).execute(),
      this.db.db.deleteFrom('like').where('creator', '=', did).execute(),
    ])
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
