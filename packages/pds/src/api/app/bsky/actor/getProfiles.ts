import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { OutputSchema } from '../../../../lexicon/types/app/bsky/actor/getProfiles'
import {
  LocalViewer,
  pipethroughReadAfterWrite,
  LocalRecords,
} from '../../../../read-after-write'

export default function (server: Server, ctx: AppContext) {
  const { bskyAppView } = ctx.cfg
  if (!bskyAppView) return
  server.app.bsky.actor.getProfiles({
    auth: ctx.authVerifier.accessStandard(),
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
