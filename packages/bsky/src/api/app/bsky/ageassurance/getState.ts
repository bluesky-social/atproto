import { DatetimeString } from '@atproto/syntax'
import { Server, UpstreamFailureError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { app } from '../../../../lexicons/index.js'
import { ActorInfo } from '../../../../proto/bsky_pb'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.ageassurance.getState, {
    auth: ctx.authVerifier.standard,
    handler: async ({
      auth,
    }): Promise<app.bsky.ageassurance.getState.$Output> => {
      const viewer = auth.credentials.iss
      const actor = await getActorInfo(ctx, viewer)

      const lastInitiatedAt = actor.ageAssuranceStatus?.lastInitiatedAt

      return {
        encoding: 'application/json',
        body: {
          state: {
            lastInitiatedAt: lastInitiatedAt
              ? (lastInitiatedAt.toDate().toISOString() as DatetimeString)
              : undefined,
            status: actor.ageAssuranceStatus?.status || 'unknown',
            access: actor.ageAssuranceStatus?.access || 'unknown',
          },
          metadata: {
            accountCreatedAt: actor.createdAt
              ? (actor.createdAt.toDate().toISOString() as DatetimeString)
              : undefined,
          },
        },
      }
    },
  })
}

const getActorInfo = async (
  ctx: AppContext,
  actorDid: string,
): Promise<ActorInfo> => {
  try {
    const res = await ctx.dataplane.getActors({
      dids: [actorDid],
      returnAgeAssuranceForDids: [actorDid],
      skipCacheForDids: [actorDid],
    })

    return res.actors[0]
  } catch (err) {
    throw new UpstreamFailureError(
      'Cannot get current age assurance state',
      'GetAgeAssuranceStateFailed',
      { cause: err },
    )
  }
}
