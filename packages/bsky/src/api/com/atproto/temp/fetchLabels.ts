import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.temp.fetchLabels(async ({ params }) => {
    const { limit } = params
    const db = ctx.db.getReplica()
    const since =
      params.since !== undefined ? new Date(params.since).toISOString() : ''
    const labels = await db.db
      .selectFrom('label')
      .selectAll()
      .orderBy('label.cts', 'asc')
      .where('cts', '>', since)
      .limit(limit)
      .execute()

    return {
      encoding: 'application/json',
      body: {
        labels,
      },
    }
  })
}
