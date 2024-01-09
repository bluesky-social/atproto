import { Server } from '../../lexicon'
import AppContext from '../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.temp.fetchLabels(async ({ params }) => {
    const { limit } = params
    const since =
      params.since !== undefined ? new Date(params.since).toISOString() : ''
    const labelRes = await ctx.db.db
      .selectFrom('label')
      .selectAll()
      .orderBy('label.cts', 'asc')
      .where('cts', '>', since)
      .limit(limit)
      .execute()

    const labels = labelRes.map((l) => ({
      ...l,
      cid: l.cid === '' ? undefined : l.cid,
    }))

    return {
      encoding: 'application/json',
      body: {
        labels,
      },
    }
  })
}
