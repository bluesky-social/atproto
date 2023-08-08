import AppContext from '../../../../../context'
import { Server } from '../../../../../lexicon'
import { ids } from '../../../../../lexicon/lexicons'
import { OutputSchema } from '../../../../../lexicon/types/app/bsky/actor/getProfiles'
import { ApiRes, getClock } from '../util/read-after-write'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getProfiles({
    auth: ctx.accessVerifier,
    handler: async ({ req, auth, params }) => {
      const requester = auth.credentials.did
      if (ctx.canProxyRead(req)) {
        const res = await ctx.appviewAgent.api.app.bsky.actor.getProfiles(
          params,
          await ctx.serviceAuthHeaders(requester),
        )
        return {
          encoding: 'application/json',
          body: await ensureReadAfterWrite(ctx, requester, res),
        }
      }

      const { actors } = params
      const { db, services } = ctx
      const actorService = services.appView.actor(db)

      const actorsRes = await actorService.getActors(actors)

      return {
        encoding: 'application/json',
        body: {
          profiles: await actorService.views.hydrateProfilesDetailed(
            actorsRes,
            requester,
          ),
        },
      }
    },
  })
}

const ensureReadAfterWrite = async (
  ctx: AppContext,
  requester: string,
  res: ApiRes<OutputSchema>,
): Promise<OutputSchema> => {
  const clock = getClock(res.headers)
  if (!clock) return res.data
  const hasSelf = res.data.profiles.some((prof) => prof.did === requester)
  if (!hasSelf) return res.data
  const localSrvc = ctx.services.local(ctx.db)
  const local = await localSrvc.getRecordsSinceClock(requester, clock, [
    ids.AppBskyActorProfile,
  ])
  const localProf = local.profile
  if (!localProf) return res.data
  const profiles = res.data.profiles.map((prof) => {
    if (prof.did !== requester) return prof
    return localSrvc.updateProfileDetailed(prof, localProf.record)
  })
  return {
    ...res.data,
    profiles,
  }
}
