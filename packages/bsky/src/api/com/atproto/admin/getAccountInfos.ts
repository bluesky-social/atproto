import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { mapDefined } from '@atproto/common'
import { INVALID_HANDLE } from '@atproto/syntax'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getAccountInfos({
    auth: ctx.authVerifier.optionalStandardOrRole,
    handler: async ({ req, auth, params }) => {
      const { dids } = params
      const { viewer, includeTakedowns } = ctx.authVerifier.parseCreds(auth)

      const labelers = ctx.reqLabelers(req)

      const { hydrator } = await ctx.createRequestContent({
        viewer,
        labelers,
      })

      const actors = await hydrator.actor.getActors(dids, true)

      const infos = mapDefined(dids, (did) => {
        const info = actors.get(did)
        if (!info) return
        if (info.takedownRef && !includeTakedowns) return
        const profileRecord =
          !info.profileTakedownRef || includeTakedowns
            ? info.profile
            : undefined

        return {
          did,
          handle: info.handle ?? INVALID_HANDLE,
          relatedRecords: profileRecord ? [profileRecord] : undefined,
          indexedAt: (info.sortedAt ?? new Date(0)).toISOString(),
        }
      })

      return {
        encoding: 'application/json',
        body: {
          infos,
        },
      }
    },
  })
}
