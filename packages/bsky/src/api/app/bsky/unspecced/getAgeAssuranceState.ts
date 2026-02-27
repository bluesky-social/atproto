import { toDatetimeString } from '@atproto/syntax'
import { Server, UpstreamFailureError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { app } from '../../../../lexicons/index.js'
import { ActorInfo } from '../../../../proto/bsky_pb'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.unspecced.getAgeAssuranceState, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth }) => {
      const viewer = auth.credentials.iss
      const actorInfo = await getAgeVerificationState(ctx, viewer)

      const lastInitiatedAt = actorInfo.ageAssuranceStatus?.lastInitiatedAt

      return {
        encoding: 'application/json',
        body: {
          lastInitiatedAt: lastInitiatedAt
            ? toDatetimeString(lastInitiatedAt.toDate())
            : undefined,
          status: actorInfo.ageAssuranceStatus?.status ?? 'unknown',
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
