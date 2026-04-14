import { PlainMessage, Timestamp } from '@bufbuild/protobuf'
import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../../proto/bsky_connect'
import { DraftInfo } from '../../../proto/bsky_pb'
import { Database } from '../db'
import { IsoUpdatedAtKey } from '../db/pagination'

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
