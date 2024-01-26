import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { Actor } from '../../../../db/tables/actor'
import { mapDefined } from '@atproto/common'
import { INVALID_HANDLE } from '@atproto/syntax'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getAccountInfos({
    auth: ctx.authVerifier.roleOrAdminService,
    handler: async ({ params }) => {
      const { dids } = params
      const db = ctx.db.getPrimary()
      const actorService = ctx.services.actor(db)
      const [actors, profiles] = await Promise.all([
        actorService.getActors(dids, true),
        actorService.getProfileRecords(dids, true),
      ])
      const actorByDid = actors.reduce((acc, cur) => {
        return acc.set(cur.did, cur)
      }, new Map<string, Actor>())

      const infos = mapDefined(dids, (did) => {
        const info = actorByDid.get(did)
        if (!info) return
        const profile = profiles.get(did)
        return {
          did,
          handle: info.handle ?? INVALID_HANDLE,
          relatedRecords: profile ? [profile] : undefined,
          indexedAt: info.indexedAt,
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
