import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { OutputSchema } from '../../../../lexicon/types/app/bsky/actor/getProfile'
import {
  LocalRecords,
  LocalViewer,
  pipethroughReadAfterWrite,
} from '../../../../read-after-write'

export default function (server: Server, ctx: AppContext) {
  if (!ctx.bskyAppView) return

  server.app.bsky.actor.getProfile({
    auth: ctx.authVerifier.accessStandard(),
    handler: async (reqCtx) => {
      return pipethroughReadAfterWrite(ctx, reqCtx, getProfileMunge)
    },
  })
}

const getProfileMunge = async (
  localViewer: LocalViewer,
  original: OutputSchema,
  local: LocalRecords,
  requester: string,
): Promise<OutputSchema> => {
  if (!local.profile) return original
  if (original.did !== requester) return original
  return localViewer.updateProfileDetailed(original, local.profile.record)
}
