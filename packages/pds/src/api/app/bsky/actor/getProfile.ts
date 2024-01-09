import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from '../../../proxy'
import { OutputSchema } from '../../../../lexicon/types/app/bsky/actor/getProfile'
import {
  LocalViewer,
  handleReadAfterWrite,
  LocalRecords,
} from '../../../../read-after-write'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getProfile({
    auth: ctx.authVerifier.accessOrRole,
    handler: async ({ req, auth, params }) => {
      const requester =
        auth.credentials.type === 'access' ? auth.credentials.did : null
      const res = await ctx.appViewAgent.api.app.bsky.actor.getProfile(
        params,
        requester ? await ctx.appviewAuthHeaders(requester) : authPassthru(req),
      )
      if (res.data.did === requester) {
        return await handleReadAfterWrite(ctx, requester, res, getProfileMunge)
      }
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })
}

const getProfileMunge = async (
  localViewer: LocalViewer,
  original: OutputSchema,
  local: LocalRecords,
): Promise<OutputSchema> => {
  if (!local.profile) return original
  return localViewer.updateProfileDetailed(original, local.profile.record)
}
