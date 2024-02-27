import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { OutputSchema } from '../../../../lexicon/types/app/bsky/actor/getProfiles'
import { pipethrough } from '../../../../pipethrough'
import {
  LocalViewer,
  handleReadAfterWrite,
  LocalRecords,
} from '../../../../read-after-write'

const METHOD_NSID = 'app.bsky.actor.getProfiles'

export default function (server: Server, ctx: AppContext) {
  const { bskyAppView } = ctx.cfg
  if (!bskyAppView) return
  server.app.bsky.actor.getProfiles({
    auth: ctx.authVerifier.access,
    handler: async ({ auth, params, req }) => {
      const requester = auth.credentials.did

      const res = await pipethrough(
        bskyAppView.url,
        METHOD_NSID,
        params,
        await ctx.appviewAuthHeaders(requester, req),
      )
      return handleReadAfterWrite(
        ctx,
        METHOD_NSID,
        requester,
        res,
        getProfilesMunge,
      )
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
