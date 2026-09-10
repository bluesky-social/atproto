import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.server.getConfig, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ auth }) => {
      return {
        encoding: 'application/json',
        body: {
          appview: {
            url: ctx.cfg.appview.url,
          },
          blobDivert: {
            url: ctx.cfg.blobDivert?.url,
          },
          pds: {
            url: ctx.cfg.pds?.url,
          },
          chat: {
            url: ctx.cfg.chat?.url,
          },
          viewer: {
            role: auth.credentials.isAdmin
              ? tools.ozone.team.defs.roleAdmin.value
              : auth.credentials.isModerator
                ? tools.ozone.team.defs.roleModerator.value
                : tools.ozone.team.defs.roleTriage.value,
          },
          verifierDid: ctx.cfg.verifier?.did || undefined,
        },
      }
    },
  })
}
