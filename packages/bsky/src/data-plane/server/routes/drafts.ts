import { type PlainMessage, Timestamp } from '@bufbuild/protobuf'
import type { ServiceImpl } from '@connectrpc/connect'
import type { Service } from '../../../proto/bsky_connect.js'
import type { DraftInfo } from '../../../proto/bsky_pb.js'
import type { Database } from '../db/index.js'
import { IsoUpdatedAtKey } from '../db/pagination.js'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getActorDrafts(req) {
    const { actorDid, cursor, limit } = req
    const { ref } = db.db.dynamic

    let builder = db.db
      .selectFrom('draft')
      .where('draft.creator', '=', actorDid)
      .selectAll()

    const key = new IsoUpdatedAtKey(ref('draft.updatedAt'))
    builder = key.paginate(builder, {
      cursor,
      limit,
    })

    const res = await builder.execute()
    return {
      drafts: res.map(
        (d): PlainMessage<DraftInfo> => ({
          key: d.key,
          payload: Buffer.from(d.payload),
          createdAt: Timestamp.fromDate(new Date(d.createdAt)),
          updatedAt: Timestamp.fromDate(new Date(d.updatedAt)),
        }),
      ),
      cursor: key.packFromResult(res),
    }
  },
})
