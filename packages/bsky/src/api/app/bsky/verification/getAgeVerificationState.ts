import { Un$Typed } from '@atproto/api'
import { UpstreamFailureError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { AgeAssuranceState } from '../../../../lexicon/types/app/bsky/assurance/defs'
import {
  GetAgeVerificationStateResponse,
  AgeVerificationStatus,
} from '../../../../proto/bsky_pb'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.assurance.getAgeAssuranceState({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth }) => {
      const viewer = auth.credentials.iss
      let state = await getAgeVerificationState(ctx, viewer)

      /*
       * TODO
       *   1. Geo-IP, save to stash under `required` key
       */

      if (!state) {
        state = {
          required: true, // compute this, fail closed?
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
  let res: GetAgeVerificationStateResponse
  try {
    res = await ctx.dataplane.getAgeVerificationState({
      did: actorDid,
    })
  } catch (err) {
    throw new UpstreamFailureError(
      'cannot get current notification preferences',
      'NotificationPreferencesFailed',
      { cause: err },
    )
  }

  return protobufToLex(res)
}

function protobufToLex(
  proto: GetAgeVerificationStateResponse,
): Un$Typed<AgeAssuranceState> {
  let status: AgeAssuranceState['status'] = 'unverified'

  switch (proto.status) {
    case AgeVerificationStatus.UNVERIFIED:
      status = 'unverified'
      break
    case AgeVerificationStatus.PENDING:
      status = 'pending'
      break
    case AgeVerificationStatus.VERIFIED_ADULT:
      status = 'verified-adult'
      break
    case AgeVerificationStatus.VERIFIED_MINOR:
      status = 'verified-minor'
      break
    case AgeVerificationStatus.FAILED:
      status = 'failed'
      break
  }

  return {
    required: proto.required,
    status,
  }
}
