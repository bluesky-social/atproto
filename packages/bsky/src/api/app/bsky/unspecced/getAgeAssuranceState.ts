import { UpstreamFailureError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { ActorInfo } from '../../../../proto/bsky_pb'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getAgeAssuranceState({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth }) => {
      const viewer = auth.credentials.iss
      const actorInfo = await getAgeVerificationState(ctx, viewer)

      return {
        encoding: 'application/json',
        body: {
          lastInitiatedAt:
            actorInfo.ageAssuranceStatus?.lastInitiatedAt
              ?.toDate()
              .toISOString() ?? undefined,
          status: 'assured', // actorInfo.ageAssuranceStatus?.status ?? 'unknown',
        },
      }
    },
  })
}

const getAgeVerificationState = async (
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
