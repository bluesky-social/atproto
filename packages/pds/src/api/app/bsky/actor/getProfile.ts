import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from '../../../proxy'
import { OutputSchema } from '../../../../lexicon/types/app/bsky/actor/getProfile'
import {
  LocalViewer,
  LocalRecords,
  handleReadAfterWrite,
} from '../../../../read-after-write'
import { pipethrough } from '../../../../pipethrough'

const METHOD_NSID = 'app.bsky.actor.getProfile'

export default function (server: Server, ctx: AppContext) {
  const { bskyAppView } = ctx.cfg
  if (!bskyAppView) return
  server.app.bsky.actor.getProfile({
    auth: ctx.authVerifier.accessOrRole,
    handler: async ({ req, auth, params }) => {
      const requester =
        auth.credentials.type === 'access' ? auth.credentials.did : null
      const res = await pipethrough(
        bskyAppView.url,
        METHOD_NSID,
        params,
        requester
          ? await ctx.appviewAuthHeaders(requester, req)
          : authPassthru(req),
      )
      if (!requester) {
        return res
      }
      return handleReadAfterWrite(
        ctx,
        METHOD_NSID,
        requester,
        res,
        getProfileMunge,
      )
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
