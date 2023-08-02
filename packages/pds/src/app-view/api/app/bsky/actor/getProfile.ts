import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../../lexicon'
import { softDeleted } from '../../../../../db/util'
import AppContext from '../../../../../context'
import { ids } from '../../../../../lexicon/lexicons'
import { OutputSchema } from '../../../../../lexicon/types/app/bsky/actor/getProfile'
import { ApiRes, getClock } from '../util/read-after-write'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getProfile({
    auth: ctx.accessVerifier,
    handler: async ({ req, auth, params }) => {
      const requester = auth.credentials.did
      if (ctx.canProxyRead(req)) {
        const res = await ctx.appviewAgent.api.app.bsky.actor.getProfile(
          params,
          await ctx.serviceAuthHeaders(requester),
        )
        return {
          encoding: 'application/json',
          body: await ensureReadAfterWrite(ctx, requester, res),
        }
      }

      const { actor } = params
      const { db, services } = ctx
      const actorService = services.appView.actor(db)

      const actorRes = await actorService.getActor(actor, true)

      if (!actorRes) {
        throw new InvalidRequestError('Profile not found')
      }
      if (softDeleted(actorRes)) {
        throw new InvalidRequestError(
          'Account has been taken down',
          'AccountTakedown',
        )
      }

      return {
        encoding: 'application/json',
        body: await actorService.views.profileDetailed(actorRes, requester),
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
  if (res.data.did !== requester) return res.data
  const localSrvc = ctx.services.local(ctx.db)
  const local = await localSrvc.getRecordsSinceClock(requester, clock, [
    ids.AppBskyActorProfile,
  ])
  if (!local.profile) return res.data
  return localSrvc.updateProfileDetailed(res.data, local.profile.record)
}
