import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getRepo({
    auth: ctx.roleVerifier,
    handler: async ({ req, params }) => {
      const res = await ctx.appViewAgent.com.atproto.admin.getRepo(
        params,
        authPassthru(req),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })
}
