import assert from 'node:assert'
import { ServiceImpl } from '@connectrpc/connect'
import { keyBy } from '@atproto/common'
import { AtUri } from '@atproto/syntax'
import { ids } from '../../../lexicon/lexicons'
import { Service } from '../../../proto/bsky_connect'
import { Database } from '../db'
import { CreatedAtDidKeyset, TimeCidKeyset, paginate } from '../db/pagination'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getActorMutesActor(req) {
    const { actorDid, targetDid } = req
    const res = await db.db
      .selectFrom('mute')
      .selectAll()
      .where('mutedByDid', '=', actorDid)
      .where('subjectDid', '=', targetDid)
      .executeTakeFirst()
    return {
      muted: !!res,
    }
  },

  async getMutes(req) {
    const { actorDid, limit, cursor } = req
    const { ref } = db.db.dynamic

    let builder = db.db
      .selectFrom('mute')
      .innerJoin('actor', 'actor.did', 'mute.subjectDid')
      .where('mute.mutedByDid', '=', actorDid)
      .selectAll('actor')
      .select('mute.createdAt as createdAt')

    const keyset = new CreatedAtDidKeyset(
      ref('mute.createdAt'),
      ref('mute.subjectDid'),
    )
    builder = paginate(builder, {
      limit,
      cursor,
      keyset,
    })

    const mutes = await builder.execute()

    return {
      dids: mutes.map((m) => m.did),
      cursor: keyset.packFromResult(mutes),
    }
  },

  async getActorMutesActorViaList(req) {
    const { actorDid, targetDid } = req
    const res = await db.db
      .selectFrom('list_mute')
      .innerJoin('list_item', 'list_item.listUri', 'list_mute.listUri')
      .where('list_mute.mutedByDid', '=', actorDid)
      .where('list_item.subjectDid', '=', targetDid)
      .select('list_mute.listUri')
      .limit(1)
      .executeTakeFirst()
    return {
      listUri: res?.listUri,
    }
  },

  async getMutelistSubscription(req) {
    const { actorDid, listUri } = req
    const res = await db.db
      .selectFrom('list_mute')
      .where('mutedByDid', '=', actorDid)
      .where('listUri', '=', listUri)
      .selectAll()
      .limit(1)
      .executeTakeFirst()
    return {
      subscribed: !!res,
    }
  },

  async getMutelistSubscriptions(req) {
    const { actorDid, limit, cursor } = req
    const { ref } = db.db.dynamic
    let builder = db.db
      .selectFrom('list')
      .whereExists(
        db.db
          .selectFrom('list_mute')
          .where('list_mute.mutedByDid', '=', actorDid)
          .whereRef('list_mute.listUri', '=', ref('list.uri'))
          .selectAll(),
      )
      .selectAll('list')

    const keyset = new TimeCidKeyset(ref('list.createdAt'), ref('list.cid'))
    builder = paginate(builder, {
      limit,
      cursor,
      keyset,
    })
    const lists = await builder.execute()

    return {
      listUris: lists.map((l) => l.uri),
      cursor: keyset.packFromResult(lists),
    }
  },

  async createActorMute(req) {
    const { actorDid, subjectDid } = req
    assert(actorDid !== subjectDid, 'cannot mute yourself') // @TODO pass message through in http error
    await db.db
      .insertInto('mute')
      .values({
        subjectDid,
        mutedByDid: actorDid,
        createdAt: new Date().toISOString(),
      })
      .onConflict((oc) => oc.doNothing())
      .execute()
  },

  async deleteActorMute(req) {
    const { actorDid, subjectDid } = req
    assert(actorDid !== subjectDid, 'cannot mute yourself')
    await db.db
      .deleteFrom('mute')
      .where('subjectDid', '=', subjectDid)
      .where('mutedByDid', '=', actorDid)
      .execute()
  },

  async clearActorMutes(req) {
    const { actorDid } = req
    await db.db.deleteFrom('mute').where('mutedByDid', '=', actorDid).execute()
  },

  async createActorMutelistSubscription(req) {
    const { actorDid, subjectUri } = req
    assert(isListUri(subjectUri), 'must mute a list')
    await db.db
      .insertInto('list_mute')
      .values({
        listUri: subjectUri,
        mutedByDid: actorDid,
        createdAt: new Date().toISOString(),
      })
      .onConflict((oc) => oc.doNothing())
      .execute()
  },

  async deleteActorMutelistSubscription(req) {
    const { actorDid, subjectUri } = req
    assert(isListUri(subjectUri), 'must mute a list')
    await db.db
      .deleteFrom('list_mute')
      .where('listUri', '=', subjectUri)
      .where('mutedByDid', '=', actorDid)
      .execute()
  },

  async clearActorMutelistSubscriptions(req) {
    const { actorDid } = req
    await db.db
      .deleteFrom('list_mute')
      .where('mutedByDid', '=', actorDid)
      .execute()
  },

  async getThreadMutesOnSubjects(req) {
    const { actorDid, threadRoots } = req
    if (threadRoots.length === 0) {
      return { muted: [] }
    }
    const res = await db.db
      .selectFrom('thread_mute')
      .selectAll()
      .where('mutedByDid', '=', actorDid)
      .where('rootUri', 'in', threadRoots)
      .execute()
    const byRootUri = keyBy(res, 'rootUri')
    const muted = threadRoots.map((uri) => !!byRootUri.get(uri))
    return { muted }
  },
})

const isListUri = (uri: string) =>
  new AtUri(uri).collection === ids.AppBskyGraphList
