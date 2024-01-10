import * as ui8 from 'uint8arrays'
import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../gen/bsky_connect'
import { Database } from '../db'
import { TimeCidKeyset, paginate } from '../db/pagination'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getLabels(req) {
    const { subjects, issuers } = req
    if (subjects.length === 0 || issuers.length === 0) {
      return { records: [] }
    }
    const res = await db.db
      .selectFrom('label')
      .where('uri', 'in', subjects)
      .where('src', 'in', issuers)
      .selectAll()
      .execute()

    const labels = res.map((l) => {
      const formatted = {
        ...l,
        cid: l.cid === '' ? undefined : l.cid,
      }
      return ui8.fromString(JSON.stringify(formatted), 'utf8')
    })
    return { labels }
  },

  async getActorLabelers(req) {
    const { actorDid, limit, cursor } = req

    const { ref } = db.db.dynamic
    let builder = db.db
      .selectFrom('labeler')
      .selectAll()
      .where('labeler.creator', '=', actorDid)

    const keyset = new TimeCidKeyset(
      ref('labeler.createdAt'),
      ref('labeler.cid'),
    )
    builder = paginate(builder, {
      limit,
      cursor,
      keyset,
    })
    const feeds = await builder.execute()

    return {
      uris: feeds.map((f) => f.uri),
      cursor: keyset.packFromResult(feeds),
    }
  },
})
