import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { OutputSchema } from '../../../../lexicon/types/app/bsky/actor/getProfile'
import {
  LocalViewer,
  handleReadAfterWrite,
  LocalRecords,
} from '../../../../read-after-write'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getProfile({
    auth: ctx.authVerifier.access,
    handler: async ({ req, auth, params }) => {
      const requester = auth.credentials.did
      if (req.headers['atproto-forward']) {
        const res = await ctx.moderationAgent.api.app.bsky.actor.getProfile(
          params,
          await ctx.moderationAuthHeaders(requester, req),
        )
        return {
          encoding: 'application/json',
          body: res.data,
        }
      }

      const res = await ctx.appViewAgent.api.app.bsky.actor.getProfile(
        params,
        await ctx.appviewAuthHeaders(requester, req),
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
