import AppContext from '../../../../../context'
import { Server } from '../../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getSuggestions({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const requester = auth.credentials.did
      const res = await ctx.appviewAgent.api.app.bsky.actor.getSuggestions(
        params,
        await ctx.serviceAuthHeaders(requester),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })
}
