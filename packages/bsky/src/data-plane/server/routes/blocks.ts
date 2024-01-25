import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../../proto/bsky_connect'
import { Database } from '../db'
import { TimeCidKeyset, paginate } from '../db/pagination'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getBidirectionalBlock(req) {
    const { actorDid, targetDid } = req
    const res = await db.db
      .selectFrom('actor_block')
      .where((qb) =>
        qb
          .where('actor_block.creator', '=', actorDid)
          .where('actor_block.subjectDid', '=', targetDid),
      )
      .orWhere((qb) =>
        qb
          .where('actor_block.creator', '=', targetDid)
          .where('actor_block.subjectDid', '=', actorDid),
      )
      .limit(1)
      .selectAll()
      .executeTakeFirst()

    return {
      blockUri: res?.uri,
    }
  },

  async getBlocks(req) {
    const { actorDid, cursor, limit } = req
    const { ref } = db.db.dynamic

    let builder = db.db
      .selectFrom('actor_block')
      .where('actor_block.creator', '=', actorDid)
      .selectAll()

    const keyset = new TimeCidKeyset(
      ref('actor_block.sortAt'),
      ref('actor_block.cid'),
    )
    builder = paginate(builder, {
      limit,
      cursor,
      keyset,
    })

    const blocks = await builder.execute()
    return {
      blockUris: blocks.map((b) => b.uri),
      cursor: keyset.packFromResult(blocks),
    }
  },

  async getBidirectionalBlockViaList(req) {
    const { actorDid, targetDid } = req
    const res = await db.db
      .selectFrom('list_block')
      .innerJoin('list_item', 'list_item.listUri', 'list_block.subjectUri')
      .where((qb) =>
        qb
          .where('list_block.creator', '=', actorDid)
          .where('list_item.subjectDid', '=', targetDid),
      )
      .orWhere((qb) =>
        qb
          .where('list_block.creator', '=', targetDid)
          .where('list_item.subjectDid', '=', actorDid),
      )
      .limit(1)
      .selectAll('list_block')
      .executeTakeFirst()

    return {
      listUri: res?.subjectUri,
    }
  },

  async getBlocklistSubscription(req) {
    const { actorDid, listUri } = req
    const res = await db.db
      .selectFrom('list_block')
      .where('creator', '=', actorDid)
      .where('subjectUri', '=', listUri)
      .selectAll()
      .limit(1)
      .executeTakeFirst()
    return {
      listblockUri: res?.uri,
    }
  },

  async getBlocklistSubscriptions(req) {
    const { actorDid, limit, cursor } = req
    const { ref } = db.db.dynamic
    let builder = db.db
      .selectFrom('list')
      .whereExists(
        db.db
          .selectFrom('list_block')
          .where('list_block.creator', '=', actorDid)
          .whereRef('list_block.subjectUri', '=', ref('list.uri'))
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
})
