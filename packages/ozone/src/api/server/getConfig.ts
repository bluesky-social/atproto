import { AppContext } from '../../context'
import { Server, TOOLS_OZONE_TEAM } from '../../lexicon'

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
          chat: {
            url: ctx.cfg.chat?.url,
          },
          viewer: {
            role: auth.credentials.isAdmin
              ? TOOLS_OZONE_TEAM.DefsRoleAdmin
              : auth.credentials.isModerator
                ? TOOLS_OZONE_TEAM.DefsRoleModerator
                : TOOLS_OZONE_TEAM.DefsRoleTriage,
          },
          verifierDid: ctx.cfg.verifier?.did || undefined,
        },
      }
    },
  })
}
