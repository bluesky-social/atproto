import { CID } from 'multiformats/cid'
import ApiAgent, { AtpAgent } from '@atproto/api'
import {
  def,
  MemoryBlockstore,
  parseDataKey,
  readCarWithRoot,
  verifyCheckoutToRepo,
  WriteOpAction,
  DataDiff,
} from '@atproto/repo'
import { AtUri } from '@atproto/uri'
import { DidResolver } from '@atproto/did-resolver'
import { chunkArray } from '@atproto/common'
import { NoHandleRecordError, resolveDns } from '@atproto/identifier'
import Database from '../../db'
import * as Post from './plugins/post'
import * as Vote from './plugins/vote'
import * as Repost from './plugins/repost'
import * as Follow from './plugins/follow'
import * as Profile from './plugins/profile'
import RecordProcessor from './processor'
import { subLogger } from '../../logger'
import { ids } from '../../lexicon/lexicons'

export class IndexingService {
  records: {
    post: Post.PluginType
    vote: Vote.PluginType
    repost: Repost.PluginType
    follow: Follow.PluginType
    profile: Profile.PluginType
  }

  constructor(public db: Database, public didResolver: DidResolver) {
    this.records = {
      post: Post.makePlugin(this.db.db),
      vote: Vote.makePlugin(this.db.db),
      repost: Repost.makePlugin(this.db.db),
      follow: Follow.makePlugin(this.db.db),
      profile: Profile.makePlugin(this.db.db),
    }
  }

  static creator(didResolver: DidResolver) {
    return (db: Database) => new IndexingService(db, didResolver)
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
    // @TODO(bsky) direct notifs
    const notifs =
      action === WriteOpAction.Create
        ? await indexer.insertRecord(uri, cid, obj, timestamp)
        : await indexer.updateRecord(uri, cid, obj, timestamp)
    return notifs
  }

  async deleteRecord(uri: AtUri, cascading = false) {
    this.db.assertTransaction()
    const indexer = this.findIndexerForCollection(uri.collection)
    if (!indexer) return
    // @TODO(bsky) direct notifs
    const notifs = await indexer.deleteRecord(uri, cascading)
    return notifs
  }

  async indexActor(did: string, timestamp: string) {
    const actor = await this.db.db
      .selectFrom('actor')
      .where('did', '=', did)
      .selectAll()
      .executeTakeFirst()
    if (actor) {
      return // @TODO deal with handle updates
    }
    const { handle } = await this.didResolver.resolveAtpData(did)
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
    const now = new Date().toISOString()
    const { pds, signingKey } = await this.didResolver.resolveAtpData(did)
    const { sync } = new AtpAgent({ service: pds }).api.com.atproto

    const { data: car } = await sync.getCheckout({ did, commit })
    const { root, blocks } = await readCarWithRoot(new Uint8Array(car))
    const storage = new MemoryBlockstore(blocks)
    const repo = await verifyCheckoutToRepo(storage, root, did, signingKey)

    // First, replace the user with just their current profile if it exists
    await this.db.transaction(async (tx) => {
      const indexingTx = new IndexingService(tx, this.didResolver)
      await indexingTx.deleteForUser(did)
      const profileCid = await repo.data.get(`${ids.AppBskyActorProfile}/self`)
      const profile =
        profileCid &&
        (await repo.storage.attemptRead(profileCid, def.unknown))?.obj
      if (profile) {
        const profileUri = AtUri.make(did, ids.AppBskyActorProfile, 'self')
        await indexingTx.indexRecord(
          profileUri,
          profileCid,
          profile,
          WriteOpAction.Create,
          now,
        )
      }
    })

    // Then iterate over all records and index them in batches
    const diff = await DataDiff.of(repo.data, null)
    const chunks = chunkArray(diff.addList(), 100)
    for (const chunk of chunks) {
      const prepareChunk = chunk.map(async ({ cid, key }) => {
        const { collection, rkey } = parseDataKey(key)
        const uri = AtUri.make(did, collection, rkey)
        const obj = await storage.readObj(cid, def.record)
        return { uri, cid, obj }
      })
      const prepared = await Promise.all(prepareChunk)
      await this.db.transaction(async (tx) => {
        const indexingTx = new IndexingService(tx, this.didResolver)
        const processChunk = prepared.map(async ({ uri, cid, obj }) => {
          await indexingTx.indexRecord(uri, cid, obj, WriteOpAction.Create, now)
        })
        await Promise.all(processChunk)
      })
    }
  }

  findIndexerForCollection(collection: string) {
    const indexers = Object.values(
      this.records as Record<string, RecordProcessor<unknown, unknown>>,
    )
    return indexers.find((indexer) => indexer.collection === collection)
  }

  async deleteForUser(did: string) {
    this.db.assertTransaction()

    const postByUser = (qb) =>
      qb
        .selectFrom('post')
        .where('post.creator', '=', did)
        .select('post.uri as uri')

    await Promise.all([
      this.db.db
        .deleteFrom('post_entity')
        .where('post_entity.postUri', 'in', postByUser)
        .execute(),
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
      this.db.db.deleteFrom('vote').where('creator', '=', did).execute(),
    ])
  }
}

const resolveExternalHandle = async (
  handle: string,
): Promise<string | undefined> => {
  try {
    const did = await resolveDns(handle)
    return did
  } catch (err) {
    if (err instanceof NoHandleRecordError) {
      // no worries it's just not found
    } else {
      subLogger.error({ err, handle }, 'could not resolve dns handle')
    }
  }
  try {
    const agent = new ApiAgent({ service: `https://${handle}` }) // @TODO we don't need non-tls for our tests, but it might be useful to support
    const res = await agent.api.com.atproto.handle.resolve({ handle })
    return res.data.did
  } catch (err) {
    return undefined
  }
}
