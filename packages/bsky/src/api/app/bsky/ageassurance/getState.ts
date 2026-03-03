import { UpstreamFailureError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { ActorInfo } from '../../../../proto/bsky_pb'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.ageassurance.getState({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth }) => {
      const viewer = auth.credentials.iss
      const actor = await getActorInfo(ctx, viewer)

      return {
        encoding: 'application/json',
        body: {
          state: {
            lastInitiatedAt:
              actor.ageAssuranceStatus?.lastInitiatedAt
                ?.toDate()
                .toISOString() || undefined,
            status: 'assured', // actor.ageAssuranceStatus?.status || 'unknown',
            access: 'full', // actor.ageAssuranceStatus?.access || 'unknown',
          },
          metadata: {
            accountCreatedAt:
              actor.createdAt?.toDate().toISOString() || undefined,
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
