import { Un$Typed } from '@atproto/api'
import { UpstreamFailureError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { AgeAssuranceState } from '../../../../lexicon/types/app/bsky/unspecced/defs'
import {
  GetAgeAssuranceStateResponse,
  AgeAssuranceStatus,
} from '../../../../proto/bsky_pb'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getAgeAssuranceState({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth }) => {
      const viewer = auth.credentials.iss
      let state = await getAgeVerificationState(ctx, viewer)

      if (!state) {
        state = {
          // TODO
          updatedAt: new Date().toISOString(),
          status: 'unknown',
        }
      }

      return {
        encoding: 'application/json',
        body: state,
      }
    },
  })
}

const getAgeVerificationState = async (
  ctx: AppContext,
  actorDid: string,
): Promise<Un$Typed<AgeAssuranceState>> => {
  let res: GetAgeAssuranceStateResponse
  try {
    // TODO gonna be a param on getActors
    res = await ctx.dataplane.getAgeAssuranceState({
      did: actorDid,
    })
  } catch (err) {
    console.error(err)
    throw new UpstreamFailureError(
      'Cannot get current age assurance state',
      'GetAgeAssuranceStateFailed',
      { cause: err },
    )
  }

  return protobufToLex(res)
}

function protobufToLex(
  proto: GetAgeAssuranceStateResponse,
): Un$Typed<AgeAssuranceState> {
  let status: AgeAssuranceState['status'] = 'unverified'

  switch (proto.status) {
    case AgeAssuranceStatus.UNKNOWN:
      status = 'unknown'
      break
    case AgeAssuranceStatus.PENDING:
      status = 'pending'
      break
    case AgeAssuranceStatus.ASSURED:
      status = 'assured'
      break
    case AgeAssuranceStatus.FAILED:
      // TODO no longer accurate
      status = 'failed'
      break
  }

  return {
    // TODO
    updatedAt: new Date().toISOString(),
    status,
  }
}
