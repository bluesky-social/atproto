import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.team.listOnlineMembers, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params, signal }) => {
      const members = await ctx.teamService(ctx.db).listOnlineMembers({
        ...params,
        ...ctx.cfg.onlineMembers,
        serviceDid: ctx.cfg.service.did,
        signal,
      })

      return {
        encoding: 'application/json',
        body: { members },
      }
    },
  })
}
