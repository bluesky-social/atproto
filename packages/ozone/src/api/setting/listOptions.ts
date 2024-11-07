import { AuthRequiredError } from '@atproto/xrpc-server'
import { Server } from '../../lexicon'
import AppContext from '../../context'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.setting.listOptions({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const { prefix, scope, keys, limit, cursor } = params
      let did = ctx.cfg.service.did

      if (scope === 'personal') {
        if (access.type !== 'moderator') {
          throw new AuthRequiredError(
            'Must use moderator auth to get personal set details',
          )
        }

        did = access.iss
      }

      const settingService = ctx.settingService(db)

      const result = await settingService.query({
        scope: scope === 'personal' ? 'personal' : 'instance',
        did,
        keys,
        prefix,
        limit,
        cursor,
      })

      return {
        encoding: 'application/json',
        body: {
          options: result.options.map((option) => settingService.view(option)),
          cursor: result.cursor,
        },
      }
    },
  })
}
