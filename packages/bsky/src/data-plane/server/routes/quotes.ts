import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../../proto/bsky_connect'
import { Database } from '../db'
import { paginate, TimeCidKeyset } from '../db/pagination'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getQuotesBySubject(req) {
    const { subject, cursor, limit } = req
    const { ref } = db.db.dynamic

    if (!subject?.uri) return { uris: [] }

    let builder = db.db
      .selectFrom('quote')
      .where('quote.subject', '=', subject.uri)
      .select(['quote.uri', 'quote.cid', 'quote.sortAt'])

    const keyset = new TimeCidKeyset(ref('quote.sortAt'), ref('quote.cid'))
    builder = paginate(builder, {
      limit,
      cursor,
      keyset,
    })

    const quotes = await builder.execute()

    return {
      refs: quotes.map((q) => ({ uri: q.uri, cid: q.cid })),
      cursor: keyset.packFromResult(quotes),
    }
  },
})
