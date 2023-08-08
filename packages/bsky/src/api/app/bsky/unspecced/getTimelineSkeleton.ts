import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { getTimelineSkeleton } from '../feed/getTimeline'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getTimelineSkeleton({
    auth: ctx.authVerifier,
    handler: async ({ auth, params }) => {
      const { limit, cursor } = params
      const viewer = auth.credentials.did

      const skeleton = await getTimelineSkeleton(ctx.db, viewer, limit, cursor)
      return {
        encoding: 'application/json',
        body: skeleton,
      }
    },
  })
}
