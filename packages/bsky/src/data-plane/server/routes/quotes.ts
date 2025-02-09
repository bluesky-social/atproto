import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../../proto/bsky_connect'
import { Database } from '../db'
import { TimeCidKeyset, paginate } from '../db/pagination'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getQuotesBySubjectSorted(req) {
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
      uris: quotes.map((q) => q.uri),
      cursor: keyset.packFromResult(quotes),
    }
  },
})
