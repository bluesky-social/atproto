import { sql } from 'kysely'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.label.queryLabels(async ({ params }) => {
    const { uriPatterns, sources, limit, cursor } = params
    let builder = ctx.db.db.selectFrom('label').selectAll().limit(limit)
    // if includes '*', then we don't need a where clause
    if (!uriPatterns.includes('*')) {
      builder = builder.where((qb) => {
        // starter where clause that is always false so that we can chain `orWhere`s
        qb = qb.where(sql`1 = 0`)
        for (const pattern of uriPatterns) {
          // if no '*', then we're looking for an exact match
          if (!pattern.includes('*')) {
            qb = qb.orWhere('uri', '=', pattern)
          } else {
            if (pattern.indexOf('*') < pattern.length - 1) {
              throw new InvalidRequestError(`invalid pattern: ${pattern}`)
            }
            const searchPattern = pattern
              .slice(0, -1)
              .replaceAll('%', '') // sanitize search pattern
              .replaceAll('_', '\\_') // escape any underscores
            qb = qb.orWhere('uri', 'like', `${searchPattern}%`)
          }
        }
        return qb
      })
    }
    if (sources && sources.length > 0) {
      builder = builder.where('src', 'in', sources)
    }
    if (cursor) {
      const cursorId = parseInt(cursor, 10)
      if (isNaN(cursorId)) {
        throw new InvalidRequestError('invalid cursor')
      }
      builder = builder.where('id', '>', cursorId)
    }

    const res = await builder.execute()

    const modSrvc = ctx.modService(ctx.db)
    const labels = await Promise.all(
      res.map((l) => modSrvc.views.formatLabelAndEnsureSig(l)),
    )
    const resCursor = res.at(-1)?.id.toString(10)

    return {
      encoding: 'application/json',
      body: {
        cursor: resCursor,
        labels,
      },
    }
  })
}
