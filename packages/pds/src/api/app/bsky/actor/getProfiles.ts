import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { OutputSchema } from '../../../../lexicon/types/app/bsky/actor/getProfiles'
import { LocalRecords } from '../../../../services/local'
import { handleReadAfterWrite } from '../util/read-after-write'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getProfiles({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await ctx.appViewAgent.api.app.bsky.actor.getProfiles(
        params,
        await ctx.serviceAuthHeaders(requester),
      )
      const hasSelf = res.data.profiles.some((prof) => prof.did === requester)
      if (hasSelf) {
        return await handleReadAfterWrite(ctx, requester, res, getProfilesMunge)
      }
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })
}

const getProfilesMunge = async (
  ctx: AppContext,
  original: OutputSchema,
  local: LocalRecords,
  requester: string,
): Promise<OutputSchema> => {
  const localProf = local.profile
  if (!localProf) return original
  const profiles = original.profiles.map((prof) => {
    if (prof.did !== requester) return prof
    return ctx.services
      .local(ctx.db)
      .updateProfileDetailed(prof, localProf.record)
  })
  return {
    ...original,
    profiles,
  }
}
