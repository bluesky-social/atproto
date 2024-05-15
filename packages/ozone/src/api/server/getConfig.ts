import { Server } from '../../lexicon'
import AppContext from '../../context'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.server.getConfig({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ auth }) => {
      return {
        encoding: 'application/json',
        body: {
          appview: {
            configured: !!ctx.appviewAgent,
            url: ctx.cfg.appview.url,
          },
          blobDivert: {
            configured: !!ctx.blobDiverter,
            url: ctx.cfg.blobDivert?.url,
          },
          pds: {
            configured: !!ctx.pdsAgent,
            url: ctx.cfg.pds?.url,
          },
          viewerRole: auth.credentials.isAdmin
            ? 'admin'
            : auth.credentials.isModerator
              ? 'moderator'
              : 'triage',
        },
      }
    },
  })
}
