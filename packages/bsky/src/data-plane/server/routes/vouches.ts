import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../../proto/bsky_connect'
import { Database } from '../db'
import { TimeCidKeyset, paginate } from '../db/pagination'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getVouchesIssued(req) {
    const { issuerDid, cursor, limit } = req
    const { ref } = db.db.dynamic

    let builder = db.db
      .selectFrom('vouch')
      .selectAll()
      .where('creator', '=', issuerDid)

    const keyset = new TimeCidKeyset(ref('sortAt'), ref('cid'))
    builder = paginate(builder, {
      limit,
      cursor,
      keyset,
    })

    const vouches = await builder.execute()

    return {
      vouches: vouches.map((v) => ({
        issuerDid: v.creator,
        receiverDid: v.subject,
      })),
      cursor: keyset.packFromResult(vouches),
    }
  },

  async getVouchesReceived(req) {
    const { receiverDid, cursor, limit } = req
    const { ref } = db.db.dynamic

    let builder = db.db
      .selectFrom('vouch')
      .selectAll()
      .where('subject', '=', receiverDid)

    const keyset = new TimeCidKeyset(ref('sortAt'), ref('cid'))
    builder = paginate(builder, {
      limit,
      cursor,
      keyset,
    })

    const vouchers = await builder.execute()

    return {
      vouchers: vouchers.map((v) => ({
        issuerDid: v.creator,
        receiverDid: v.subject,
      })),
      cursor: keyset.packFromResult(vouchers),
    }
  },

  async getKnownVouchesReceived(req) {
    const { viewerDid, receiverDid } = req

    const vouchers = await db.db
      .selectFrom('vouch')
      .selectAll()
      .where('subject', '=', receiverDid)
      .where('creator', 'in', (qb) =>
        qb
          .selectFrom('vouch')
          .select('subject')
          .where('creator', '=', viewerDid),
      )
      .orderBy('sortAt', 'desc')
      .execute()

    return {
      vouchers: vouchers.map((v) => ({
        issuerDid: v.creator,
        receiverDid: v.subject,
      })),
    }
  },
})
