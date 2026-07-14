import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../../proto/bsky_connect.js'
import { Database } from '../db/index.js'
import { TimeCidKeyset, paginate } from '../db/pagination.js'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getBidirectionalBlock(req) {
    const { actorDid, targetDid } = req
    const res = await db.db
      .selectFrom('actor_block')
      .where((eb) =>
        eb.or([
          eb.and([
            eb('actor_block.creator', '=', actorDid),
            eb('actor_block.subjectDid', '=', targetDid),
          ]),
          eb.and([
            eb('actor_block.creator', '=', targetDid),
            eb('actor_block.subjectDid', '=', actorDid),
          ]),
        ]),
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
      .where((eb) =>
        eb.or([
          eb.and([
            eb('list_block.creator', '=', actorDid),
            eb('list_item.subjectDid', '=', targetDid),
          ]),
          eb.and([
            eb('list_block.creator', '=', targetDid),
            eb('list_item.subjectDid', '=', actorDid),
          ]),
        ]),
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
      .where(({ exists }) =>
        exists(
          db.db
            .selectFrom('list_block')
            .where('list_block.creator', '=', actorDid)
            .whereRef('list_block.subjectUri', '=', ref('list.uri'))
            .selectAll(),
        ),
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
