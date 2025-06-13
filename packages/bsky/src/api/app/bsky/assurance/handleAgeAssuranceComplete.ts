import crypto from 'node:crypto'
import qs from 'node:querystring'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { AgeAssuranceState } from '../../../../lexicon/types/app/bsky/assurance/defs'

import { VERIFICATION_SECRET } from './env'

type StatusPayload = {
  verified: true
  transactionId: string
  errorCode: string | null
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.assurance.handleAgeAssuranceComplete({
    handler: async ({ auth, params }) => {
      const { status: rawStatusPayload, externalPayload, signature } = params

      console.log('handleAgeAssuranceComplete', params)

      try {
        if (rawStatusPayload && externalPayload && signature) {
          const expectedSignature = crypto
            .createHmac('sha256', VERIFICATION_SECRET)
            .update(`${rawStatusPayload}:${externalPayload}`)
            .digest('hex')
          const expectedBuffer = Buffer.from(expectedSignature, 'hex')
          const signedBuffer = Buffer.from(signature, 'hex')

          if (expectedBuffer.length !== signedBuffer.length) {
            throw new Error(`Signature mismatch`)
          }

          if (!crypto.timingSafeEqual(expectedBuffer, signedBuffer)) {
            throw new Error(`Signature mismatch`)
          }

          const statusPayload = JSON.parse(rawStatusPayload) as StatusPayload
          const status = getResponseStatus(statusPayload)
          // TODO abstract this
          const { did } = JSON.parse(externalPayload) as { did: string }

          try {
            await ctx.stashClient.update({
              actorDid: did,
              namespace: 'app.bsky.assurance.defs#ageAssuranceState',
              key: 'self',
              payload: {
                required: true,
                status,
              },
            })
          } catch (e) {
            // TODO handle stash update failure
          }

          return {
            encoding: 'application/json',
            statusCode: 302,
            headers: {
              Location: `https://bsky.app/intent/age-assurance?${qs.stringify({ status })}`,
            },
            body: {
              status,
            },
          }
        } else {
          throw new Error(`Unexpected payload`)
        }
      } catch (e) {
        console.error(e) // TODO
        return {
          encoding: 'application/json',
          statusCode: 302,
          headers: {
            Location: `https://bsky.app/intent/age-assurance?${qs.stringify({ status: 'failed' })}`,
          },
          body: {
            status: 'failed',
          },
        }
      }
    },
  })
}

function getResponseStatus(
  statusPayload: StatusPayload,
): AgeAssuranceState['status'] {
  if (statusPayload.verified) {
    return 'verified-adult'
  } else if (statusPayload.errorCode) {
    return 'failed'
  } else {
    return 'unverified'
  }
}
