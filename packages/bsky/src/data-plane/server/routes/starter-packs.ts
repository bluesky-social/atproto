import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../../proto/bsky_connect'
import { Database } from '../db'
import { TimeCidKeyset, paginate } from '../db/pagination'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getActorStarterPacks(req) {
    const { actorDid, limit, cursor } = req

    const { ref } = db.db.dynamic
    let builder = db.db
      .selectFrom('starter_pack')
      .selectAll()
      .where('creator', '=', actorDid)

    const keyset = new TimeCidKeyset(
      ref('starter_pack.sortAt'),
      ref('starter_pack.cid'),
    )
    builder = paginate(builder, {
      limit,
      cursor,
      keyset,
    })
    const starterPacks = await builder.execute()

    return {
      uris: starterPacks.map((sp) => sp.uri),
      cursor: keyset.packFromResult(starterPacks),
    }
  },
})
