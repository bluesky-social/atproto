import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { mapDefined } from '@atproto/common'
import { INVALID_HANDLE } from '@atproto/syntax'
import { Label } from '../../../../lexicon/types/com/atproto/label/defs'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getAccountInfos({
    auth: ctx.authVerifier.optionalStandardOrRole,
    handler: async ({ params, auth, req }) => {
      const { dids } = params
      const { includeTakedowns } = ctx.authVerifier.parseCreds(auth)

      const actors = await ctx.hydrator.actor.getActors(dids, true)

      const labelers = ctx.reqLabelers(req)
      const labelMap = await ctx.hydrator.label.getLabelsForSubjects(
        dids,
        labelers,
      )

      const infos = mapDefined(dids, (did) => {
        const info = actors.get(did)
        if (!info) return
        if (info.takedownRef && !includeTakedowns) return
        const profileRecord =
          !info.profileTakedownRef || includeTakedowns
            ? info.profile
            : undefined
        const labels: Label[] = []
        Array.from(labelMap.get(did)?.labels?.values() ?? []).forEach(
          (label) => {
            if (label) labels.push(label)
          },
        )
        return {
          did,
          labels,
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
