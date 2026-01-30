import { mapDefined } from '@atproto/common'
import { INVALID_HANDLE } from '@atproto/syntax'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.admin.getAccountInfos, {
    auth: ctx.authVerifier.optionalStandardOrRole,
    handler: async ({ params, auth }) => {
      const { dids } = params
      const { includeTakedowns } = ctx.authVerifier.parseCreds(auth)

      const actors = await ctx.hydrator.actor.getActors(dids, {
        includeTakedowns: true,
        skipCacheForDids: dids,
      })

      const infos = mapDefined(
        dids,
        (did): com.atproto.admin.defs.$defs.AccountView | undefined => {
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
        },
      )

      return {
        encoding: 'application/json',
        body: {
          infos,
        },
      }
    },
  })
}
