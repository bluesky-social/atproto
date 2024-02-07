import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from '../../../proxy'
import { OutputSchema } from '../../../../lexicon/types/app/bsky/actor/getProfile'
import {
  LocalViewer,
  LocalRecords,
  handleReadAfterWritePipeThrough,
} from '../../../../read-after-write'
import { pipethrough } from '../../../../pipethrough'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getProfile({
    auth: ctx.authVerifier.accessOrRole,
    handler: async ({ req, auth, params }) => {
      const requester =
        auth.credentials.type === 'access' ? auth.credentials.did : null
      const res = await pipethrough(
        ctx.cfg.bskyAppView.url,
        'app.bsky.actor.getProfile',
        params,
        requester ? await ctx.appviewAuthHeaders(requester) : authPassthru(req),
      )
      if (!requester) {
        return res
      }
      return handleReadAfterWritePipeThrough(
        ctx,
        'app.bsky.actor.getProfile',
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
