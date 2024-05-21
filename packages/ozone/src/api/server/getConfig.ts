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
            url: ctx.cfg.appview.url,
          },
          blobDivert: {
            url: ctx.cfg.blobDivert?.url,
          },
          pds: {
            url: ctx.cfg.pds?.url,
          },
          viewer: {
            role: auth.credentials.isAdmin
              ? 'admin'
              : auth.credentials.isModerator
                ? 'moderator'
                : 'triage',
          },
        },
      }
    },
  })
}
