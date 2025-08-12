import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'
import { OutputSchema } from '../../../../lexicon/types/app/bsky/actor/getProfiles'
import { computeProxyTo } from '../../../../pipethrough'
import {
  LocalRecords,
  LocalViewer,
  pipethroughReadAfterWrite,
} from '../../../../read-after-write'

export default function (server: Server, ctx: AppContext) {
  if (!ctx.bskyAppView) return

  server.app.bsky.actor.getProfiles({
    auth: ctx.authVerifier.authorization({
      authorize: (permissions, { req }) => {
        const lxm = ids.AppBskyActorGetProfiles
        const aud = computeProxyTo(ctx, req, lxm)
        permissions.assertRpc({ aud, lxm })
      },
    }),
    handler: async (reqCtx) => {
      return pipethroughReadAfterWrite(ctx, reqCtx, getProfilesMunge)
    },
  })
}

const getProfilesMunge = async (
  localViewer: LocalViewer,
  original: OutputSchema,
  local: LocalRecords,
  requester: string,
): Promise<OutputSchema> => {
  const localProf = local.profile
  if (!localProf) return original

  const profiles = original.profiles.map((prof) => {
    if (prof.did !== requester) return prof
    return localViewer.updateProfileDetailed(prof, localProf.record)
  })
  return {
    ...original,
    profiles,
  }
}
