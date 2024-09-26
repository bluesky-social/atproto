import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { mapDefined } from '@atproto/common'
import { INVALID_HANDLE } from '@atproto/syntax'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getAccountInfos({
    auth: ctx.authVerifier.optionalStandardOrRole,
    handler: ctx.createHandler(
      async (ctx, { params }) => {
        const { dids } = params

        const actors = await ctx.hydrator.actor.getActors(dids, true)

        const infos = mapDefined(dids, (did) => {
          const info = actors.get(did)
          if (!info) return
          if (info.takedownRef && !ctx.includeTakedowns) return
          const profileRecord =
            !info.profileTakedownRef || ctx.includeTakedowns
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
      { allowIncludeTakedowns: true },
    ),
  })
}
