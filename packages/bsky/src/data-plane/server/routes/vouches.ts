import { keyBy } from '@atproto/common'
import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../../proto/bsky_connect'
import { Database } from '../db'
import { TimeCidKeyset, paginate } from '../db/pagination'
import { getRecords } from './records'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getVouches(req) {
    const { uris } = req
    if (uris.length < 1) {
      return { vouches: [] }
    }
    const [accepts, vouchRecords] = await Promise.all([
      db.db
        .selectFrom('vouch_accept')
        .selectAll()
        .where('uri', 'in', uris)
        .execute(),
      getRecords(db)({ uris }),
    ])
    const byVouchUri = keyBy(accepts, 'vouchUri')
    const vouches = uris.map((uri, i) => {
      const vouch = vouchRecords.records[i]
      if (!vouch) return {}
      const accept = byVouchUri[uri]
      const validAccept =
        accept.vouchUri === uri && accept.vouchCid === vouch.cid
      return {
        vouch,
        acceptUri: validAccept ? accept.uri : undefined,
        acceptCid: validAccept ? accept.cid : undefined,
      }
    })
    return { vouches }
  },
  async getVouchesGiven(req) {
    const { actorDid, includeUnaccepted, limit, cursor } = req
    const { ref } = db.db.dynamic
    let builder = await db.db
      .selectFrom('vouch')
      .select(['uri', 'cid', 'sortAt'])
      .where('creator', '=', actorDid)

    if (!includeUnaccepted) {
      builder = builder.whereExists((qb) =>
        qb
          .selectFrom('vouch_accept')
          .whereRef('vouch_accept.vouchUri', '=', 'vouch.uri')
          .whereRef('vouch_accept.vouchCid', '=', 'vouch.cid')
          .whereRef('vouch_accept.creator', '=', 'vouch.subjectDid'),
      )
    }

    const keyset = new TimeCidKeyset(ref('vouch.sortAt'), ref('vouch.cid'))
    builder = paginate(builder, {
      limit,
      cursor,
      keyset,
    })

    const vouches = await builder.execute()
    return {
      uris: vouches.map((v) => v.uri),
      cursor: keyset.packFromResult(vouches),
    }
  },
  async getVouchesReceived(req) {
    const { actorDid, includeUnaccepted, limit, cursor } = req
    const { ref } = db.db.dynamic
    let builder = await db.db
      .selectFrom('vouch')
      .select(['uri', 'cid', 'sortAt'])
      .where('subjectDid', '=', actorDid)

    if (!includeUnaccepted) {
      builder = builder.whereExists((qb) =>
        qb
          .selectFrom('vouch_accept')
          .whereRef('vouch_accept.vouchUri', '=', 'vouch.uri')
          .whereRef('vouch_accept.vouchCid', '=', 'vouch.cid')
          .whereRef('vouch_accept.creator', '=', 'vouch.subjectDid'),
      )
    }

    const keyset = new TimeCidKeyset(ref('vouch.sortAt'), ref('vouch.cid'))
    builder = paginate(builder, {
      limit,
      cursor,
      keyset,
    })

    const vouches = await builder.execute()
    return {
      uris: vouches.map((v) => v.uri),
      cursor: keyset.packFromResult(vouches),
    }
  },
})
